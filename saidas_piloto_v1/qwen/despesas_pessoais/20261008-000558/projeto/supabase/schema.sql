-- RODE ESTE BLOCO uma única vez na aba SQL Editor do Supabase (veja README).
-- Cria todas as tabelas e regras de segurança.

create table public.users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  email text unique not null,
  password_hash text not null,
  is_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  color text not null default '#64748B',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  description text not null,
  amount_cents integer not null check (amount_cents >= 0),
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index expenses_user_spent_idx on public.expenses (user_id, spent_on);
create index expenses_category_idx on public.expenses (category_id);

-- Permite apenas leitura para quem se autenticou; escrita é feita pelo servidor.
alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;

create policy "read users" on public.users for select using (auth.role() = 'authenticated');
create policy "read categories" on public.categories for select using (auth.role() = 'authenticated');
create policy "read own expenses" on public.expenses for select using (auth.uid() = user_id);
