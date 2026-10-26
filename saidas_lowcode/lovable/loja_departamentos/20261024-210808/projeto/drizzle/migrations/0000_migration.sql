
create type public.app_role as enum ('admin','user');
create type public.order_status as enum ('pendente','pago','enviado','entregue','cancelado');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
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

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
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
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null default 'Geral',
  price numeric(10,2) not null default 0,
  stock integer not null default 0,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.products to anon;
grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "anyone reads active" on public.products for select to anon, authenticated using (active or public.has_role(auth.uid(),'admin'));
create policy "admin insert" on public.products for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin update" on public.products for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin delete" on public.products for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);
grant select, insert, update, delete on public.cart_items to authenticated;
grant all on public.cart_items to service_role;
alter table public.cart_items enable row level security;
create policy "own cart" on public.cart_items for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  customer_name text not null,
  address text not null,
  phone text not null default '',
  total numeric(10,2) not null default 0,
  status order_status not null default 'pendente',
  created_at timestamptz not null default now()
);
grant select, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "read own or admin" on public.orders for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin updates" on public.orders for update to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10,2) not null,
  quantity integer not null
);
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "read items" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

create or replace function public.place_order(_customer_name text, _address text, _phone text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _order uuid; _total numeric := 0; r record;
begin
  if _uid is null then raise exception 'Faça login'; end if;
  if coalesce(trim(_customer_name),'') = '' or coalesce(trim(_address),'') = '' then raise exception 'Preencha nome e endereço'; end if;
  if not exists (select 1 from cart_items where user_id = _uid) then raise exception 'Carrinho vazio'; end if;
  for r in select c.quantity as qty, p.name, p.active, p.stock, p.price from cart_items c join products p on p.id = c.product_id where c.user_id = _uid for update of p loop
    if not r.active then raise exception 'Produto indisponível: %', r.name; end if;
    if r.stock < r.qty then raise exception 'Estoque insuficiente: %', r.name; end if;
    _total := _total + r.price * r.qty;
  end loop;
  insert into orders (user_id, customer_name, address, phone, total) values (_uid, _customer_name, _address, coalesce(_phone,''), _total) returning id into _order;
  insert into order_items (order_id, product_id, product_name, unit_price, quantity)
    select _order, p.id, p.name, p.price, c.quantity from cart_items c join products p on p.id = c.product_id where c.user_id = _uid;
  update products p set stock = p.stock - c.quantity from cart_items c where c.product_id = p.id and c.user_id = _uid;
  delete from cart_items where user_id = _uid;
  return _order;
end; $$;
revoke execute on function public.place_order(text,text,text) from anon, public;
grant execute on function public.place_order(text,text,text) to authenticated;

insert into public.products (name, description, category, price, stock, image_url) values
('Fone de Ouvido Bluetooth','Som envolvente, bateria de 30 horas e cancelamento de ruído.','Eletrônicos',299.90,25,'/products/fone.jpg'),
('Smartwatch Esportivo','Monitor cardíaco, GPS e resistente à água.','Eletrônicos',549.00,15,'/products/relogio.jpg'),
('Tênis de Corrida','Leve, confortável e com amortecimento responsivo.','Moda',389.90,30,'/products/tenis.jpg'),
('Jaqueta Jeans','Clássica, em algodão resistente, combina com tudo.','Moda',219.90,20,'/products/jaqueta.jpg'),
('Cafeteira Elétrica','Prepara até 12 xícaras com timer programável.','Casa',189.90,18,'/products/cafeteira.jpg'),
('Jogo de Panelas Antiaderente','5 peças com tampas de vidro.','Casa',349.00,12,'/products/panelas.jpg'),
('Bola de Futebol Oficial','Costurada, tamanho oficial, para campo.','Esportes',129.90,40,'/products/bola.jpg'),
('Kit Skincare','Limpeza, hidratação e proteção diária.','Beleza',159.90,22,'/products/skincare.jpg');
