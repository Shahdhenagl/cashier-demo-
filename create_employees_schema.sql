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
  created_at timestamptz default now()
);

-- جدول معاملات الموظفين (رواتب وسلف)
create table if not exists employee_transactions (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid references employees(id) on delete cascade,
  amount numeric not null,
  type text check (type in ('salary', 'advance')),
  payment_method text default 'cash',
  paid_cash numeric default 0,
  paid_visa numeric default 0,
  paid_wallet numeric default 0,
  paid_instapay numeric default 0,
  month text, -- تنسيق YYYY-MM
  note text,
  created_at timestamptz default now()
);

-- تفعيل RLS
alter table employees enable row level security;
alter table employee_transactions enable row level security;

-- سياسات الوصول (مفتوحة حالياً)
create policy "allow all" on employees for all using (true) with check (true);
create policy "allow all" on employee_transactions for all using (true) with check (true);
