-- Finlytics canonical schema for Supabase (Postgres)
-- Run this once in your Supabase project's SQL editor, then fill in
-- Project URL + anon key in js/config.js (or Settings > Supabase Connection).

create extension if not exists "uuid-ossp";

create table if not exists accounts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null default 'cash', -- cash | bank | credit_card | savings
  balance numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  date date not null default current_date,
  description text not null,
  category text not null default 'Other',
  account_id uuid references accounts(id) on delete set null,
  type text not null default 'expense', -- income | expense | transfer
  amount numeric not null,               -- positive = income, negative = expense
  source text not null default 'manual', -- manual | csv | voice | ai
  created_at timestamptz not null default now()
);

create table if not exists budgets (
  id uuid primary key default uuid_generate_v4(),
  category text not null,
  monthly_limit numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists goals (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  target_amount numeric not null,
  saved_amount numeric not null default 0,
  target_date date,
  created_at timestamptz not null default now()
);

create table if not exists recurring_items (
  id uuid primary key default uuid_generate_v4(),
  description text not null,
  category text not null default 'Other',
  amount numeric not null,
  frequency text not null default 'monthly', -- weekly | monthly | yearly
  next_date date,
  created_at timestamptz not null default now()
);

create table if not exists saved_reports (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  question text not null,
  sql_text text,
  created_at timestamptz not null default now()
);

-- Read-only role suggestion for the assistant's generated SQL:
-- create role finlytics_reader login password 'change-me';
-- grant select on all tables in schema public to finlytics_reader;

alter table accounts enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table goals enable row level security;
alter table recurring_items enable row level security;
alter table saved_reports enable row level security;

-- Simple open policies for a single-user local app. Tighten before
-- multi-user / multi-tenant use.
create policy "allow all accounts" on accounts for all using (true) with check (true);
create policy "allow all transactions" on transactions for all using (true) with check (true);
create policy "allow all budgets" on budgets for all using (true) with check (true);
create policy "allow all goals" on goals for all using (true) with check (true);
create policy "allow all recurring" on recurring_items for all using (true) with check (true);
create policy "allow all reports" on saved_reports for all using (true) with check (true);
