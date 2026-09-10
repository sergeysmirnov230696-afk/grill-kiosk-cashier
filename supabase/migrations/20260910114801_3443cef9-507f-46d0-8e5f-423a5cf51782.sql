
-- roles
create type public.app_role as enum ('admin','manager','cashier');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort int not null default 0,
  color text not null default 'default',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "staff manage categories" on public.categories for all to authenticated using (true) with check (true);

-- products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  price integer not null default 0,
  cost integer not null default 0,
  unit text not null default 'шт',
  image_url text,
  emoji text,
  is_active boolean not null default true,
  in_stop_list boolean not null default false,
  track_stock boolean not null default false,
  stock numeric not null default 0,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "staff manage products" on public.products for all to authenticated using (true) with check (true);
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();

-- modifiers
create table public.modifiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price integer not null default 0,
  category_id uuid references public.categories(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.modifiers to authenticated;
grant all on public.modifiers to service_role;
alter table public.modifiers enable row level security;
create policy "staff manage modifiers" on public.modifiers for all to authenticated using (true) with check (true);

-- employees
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin text not null,
  role app_role not null default 'cashier',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.employees to authenticated;
grant all on public.employees to service_role;
alter table public.employees enable row level security;
create policy "staff manage employees" on public.employees for all to authenticated using (true) with check (true);

-- shifts
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  opened_by uuid,
  cash_start integer not null default 0,
  cash_end integer,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  status text not null default 'open',
  note text
);
grant select, insert, update, delete on public.shifts to authenticated;
grant all on public.shifts to service_role;
alter table public.shifts enable row level security;
create policy "staff manage shifts" on public.shifts for all to authenticated using (true) with check (true);

-- orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigint generated always as identity,
  shift_id uuid references public.shifts(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  created_by uuid,
  subtotal integer not null default 0,
  discount integer not null default 0,
  total integer not null default 0,
  payment_method text not null default 'cash',
  cash_amount integer not null default 0,
  card_amount integer not null default 0,
  cash_received integer not null default 0,
  change_given integer not null default 0,
  status text not null default 'paid',
  note text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "staff manage orders" on public.orders for all to authenticated using (true) with check (true);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  price integer not null default 0,
  qty numeric not null default 1,
  modifiers jsonb not null default '[]'::jsonb,
  total integer not null default 0
);
grant select, insert, update, delete on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "staff manage order items" on public.order_items for all to authenticated using (true) with check (true);

-- stock movements
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  qty numeric not null,
  type text not null default 'in',
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.stock_movements to authenticated;
grant all on public.stock_movements to service_role;
alter table public.stock_movements enable row level security;
create policy "staff manage stock" on public.stock_movements for all to authenticated using (true) with check (true);

create or replace function public.apply_stock_movement() returns trigger language plpgsql set search_path = public as $$
begin
  update public.products set stock = stock + new.qty where id = new.product_id;
  return new;
end; $$;
create trigger stock_movement_applied after insert on public.stock_movements for each row execute function public.apply_stock_movement();

-- settings
create table public.settings (
  id boolean primary key default true,
  shop_name text not null default 'Гриль & Донер',
  address text not null default 'г. Алматы',
  phone text not null default '',
  receipt_footer text not null default 'Спасибо за покупку!',
  vat_percent numeric not null default 0,
  updated_at timestamptz not null default now(),
  constraint settings_single_row check (id)
);
grant select, insert, update on public.settings to authenticated;
grant all on public.settings to service_role;
alter table public.settings enable row level security;
create policy "staff manage settings" on public.settings for all to authenticated using (true) with check (true);
insert into public.settings (id) values (true);

-- demo data
insert into public.categories (id, name, sort, color) values
  ('11111111-1111-1111-1111-111111111101','Куры гриль',1,'primary'),
  ('11111111-1111-1111-1111-111111111102','Донеры',2,'accent'),
  ('11111111-1111-1111-1111-111111111103','Гарниры',3,'default'),
  ('11111111-1111-1111-1111-111111111104','Соусы',4,'default'),
  ('11111111-1111-1111-1111-111111111105','Напитки',5,'default');

insert into public.products (name, category_id, price, cost, emoji, sort, track_stock, stock) values
  ('Кура гриль целая','11111111-1111-1111-1111-111111111101',3200,1900,'🍗',1,true,20),
  ('Кура гриль 1/2','11111111-1111-1111-1111-111111111101',1700,1000,'🍗',2,true,20),
  ('Кура гриль 1/4','11111111-1111-1111-1111-111111111101',950,550,'🍗',3,true,20),
  ('Крылья гриль (6 шт)','11111111-1111-1111-1111-111111111101',1500,850,'🍖',4,true,15),
  ('Окорочка гриль (2 шт)','11111111-1111-1111-1111-111111111101',1400,800,'🍖',5,true,15),
  ('Донер куриный','11111111-1111-1111-1111-111111111102',1300,700,'🌯',1,false,0),
  ('Донер говяжий','11111111-1111-1111-1111-111111111102',1600,900,'🌯',2,false,0),
  ('Донер XXL','11111111-1111-1111-1111-111111111102',2000,1100,'🌯',3,false,0),
  ('Донер в лаваше','11111111-1111-1111-1111-111111111102',1400,750,'🌯',4,false,0),
  ('Шаурма-бокс','11111111-1111-1111-1111-111111111102',1800,950,'🥙',5,false,0),
  ('Картофель фри','11111111-1111-1111-1111-111111111103',700,300,'🍟',1,false,0),
  ('Картофель по-деревенски','11111111-1111-1111-1111-111111111103',800,350,'🥔',2,false,0),
  ('Лаваш','11111111-1111-1111-1111-111111111103',150,60,'🫓',3,false,0),
  ('Салат свежий','11111111-1111-1111-1111-111111111103',600,250,'🥗',4,false,0),
  ('Соус чесночный','11111111-1111-1111-1111-111111111104',200,70,'🧄',1,false,0),
  ('Соус острый','11111111-1111-1111-1111-111111111104',200,70,'🌶️',2,false,0),
  ('Кетчуп','11111111-1111-1111-1111-111111111104',150,50,'🍅',3,false,0),
  ('Кола 0.5','11111111-1111-1111-1111-111111111105',450,220,'🥤',1,true,48),
  ('Фанта 0.5','11111111-1111-1111-1111-111111111105',450,220,'🥤',2,true,48),
  ('Вода 0.5','11111111-1111-1111-1111-111111111105',250,100,'💧',3,true,60),
  ('Чай','11111111-1111-1111-1111-111111111105',300,80,'🍵',4,false,0),
  ('Айран','11111111-1111-1111-1111-111111111105',400,180,'🥛',5,true,30);

insert into public.modifiers (name, price, category_id) values
  ('Острый',0,'11111111-1111-1111-1111-111111111102'),
  ('Без лука',0,'11111111-1111-1111-1111-111111111102'),
  ('Двойное мясо',500,'11111111-1111-1111-1111-111111111102'),
  ('Сыр',300,'11111111-1111-1111-1111-111111111102');

insert into public.employees (name, pin, role) values
  ('Айгуль','1234','cashier'),
  ('Ерлан','2345','cashier'),
  ('Менеджер','9999','manager');
