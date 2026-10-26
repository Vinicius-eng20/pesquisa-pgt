create type public.app_role as enum ('manager','guest');
create type public.booking_status as enum ('pending','confirmed','rejected','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'manager'));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  capacity int not null default 2 check (capacity > 0),
  price_per_night numeric(10,2) not null check (price_per_night >= 0),
  image_url text,
  created_at timestamptz not null default now()
);
grant select on public.rooms to anon;
grant select, insert, update, delete on public.rooms to authenticated;
grant all on public.rooms to service_role;
alter table public.rooms enable row level security;
create policy "rooms public read" on public.rooms for select to anon, authenticated using (true);
create policy "manager insert rooms" on public.rooms for insert to authenticated with check (public.has_role(auth.uid(),'manager'));
create policy "manager update rooms" on public.rooms for update to authenticated using (public.has_role(auth.uid(),'manager'));
create policy "manager delete rooms" on public.rooms for delete to authenticated using (public.has_role(auth.uid(),'manager'));

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  check_in date not null,
  check_out date not null,
  guests int not null default 1,
  status booking_status not null default 'pending',
  total_price numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  check (check_out > check_in)
);
grant select, insert, update on public.bookings to authenticated;
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;
create policy "read own or manager" on public.bookings for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'manager'));
create policy "guest create own" on public.bookings for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
create policy "guest cancel own" on public.bookings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and status = 'cancelled');
create policy "manager update bookings" on public.bookings for update to authenticated using (public.has_role(auth.uid(),'manager'));

-- validation: no overlaps, compute price
create or replace function public.validate_booking()
returns trigger language plpgsql security definer set search_path = public as $$
declare p numeric;
begin
  if tg_op = 'INSERT' then
    if new.check_in < current_date then raise exception 'A data de entrada não pode estar no passado'; end if;
    select price_per_night into p from public.rooms where id = new.room_id;
    new.total_price := p * (new.check_out - new.check_in);
  end if;
  if new.status in ('pending','confirmed') and exists (
    select 1 from public.bookings b where b.room_id = new.room_id and b.id <> new.id
      and b.status in ('pending','confirmed')
      and b.check_in < new.check_out and b.check_out > new.check_in) then
    raise exception 'Este quarto já está reservado nessas datas';
  end if;
  return new;
end $$;
create trigger bookings_validate before insert or update on public.bookings for each row execute function public.validate_booking();

create or replace function public.available_rooms(_check_in date, _check_out date)
returns setof public.rooms language sql stable security definer set search_path = public as $$
  select r.* from public.rooms r
  where not exists (select 1 from public.bookings b where b.room_id = r.id
    and b.status in ('pending','confirmed') and b.check_in < _check_out and b.check_out > _check_in)
  order by r.price_per_night
$$;
grant execute on function public.available_rooms(date,date) to anon, authenticated;

-- signup: profile + role (first user becomes manager)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), new.email);
  if not exists (select 1 from public.user_roles where role = 'manager') then
    insert into public.user_roles(user_id, role) values (new.id, 'manager');
  else
    insert into public.user_roles(user_id, role) values (new.id, 'guest');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into public.rooms(name, description, capacity, price_per_night) values
('Quarto Standard', 'Cama de casal, banheiro privativo, Wi-Fi e ar-condicionado.', 2, 280),
('Quarto Superior', 'Mais espaço, varanda com vista para o jardim e frigobar.', 2, 390),
('Suíte Família', 'Dois ambientes, uma cama de casal e duas de solteiro.', 4, 560),
('Suíte Master', 'Banheira, vista panorâmica e café da manhã no quarto.', 2, 780);