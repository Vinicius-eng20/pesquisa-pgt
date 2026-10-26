create type public.app_role as enum ('organizer', 'participant');

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
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "own roles visible" on public.user_roles for select to authenticated using (user_id = auth.uid());

create policy "profiles read own or organizer" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'organizer'));
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  if not exists (select 1 from public.user_roles where role = 'organizer') then
    insert into public.user_roles (user_id, role) values (new.id, 'organizer');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'participant');
  end if;
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  location text not null default '',
  starts_at timestamptz not null,
  capacity integer,
  status text not null default 'active' check (status in ('active','cancelled')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "events readable" on public.events for select to authenticated using (true);
create policy "organizer insert events" on public.events for insert to authenticated with check (public.has_role(auth.uid(), 'organizer'));
create policy "organizer update events" on public.events for update to authenticated using (public.has_role(auth.uid(), 'organizer'));
create policy "organizer delete events" on public.events for delete to authenticated using (public.has_role(auth.uid(), 'organizer'));

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  attended boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
grant select, insert, update, delete on public.registrations to authenticated;
grant all on public.registrations to service_role;
alter table public.registrations enable row level security;
create policy "registrations read own or organizer" on public.registrations for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'organizer'));
create policy "register self" on public.registrations for insert to authenticated
  with check (user_id = auth.uid() and attended = false);
create policy "organizer update registrations" on public.registrations for update to authenticated
  using (public.has_role(auth.uid(), 'organizer'));
create policy "cancel own or organizer" on public.registrations for delete to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'organizer'));

create or replace function public.check_registration()
returns trigger language plpgsql security definer set search_path = public
as $$
declare ev public.events; taken int;
begin
  select * into ev from public.events where id = new.event_id for update;
  if ev.status <> 'active' then raise exception 'Este evento foi cancelado.'; end if;
  if ev.starts_at < now() then raise exception 'Este evento já aconteceu.'; end if;
  if ev.capacity is not null then
    select count(*) into taken from public.registrations where event_id = new.event_id;
    if taken >= ev.capacity then raise exception 'Não há mais vagas neste evento.'; end if;
  end if;
  return new;
end; $$;
create trigger registrations_check before insert on public.registrations
  for each row execute function public.check_registration();

create or replace function public.event_counts()
returns table(event_id uuid, total bigint) language sql stable security definer set search_path = public
as $$ select event_id, count(*) from public.registrations group by event_id $$;
grant execute on function public.event_counts() to authenticated;