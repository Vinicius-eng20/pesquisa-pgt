create type public.app_role as enum ('admin','user');
create type public.order_status as enum ('recebido','preparando','pronto','entregue','cancelado');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
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

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null default 'Pratos',
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  available boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.dishes to anon;
grant select, insert, update, delete on public.dishes to authenticated;
grant all on public.dishes to service_role;
alter table public.dishes enable row level security;
create policy "anyone reads dishes" on public.dishes for select to anon, authenticated using (true);
create policy "admin insert dishes" on public.dishes for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin update dishes" on public.dishes for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin delete dishes" on public.dishes for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status order_status not null default 'recebido',
  total numeric(10,2) not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "read own or admin" on public.orders for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin updates orders" on public.orders for update to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  dish_id uuid,
  dish_name text not null,
  unit_price numeric(10,2) not null,
  quantity int not null check (quantity > 0)
);
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "read items of visible orders" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

create or replace function public.place_order(_items jsonb, _notes text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare _order uuid; _it jsonb; _d record; _total numeric := 0; _q int;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if jsonb_array_length(_items) = 0 then raise exception 'Pedido vazio'; end if;
  insert into public.orders (user_id, notes) values (auth.uid(), coalesce(_notes,'')) returning id into _order;
  for _it in select * from jsonb_array_elements(_items) loop
    _q := (_it->>'quantity')::int;
    if _q is null or _q < 1 or _q > 50 then raise exception 'Quantidade inválida'; end if;
    select * into _d from public.dishes where id = (_it->>'dish_id')::uuid and available;
    if not found then raise exception 'Prato indisponível'; end if;
    insert into public.order_items (order_id, dish_id, dish_name, unit_price, quantity) values (_order, _d.id, _d.name, _d.price, _q);
    _total := _total + _d.price * _q;
  end loop;
  update public.orders set total = _total where id = _order;
  return _order;
end; $$;
revoke execute on function public.place_order(jsonb, text) from anon, public;
grant execute on function public.place_order(jsonb, text) to authenticated;

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.dishes;

insert into public.dishes (name, description, category, price) values
('Feijoada Completa','Feijão preto com carnes, arroz, couve, farofa e laranja','Pratos',49.90),
('Moqueca de Peixe','Peixe no leite de coco e dendê, com arroz e pirão','Pratos',62.00),
('Picanha na Chapa','Picanha grelhada com arroz, feijão tropeiro e vinagrete','Pratos',68.50),
('Coxinha (6 un.)','Coxinhas de frango cremosas','Entradas',24.00),
('Pão de Queijo (10 un.)','Quentinho, direto do forno','Entradas',18.00),
('Pudim de Leite','Clássico, com calda de caramelo','Sobremesas',14.00),
('Suco de Maracujá','Natural, 500 ml','Bebidas',11.00),
('Guaraná Lata','350 ml','Bebidas',7.00);