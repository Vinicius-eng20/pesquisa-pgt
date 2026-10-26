create type public.app_role as enum ('admin','student');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
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

create policy "own roles readable" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  instructor text not null default '',
  workload_hours integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.courses to authenticated;
grant all on public.courses to service_role;
alter table public.courses enable row level security;
create policy "courses readable" on public.courses for select to authenticated using (true);
create policy "admin insert courses" on public.courses for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin update courses" on public.courses for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin delete courses" on public.courses for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);
grant select, insert, delete on public.enrollments to authenticated;
grant all on public.enrollments to service_role;
alter table public.enrollments enable row level security;
create policy "read own or admin" on public.enrollments for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "enroll self" on public.enrollments for insert to authenticated with check (user_id = auth.uid());
create policy "admin cancel" on public.enrollments for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), coalesce(new.email,''));
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'student');
  end if;
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.courses (title, description, instructor, workload_hours) values
('Introdução à Programação', 'Aprenda lógica e os primeiros passos para criar programas.', 'Ana Ribeiro', 20),
('Excel do Zero ao Avançado', 'Planilhas, fórmulas, gráficos e tabelas dinâmicas.', 'Carlos Mendes', 30),
('Marketing Digital', 'Redes sociais, anúncios e estratégias para crescer online.', 'Juliana Costa', 25);