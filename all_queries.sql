-- File: add_card_number_to_customers.sql

-- ============================================================
-- إضافة حقل رقم الكارت للعملاء
-- شغّل هذا السكريبت في محرر Supabase SQL
-- ============================================================

-- إضافة عمود رقم الكارت إذا لم يكن موجوداً
alter table if exists customers add column if not exists card_number text;

-- إذا كان العمود موجوداً بالفعل، فهذا سيعطي رسالة، لكن هذا طبيعي


-- File: create_cashiers_table.sql

-- ============================================================
-- Cashier Management Table & Schema Updates
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create the cashiers table
CREATE TABLE IF NOT EXISTS cashiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT,
  phone TEXT,
  photo_url TEXT, -- This will store the base64 image or a URL
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add cashier_name to orders table to track who made the sale
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cashier_name TEXT;

-- 3. Enable RLS (Row Level Security)
ALTER TABLE cashiers ENABLE ROW LEVEL SECURITY;

-- 4. Create "allow all" policy for cashiers (matching existing patterns)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cashiers' AND policyname = 'allow all'
    ) THEN
        CREATE POLICY "allow all" ON cashiers FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;


-- File: create_employees_schema.sql

-- ============================================================
-- مديول الموظفين - الرواتب والسلف
-- ============================================================

