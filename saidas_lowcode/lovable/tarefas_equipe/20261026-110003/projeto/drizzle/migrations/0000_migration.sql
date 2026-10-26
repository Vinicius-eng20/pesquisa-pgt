create type public.app_role as enum ('manager', 'member');
create type public.task_status as enum ('pendente', 'em_andamento', 'concluida');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
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
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "Team can view profiles" on public.profiles for select to authenticated using (true);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users view own roles or manager views all" on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'manager'));

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  status task_status not null default 'pendente',
  assigned_to uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;
alter table public.tasks enable row level security;

create policy "View tasks" on public.tasks for select to authenticated
  using (public.has_role(auth.uid(), 'manager') or assigned_to = auth.uid());
create policy "Create tasks" on public.tasks for insert to authenticated
  with check (created_by = auth.uid() and (public.has_role(auth.uid(), 'manager') or assigned_to = auth.uid()));
create policy "Update tasks" on public.tasks for update to authenticated
  using (public.has_role(auth.uid(), 'manager') or assigned_to = auth.uid())
  with check (public.has_role(auth.uid(), 'manager') or assigned_to = auth.uid());
create policy "Delete tasks" on public.tasks for delete to authenticated
  using (public.has_role(auth.uid(), 'manager'));

-- Members may only change status on tasks not created by themselves
create or replace function public.guard_task_update()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  new.updated_at := now();
  if public.has_role(auth.uid(), 'manager') then return new; end if;
  if new.assigned_to <> old.assigned_to or new.created_by <> old.created_by then
    raise exception 'Sem permissão para reatribuir tarefas';
  end if;
  if old.created_by <> auth.uid() and (new.title <> old.title or new.description <> old.description or new.due_date is distinct from old.due_date) then
    raise exception 'Você só pode mudar a situação desta tarefa';
  end if;
  return new;
end; $$;
create trigger tasks_guard before update on public.tasks for each row execute function public.guard_task_update();

-- New user: profile + role (first user becomes manager)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), coalesce(new.email, ''));
  if not exists (select 1 from public.user_roles where role = 'manager') then
    insert into public.user_roles (user_id, role) values (new.id, 'manager');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'member');
  end if;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter publication supabase_realtime add table public.tasks;