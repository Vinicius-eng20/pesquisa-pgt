create type public.app_role as enum ('librarian', 'reader');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  blocked boolean not null default false,
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

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'librarian'));
create policy "read own profile or librarian" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'librarian'));
create policy "librarian updates profiles" on public.profiles for update to authenticated using (public.has_role(auth.uid(),'librarian'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), coalesce(new.email,''));
  if not exists (select 1 from public.user_roles where role = 'librarian') then
    insert into public.user_roles (user_id, role) values (new.id, 'librarian');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'reader');
  end if;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null default '',
  kind text not null default 'Livro',
  year int,
  description text not null default '',
  copies int not null default 1 check (copies >= 0),
  created_at timestamptz not null default now()
);
grant select on public.items to authenticated;
grant insert, update, delete on public.items to authenticated;
grant all on public.items to service_role;
alter table public.items enable row level security;
create policy "all read items" on public.items for select to authenticated using (true);
create policy "librarian insert items" on public.items for insert to authenticated with check (public.has_role(auth.uid(),'librarian'));
create policy "librarian update items" on public.items for update to authenticated using (public.has_role(auth.uid(),'librarian'));
create policy "librarian delete items" on public.items for delete to authenticated using (public.has_role(auth.uid(),'librarian'));

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.items(id) on delete set null,
  item_title text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  borrowed_at timestamptz not null default now(),
  due_at timestamptz not null default now() + interval '14 days',
  returned_at timestamptz
);
grant select on public.loans to authenticated;
grant all on public.loans to service_role;
alter table public.loans enable row level security;
create policy "own or librarian loans" on public.loans for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'librarian'));

create or replace function public.available_copies(_item uuid)
returns int language sql stable security definer set search_path = public as $$
  select greatest(0, (select copies from public.items where id = _item) - (select count(*)::int from public.loans where item_id = _item and returned_at is null))
$$;
grant execute on function public.available_copies(uuid) to authenticated;

create or replace function public.borrow_item(_item uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid; _title text;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  if (select blocked from public.profiles where id = auth.uid()) then
    raise exception 'Seus empréstimos estão bloqueados. Procure o bibliotecário.';
  end if;
  perform 1 from public.items where id = _item for update;
  select title into _title from public.items where id = _item;
  if _title is null then raise exception 'Item não encontrado'; end if;
  if exists (select 1 from public.loans where item_id = _item and user_id = auth.uid() and returned_at is null) then
    raise exception 'Você já está com este item';
  end if;
  if public.available_copies(_item) <= 0 then raise exception 'Nenhum exemplar disponível no momento'; end if;
  insert into public.loans (item_id, item_title, user_id) values (_item, _title, auth.uid()) returning id into _id;
  return _id;
end; $$;
grant execute on function public.borrow_item(uuid) to authenticated;

create or replace function public.return_loan(_loan uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.loans set returned_at = now()
  where id = _loan and returned_at is null
    and (user_id = auth.uid() or public.has_role(auth.uid(),'librarian'));
  if not found then raise exception 'Empréstimo não encontrado'; end if;
end; $$;
grant execute on function public.return_loan(uuid) to authenticated;

insert into public.items (title, author, kind, year, description, copies) values
('Dom Casmurro','Machado de Assis','Livro',1899,'Bentinho revisita a juventude e o ciúme que marcou seu casamento com Capitu.',3),
('Grande Sertão: Veredas','João Guimarães Rosa','Livro',1956,'A travessia de Riobaldo pelo sertão, entre jagunços, amor e o diabo.',2),
('A Hora da Estrela','Clarice Lispector','Livro',1977,'A história de Macabéa, nordestina no Rio de Janeiro.',2),
('Vidas Secas','Graciliano Ramos','Livro',1938,'Uma família de retirantes enfrenta a seca do sertão.',2),
('O Cortiço','Aluísio Azevedo','Livro',1890,'Retrato naturalista da vida em um cortiço carioca.',1),
('Central do Brasil','Walter Salles','Filme (DVD)',1998,'Dora e o menino Josué cruzam o país em busca do pai dele.',1),
('Revista Piauí — edição 200','Vários autores','Revista',2023,'Reportagens e ensaios de longo fôlego.',1),
('Atlas Geográfico Escolar','IBGE','Livro',2016,'Mapas do Brasil e do mundo.',2);