-- جدول الموظفين
create table if not exists employees (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  job_title text,
  working_hours text,
  monthly_salary numeric default 0,
  annual_leave_balance numeric not null default 0,
  hire_date date default current_date,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- جدول معاملات الموظفين (رواتب وسلف)
create table if not exists employee_transactions (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid references employees(id) on delete cascade,
  amount numeric not null,
  type text check (type in ('salary', 'advance', 'incentive')),
  payment_method text default 'cash',
  paid_cash numeric default 0,
  paid_visa numeric default 0,
  paid_wallet numeric default 0,
  paid_instapay numeric default 0,
  month text, -- تنسيق YYYY-MM
  note text,
  created_at timestamptz default now()
);

create table if not exists employee_leaves (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid references employees(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  days_count numeric not null default 1,
  leave_type text not null check (leave_type in ('paid', 'unpaid')),
  deduction_amount numeric not null default 0,
  month text,
  note text,
  created_at timestamptz default now()
);

-- تفعيل RLS
alter table employees enable row level security;
alter table employee_transactions enable row level security;
alter table employee_leaves enable row level security;

-- سياسات الوصول (مفتوحة حالياً)
create policy "allow all" on employees for all using (true) with check (true);
create policy "allow all" on employee_transactions for all using (true) with check (true);
create policy "allow all" on employee_leaves for all using (true) with check (true);


-- File: reset_and_seed_auto_parts.sql

-- ============================================================
-- سكريبت تصفير البيانات وإضافة منتجات قطع غيار سيارات
-- تحذير: هذا السكريبت سيقوم بحذف جميع البيانات الحالية!
-- ============================================================

-- 1. تصفير جميع الجداول (حذف البيانات)
truncate table order_items cascade;
truncate table orders cascade;
truncate table purchase_items cascade;
truncate table purchase_invoices cascade;
truncate table expenses cascade;
truncate table products cascade;
truncate table categories cascade;
truncate table customers cascade;
truncate table suppliers cascade;

-- 2. إعادة ضبط الـ Counter للفواتير
update invoice_counter set current_value = 1 where id = 1;

-- 3. إضافة فئات قطع الغيار
insert into categories (id, name) values 
  (gen_random_uuid(), 'فلاتر وزيوت'),
  (gen_random_uuid(), 'فرامل ونظام تعليق'),
  (gen_random_uuid(), 'كهرباء وبطاريات'),
  (gen_random_uuid(), 'محركات وميكانيكا');

-- 4. إضافة 12 منتج قطع غيار سيارات
-- ملاحظة: بنفترض إننا هنربطهم بأول فئة للتسهيل أو نوزعهم
with cat_list as (select id, name from categories)
insert into products (name, barcode, purchase_price, average_purchase_price, sale_price, stock_quantity, category_id)
values 
  ('تيل فرامل أمامي كوري', '1001', 450, 450, 650, 20, (select id from cat_list where name = 'فرامل ونظام تعليق')),
  ('فلتر زيت تويوتا أصلي', '1002', 120, 120, 180, 50, (select id from cat_list where name = 'فلاتر وزيوت')),
  ('طقم بوجيهات NGK ليزر', '1003', 350, 350, 480, 15, (select id from cat_list where name = 'كهرباء وبطاريات')),
  ('سير كاتينة دايكو', '1004', 280, 280, 420, 10, (select id from cat_list where name = 'محركات وميكانيكا')),
  ('مساعد خلفي KYB', '1005', 850, 850, 1100, 8, (select id from cat_list where name = 'فرامل ونظام تعليق')),
  ('بطارية كلورايد 70 أمبير', '1006', 1800, 1800, 2200, 5, (select id from cat_list where name = 'كهرباء وبطاريات')),
  ('طلمبة بنزين بوش', '1007', 650, 650, 950, 6, (select id from cat_list where name = 'محركات وميكانيكا')),
  ('فلتر هواء هيونداي', '1008', 150, 150, 220, 30, (select id from cat_list where name = 'فلاتر وزيوت')),
  ('طقم مقصات أمامي', '1009', 1400, 1400, 1900, 4, (select id from cat_list where name = 'فرامل ونظام تعليق')),
  ('رادياتير ألومنيوم', '1010', 950, 950, 1350, 3, (select id from cat_list where name = 'محركات وميكانيكا')),
  ('موبينة كهرباء ياباني', '1011', 550, 550, 780, 12, (select id from cat_list where name = 'كهرباء وبطاريات')),
  ('فانوس أمامي ليد', '1012', 1100, 1100, 1600, 4, (select id from cat_list where name = 'كهرباء وبطاريات'));


-- File: reset_transactions.sql

-- سكريبت تنظيف قاعدة البيانات من المعاملات المالية والفواتير
-- هذا السكريبت سيحذف كل الحركات (فواتير بيع، شراء، مصاريف، معاملات موظفين، إلخ)
-- مع الاحتفاظ بـ: المنتجات (والكميات الحالية فيها)، العملاء، الموردين، التصنيفات، الموظفين، وإعدادات المتجر

-- 1. مسح تفاصيل الفواتير (لأنها مرتبطة بالفواتير نفسها)
TRUNCATE TABLE order_items CASCADE;
TRUNCATE TABLE purchase_items CASCADE;

-- 2. مسح الفواتير الأساسية
TRUNCATE TABLE orders CASCADE;
TRUNCATE TABLE purchase_invoices CASCADE;

-- 3. مسح المصروفات
TRUNCATE TABLE expenses CASCADE;

-- 4. مسح حركات الموظفين
TRUNCATE TABLE employee_transactions CASCADE;
TRUNCATE TABLE employee_leaves CASCADE;

-- 5. مسح الحركات المالية للتمويل (مع الاحتفاظ بالحسابات التمويلية نفسها إن وجدت)
TRUNCATE TABLE financing_transactions CASCADE;
TRUNCATE TABLE financing_payments CASCADE;

-- 6. تصفير عداد الفواتير ليبدأ من رقم 1 مرة أخرى
UPDATE invoice_counter SET current_value = 1 WHERE id = 1;

-- ملاحظة: الـ CASCADE ستقوم بحذف أي سجلات مرتبطة بشكل تلقائي (إذا كانت هناك قيود)
-- المنتجات والكميات (المخزون)، العملاء، الموردين لن تتأثر بهذا السكريبت.


-- File: supabase_schema.sql

-- ============================================================
-- Cashier System - Supabase Schema
-- Run this entire script in Supabase SQL Editor once
-- ============================================================

-- جدول الإعدادات
create table if not exists store_settings (
  id uuid default gen_random_uuid() primary key,
  name text not null default 'محلي',
  currency text default 'ج.م',
  logo text default 'https://cdn-icons-png.flaticon.com/512/3143/3143641.png',
  tax_rate numeric default 0,
  theme_color text default '#4f46e5',
  address text default '',
  phone text default '',
  phone2 text default '',
  whatsapp_country_code text default '2'
);

-- إدخال صف الإعدادات الافتراضي
insert into store_settings (name, currency, tax_rate, theme_color)
values ('محل اللحوم الطازجة', 'ج.م', 0, '#4f46e5')
on conflict do nothing;

-- جدول الفئات
create table if not exists categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamptz default now()
);

-- إدخال بيانات افتراضية للفئات
insert into categories (name) values ('لحوم حمراء'), ('دواجن'), ('أسماك')
on conflict do nothing;

-- جدول المنتجات
create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  barcode text unique,
  purchase_price numeric default 0,
  average_purchase_price numeric default 0,
  sale_price numeric default 0,
  stock_quantity integer default 0,
  category_id uuid references categories(id) on delete set null,
  created_at timestamptz default now()
);

-- جدول العملاء
create table if not exists customers (
  id uuid default gen_random_uuid() primary key,
  custom_id text unique,
  name text not null default 'بدون اسم',
  phone text unique not null,
  card_number text,
  created_at timestamptz default now()
);

-- جدول الموردين
create table if not exists suppliers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text,
  address text,
  created_at timestamptz default now()
);

