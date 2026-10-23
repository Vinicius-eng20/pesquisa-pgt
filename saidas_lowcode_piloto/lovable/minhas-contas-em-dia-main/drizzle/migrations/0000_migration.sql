create type public.app_role as enum ('admin','user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_active(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select active from public.profiles where id = _user_id), false)
$$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create policy "read own or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin updates" on public.profiles for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "everyone reads categories" on public.categories for select to authenticated using (true);
create policy "admin inserts categories" on public.categories for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin updates categories" on public.categories for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin deletes categories" on public.categories for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  category_id uuid references public.categories(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index on public.expenses(user_id, spent_on);
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;
create policy "read own or admin" on public.expenses for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "insert own if active" on public.expenses for insert to authenticated
  with check (user_id = auth.uid() and public.is_active(auth.uid()));
create policy "update own if active" on public.expenses for update to authenticated
  using (user_id = auth.uid() and public.is_active(auth.uid()));
create policy "delete own if active" on public.expenses for delete to authenticated
  using (user_id = auth.uid() and public.is_active(auth.uid()));

-- signup: create profile; first user becomes admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- prevent admin from deactivating themselves
create or replace function public.protect_self_deactivate()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.id = auth.uid() and new.active = false then
    raise exception 'Você não pode desativar a sua própria conta';
  end if;
  return new;
end; $$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_self_deactivate();

insert into public.categories (name) values
 ('Alimentação'),('Transporte'),('Moradia'),('Saúde'),('Lazer'),('Educação'),('Outros');