create type public.app_role as enum ('admin','user');
create type public.booking_status as enum ('pending','confirmed','rejected','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "read own profile or admin" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid());

-- first user becomes the business owner (admin)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''));
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  duration_min integer not null default 60,
  price numeric(10,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.services to anon;
grant select, insert, update, delete on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;
create policy "anyone reads active services" on public.services for select to anon, authenticated using (active or public.has_role(auth.uid(),'admin'));
create policy "admin manages services" on public.services for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.slots (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  starts_at timestamptz not null,
  booked boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.slots(service_id, starts_at);
grant select on public.slots to anon;
grant select, insert, update, delete on public.slots to authenticated;
grant all on public.slots to service_role;
alter table public.slots enable row level security;
create policy "anyone reads slots" on public.slots for select to anon, authenticated using (true);
create policy "admin manages slots" on public.slots for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.slots(id) on delete cascade,
  user_id uuid not null,
  status public.booking_status not null default 'pending',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index bookings_one_active_per_slot on public.bookings(slot_id) where status in ('pending','confirmed');
grant select, insert, update on public.bookings to authenticated;
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;
create policy "read own or admin" on public.bookings for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "create own" on public.bookings for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
create policy "update own or admin" on public.bookings for update to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.bookings_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.slots where id = new.slot_id and starts_at <= now()) then
      raise exception 'Este horário já passou';
    end if;
  elsif tg_op = 'UPDATE' then
    if not public.has_role(auth.uid(),'admin') then
      if new.status <> 'cancelled' or old.status not in ('pending','confirmed')
         or new.slot_id <> old.slot_id or new.user_id <> old.user_id then
        raise exception 'Você só pode cancelar seus agendamentos';
      end if;
    end if;
    new.updated_at := now();
  end if;
  return new;
end; $$;
create trigger bookings_guard before insert or update on public.bookings
for each row execute function public.bookings_guard();

create or replace function public.bookings_sync_slot()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.slots s set booked = exists (
    select 1 from public.bookings b where b.slot_id = s.id and b.status in ('pending','confirmed'))
  where s.id = new.slot_id;
  return new;
end; $$;
create trigger bookings_sync_slot after insert or update on public.bookings
for each row execute function public.bookings_sync_slot();

alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.slots;
alter publication supabase_realtime add table public.services;