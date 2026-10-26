create type public.app_role as enum ('admin','user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
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
  unique (user_id, role)
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

create policy "own or admin read profiles" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin updates profiles" on public.profiles for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "own roles read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "read categories" on public.categories for select to authenticated using (true);
create policy "admin insert categories" on public.categories for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin update categories" on public.categories for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin delete categories" on public.categories for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  category_id uuid references public.categories(id) on delete set null,
  description text not null default '',
  amount numeric(12,2) not null check (amount > 0),
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index on public.expenses (user_id, spent_on);
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;
create policy "own read expenses" on public.expenses for select to authenticated
  using (user_id = auth.uid() and public.is_active(auth.uid()));
create policy "own insert expenses" on public.expenses for insert to authenticated
  with check (user_id = auth.uid() and public.is_active(auth.uid()));
create policy "own update expenses" on public.expenses for update to authenticated
  using (user_id = auth.uid() and public.is_active(auth.uid()));
create policy "own delete expenses" on public.expenses for delete to authenticated
  using (user_id = auth.uid() and public.is_active(auth.uid()));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), coalesce(new.email,''));
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.admin_user_totals(_month date default null)
returns table (user_id uuid, full_name text, email text, active boolean, total numeric, month_total numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'forbidden'; end if;
  return query
    select p.id, p.full_name, p.email, p.active,
      coalesce(sum(e.amount),0)::numeric,
      coalesce(sum(e.amount) filter (where date_trunc('month', e.spent_on) = date_trunc('month', coalesce(_month, current_date))),0)::numeric
    from public.profiles p left join public.expenses e on e.user_id = p.id
    group by p.id order by p.created_at;
end; $$;

insert into public.categories (name) values ('Alimentação'),('Transporte'),('Moradia'),('Saúde'),('Lazer'),('Educação'),('Outros');