-- جدول فواتير المشتريات
create table if not exists purchase_invoices (
  id uuid default gen_random_uuid() primary key,
  invoice_number text not null,
  supplier_id uuid references suppliers(id) on delete set null,
  total numeric not null default 0,
  paid_amount numeric default 0,
  created_at timestamptz default now()
);

-- جدول عناصر فواتير المشتريات
create table if not exists purchase_items (
  id uuid default gen_random_uuid() primary key,
  invoice_id uuid references purchase_invoices(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  quantity integer not null default 1,
  purchase_price numeric not null default 0
);

-- جدول الفواتير
create table if not exists orders (
  id text primary key,
  total numeric not null default 0,
  paid_amount numeric default 0,
  type text default 'sale',
  customer_id uuid references customers(id) on delete set null,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deletion_reason text,
  created_at timestamptz default now()
);

-- Counter للفواتير
create table if not exists invoice_counter (
  id int primary key default 1,
  current_value integer default 1,
  check (id = 1)  -- صف واحد فقط
);
insert into invoice_counter (id, current_value) values (1, 1)
on conflict (id) do nothing;

-- جدول بنود الفاتورة
create table if not exists order_items (
  id uuid default gen_random_uuid() primary key,
  order_id text references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  barcode text,
  quantity integer default 1,
  returned_quantity integer default 0,
  refunded_amount numeric default 0,
  sale_price numeric default 0,
  purchase_price numeric default 0
);

-- جدول المصروفات
create table if not exists expenses (
  id uuid default gen_random_uuid() primary key,
  category text not null,
  amount numeric not null default 0,
  note text,
  created_at timestamptz default now()
);

-- جدول السلف والجمعيات
create table if not exists financing_accounts (
  id uuid default gen_random_uuid() primary key,
  type text not null default 'loan',
  lender_name text not null,
  lender_phone text default '',
  lender_details text default '',
  description text default '',
  principal_amount numeric not null default 0,
  collection_amount numeric not null default 0,
  collection_date date not null,
  installment_count integer not null default 1,
  status text not null default 'open',
  created_at timestamptz default now()
);

create table if not exists financing_payments (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references financing_accounts(id) on delete cascade,
  payment_type text not null,
  due_date date not null,
  amount numeric not null default 0,
  paid_amount numeric not null default 0,
  remaining_amount numeric not null default 0,
  status text not null default 'pending',
  paid_at timestamptz,
  expense_id uuid references expenses(id) on delete set null,
  note text,
  created_at timestamptz default now()
);

create table if not exists financing_transactions (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references financing_accounts(id) on delete cascade,
  payment_id uuid references financing_payments(id) on delete cascade,
  transaction_type text not null,
  amount numeric not null default 0,
  remaining_after numeric not null default 0,
  payment_method text not null default 'cash',
  expense_id uuid references expenses(id) on delete set null,
  note text,
  created_at timestamptz default now()
);

-- ============================================================
-- تفعيل RLS (Row Level Security)
-- ============================================================
alter table store_settings enable row level security;
alter table products enable row level security;
alter table categories enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table invoice_counter enable row level security;
alter table expenses enable row level security;
alter table financing_accounts enable row level security;
alter table financing_payments enable row level security;
alter table financing_transactions enable row level security;
alter table suppliers enable row level security;
alter table purchase_invoices enable row level security;
alter table purchase_items enable row level security;

-- سياسة مفتوحة مؤقتاً (عدّلها لاحقاً عند إضافة Auth)
create policy "allow all" on store_settings for all using (true) with check (true);
create policy "allow all" on products for all using (true) with check (true);
create policy "allow all" on categories for all using (true) with check (true);
create policy "allow all" on customers for all using (true) with check (true);
create policy "allow all" on orders for all using (true) with check (true);
create policy "allow all" on order_items for all using (true) with check (true);
create policy "allow all" on invoice_counter for all using (true) with check (true);
create policy "allow all" on expenses for all using (true) with check (true);
create policy "allow all" on financing_accounts for all using (true) with check (true);
create policy "allow all" on financing_payments for all using (true) with check (true);
create policy "allow all" on financing_transactions for all using (true) with check (true);
create policy "allow all" on suppliers for all using (true) with check (true);
create policy "allow all" on purchase_invoices for all using (true) with check (true);
create policy "allow all" on purchase_items for all using (true) with check (true);


-- File: update_deleted_invoices_schema.sql

-- Add soft-delete fields for sales invoices.
-- Run this once in Supabase SQL Editor before deleting invoices from the app.

alter table orders add column if not exists is_deleted boolean not null default false;
alter table orders add column if not exists deleted_at timestamptz;
alter table orders add column if not exists deletion_reason text;

create index if not exists idx_orders_is_deleted on orders(is_deleted);
create index if not exists idx_orders_deleted_at on orders(deleted_at);


-- File: update_employees_deductions.sql

-- إضافة حقل الخصومات لجدول معاملات الموظفين
alter table employee_transactions add column if not exists deductions numeric default 0;


-- File: update_employees_phone.sql

-- إضافة رقم الهاتف لجدول الموظفين
alter table employees add column if not exists phone text;


-- File: update_employee_leaves_schema.sql

-- Add employee leave balances, leave log, and incentives.
-- Run this once in Supabase SQL Editor before using employee vacations.

alter table employees add column if not exists annual_leave_balance numeric not null default 0;
alter table employees add column if not exists hire_date date default current_date;

alter table employee_transactions drop constraint if exists employee_transactions_type_check;
alter table employee_transactions
  add constraint employee_transactions_type_check
  check (type in ('salary', 'advance', 'incentive'));

create table if not exists employee_leaves (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid references employees(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  days_count numeric not null default 1,
  leave_type text not null check (leave_type in ('paid', 'unpaid')),
  deduction_amount numeric not null default 0,
  month text,
  note text,
  created_at timestamptz default now()
);

create index if not exists idx_employee_leaves_employee_id on employee_leaves(employee_id);
create index if not exists idx_employee_leaves_month on employee_leaves(month);
create index if not exists idx_employee_leaves_start_date on employee_leaves(start_date);

alter table employee_leaves enable row level security;

drop policy if exists "allow all" on employee_leaves;
create policy "allow all" on employee_leaves for all using (true) with check (true);


-- File: update_employee_status_schema.sql

-- Add active/inactive status for employees.
-- Run this once in Supabase SQL Editor before using employee status filters.

alter table employees add column if not exists is_active boolean not null default true;

create index if not exists idx_employees_is_active on employees(is_active);


-- File: update_finance_schema.sql

-- ============================================================
-- تحديث نظام الخزينة والميزانية اليومية
-- ============================================================

-- 1. إضافة طريقة الدفع للجداول الأساسية
alter table orders add column if not exists payment_method text default 'cash';
alter table expenses add column if not exists payment_method text default 'cash';
alter table purchase_invoices add column if not exists payment_method text default 'cash';

-- 2. إضافة رصيد البداية للنظام في الإعدادات
alter table store_settings add column if not exists initial_balance numeric default 0;


-- File: update_financing_schema.sql

-- ============================================================
-- Financing module: loans and associations
-- Run once in Supabase SQL Editor.
-- ============================================================

create table if not exists financing_accounts (
  id uuid default gen_random_uuid() primary key,
  type text not null default 'loan',
  lender_name text not null,
  lender_phone text default '',
  lender_details text default '',
  description text default '',
  principal_amount numeric not null default 0,
  collection_amount numeric not null default 0,
  collection_date date not null,
  installment_count integer not null default 1,
  status text not null default 'open',
  created_at timestamptz default now()
);

create table if not exists financing_payments (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references financing_accounts(id) on delete cascade,
  payment_type text not null,
  due_date date not null,
  amount numeric not null default 0,
  paid_amount numeric not null default 0,
  remaining_amount numeric not null default 0,
  status text not null default 'pending',
  paid_at timestamptz,
  expense_id uuid references expenses(id) on delete set null,
  note text,
  created_at timestamptz default now()
);

create table if not exists financing_transactions (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references financing_accounts(id) on delete cascade,
  payment_id uuid references financing_payments(id) on delete cascade,
  transaction_type text not null,
  amount numeric not null default 0,
  remaining_after numeric not null default 0,
  payment_method text not null default 'cash',
  expense_id uuid references expenses(id) on delete set null,
  note text,
  created_at timestamptz default now()
);

alter table financing_payments add column if not exists paid_amount numeric not null default 0;
alter table financing_payments add column if not exists remaining_amount numeric not null default 0;

update financing_payments
set remaining_amount = greatest(0, amount - coalesce(paid_amount, 0))
where remaining_amount = 0 and status <> 'paid';

alter table financing_accounts enable row level security;
alter table financing_payments enable row level security;
alter table financing_transactions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'financing_accounts'
      and policyname = 'allow all'
  ) then
    create policy "allow all" on financing_accounts for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'financing_payments'
      and policyname = 'allow all'
  ) then
    create policy "allow all" on financing_payments for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'financing_transactions'
      and policyname = 'allow all'
  ) then
    create policy "allow all" on financing_transactions for all using (true) with check (true);
  end if;
end $$;


-- File: update_refunded_amount_schema.sql

-- Add the actual refunded cash amount per returned invoice item.
-- Run this once in Supabase SQL Editor if older databases only have returned_quantity.

alter table order_items
add column if not exists refunded_amount numeric default 0;

update order_items
set refunded_amount = 0
where refunded_amount is null;


