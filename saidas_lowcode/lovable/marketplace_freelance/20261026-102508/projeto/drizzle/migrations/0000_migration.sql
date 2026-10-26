
create type public.app_role as enum ('admin','user');
create type public.service_status as enum ('pending','approved','removed');
create type public.contract_status as enum ('requested','accepted','completed','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  suspended boolean not null default false,
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

create or replace function public.is_active(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = _user_id and not suspended) $$;

create policy "read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "update own name" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "admin update profiles" on public.profiles for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- prevent users from changing their own suspended flag
create or replace function public.protect_suspended()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.suspended is distinct from old.suspended and not public.has_role(auth.uid(),'admin') then
    raise exception 'Not allowed';
  end if;
  if new.id = auth.uid() and new.suspended and public.has_role(auth.uid(),'admin') then
    raise exception 'Admins cannot suspend themselves';
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_suspended();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.services (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null default 'Outros',
  price numeric(10,2) not null check (price >= 0),
  status service_status not null default 'pending',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;

create policy "see approved, own, or admin" on public.services for select to authenticated
  using (status = 'approved' or owner_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "active users publish" on public.services for insert to authenticated
  with check (owner_id = auth.uid() and status = 'pending' and public.is_active(auth.uid()));
create policy "owner deletes" on public.services for delete to authenticated
  using (owner_id = auth.uid());
create policy "admin updates" on public.services for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  price numeric(10,2) not null,
  message text not null default '',
  status contract_status not null default 'requested',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.contracts to authenticated;
grant all on public.contracts to service_role;
alter table public.contracts enable row level security;

create policy "participants or admin read" on public.contracts for select to authenticated
  using (client_id = auth.uid() or provider_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "participants update" on public.contracts for update to authenticated
  using ((client_id = auth.uid() or provider_id = auth.uid()) and public.is_active(auth.uid()))
  with check (client_id = auth.uid() or provider_id = auth.uid());

-- hiring goes through a function so price/provider come from the service
create or replace function public.hire_service(_service_id uuid, _message text)
returns uuid language plpgsql security definer set search_path = public as $$
declare s public.services; cid uuid;
begin
  if not public.is_active(auth.uid()) then raise exception 'Conta suspensa'; end if;
  select * into s from public.services where id = _service_id and status = 'approved';
  if not found then raise exception 'Serviço indisponível'; end if;
  if s.owner_id = auth.uid() then raise exception 'Você não pode contratar seu próprio serviço'; end if;
  insert into public.contracts (service_id, client_id, provider_id, price, message)
  values (s.id, auth.uid(), s.owner_id, s.price, coalesce(_message,''))
  returning id into cid;
  return cid;
end $$;
grant execute on function public.hire_service(uuid, text) to authenticated;

-- status transitions: provider accepts/completes, either cancels
create or replace function public.check_contract_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.service_id <> old.service_id or new.client_id <> old.client_id or new.provider_id <> old.provider_id
     or new.price <> old.price or new.message <> old.message then
    raise exception 'Not allowed';
  end if;
  if new.status in ('accepted','completed') and auth.uid() <> old.provider_id then
    raise exception 'Apenas o prestador pode aceitar ou concluir';
  end if;
  return new;
end $$;
create trigger contracts_check before update on public.contracts
  for each row execute function public.check_contract_update();
