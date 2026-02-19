-- =============================================
-- SALAAR BANK FRAUD DETECTION SYSTEM
-- COMPREHENSIVE MIGRATION + SEED SCRIPT
-- =============================================

-- 1. CLEANUP (Drop everything to start fresh)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user;

DROP TABLE IF EXISTS public.fraud_alerts CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;

-- 2. CREATE TABLES
create table public.profiles (
  id uuid primary key, -- No FK to auth.users for demo to allow manual seeding
  email text,
  full_name text,
  role text default 'user' check (role in ('user', 'investigator', 'hacker', 'admin')),
  created_at timestamptz default now()
);

create table public.accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  account_number text unique not null,
  balance decimal(12,2) default 100000.00,
  is_frozen boolean default false,
  risk_score int default 0,
  created_at timestamptz default now()
);

create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  from_account_id uuid references public.accounts(id),
  to_account_number text not null,
  amount decimal(12,2) not null,
  status text default 'completed',
  ip_address text,
  subnet_mask text default '255.255.255.0',
  device_id text,
  device_name text,
  imei text,
  location text,
  timestamp timestamptz default now()
);

create table public.fraud_alerts (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.accounts(id),
  risk_score int,
  alert_type text,
  status text default 'open',
  created_at timestamptz default now()
);

create table public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid, -- Profile ID of the person performing the action
  action text not null, -- e.g. 'view_graph', 'search_entity', 'resolve_alert'
  resource_id text, -- ID of the account, transaction, or profile being accessed
  ip_address text,
  user_agent text,
  timestamp timestamptz default now()
);

-- 3. DISABLE RLS FOR DEMO (To bypass auth complications during demo)
alter table public.profiles disable row level security;
alter table public.accounts disable row level security;
alter table public.transactions disable row level security;
alter table public.fraud_alerts disable row level security;
alter table public.audit_logs disable row level security;

-- 4. INSERT SEED DATA (The "Golden Set")
-- Using fixed IDs that match our LoginPage.tsx
insert into public.profiles (id, email, full_name, role) values
('a0000000-0000-0000-0000-000000000001', 'alice@demo.com', 'Alice User 1', 'user'),
('a0000000-0000-0000-0000-000000000002', 'bob@demo.com', 'Bob User 2', 'user'),
('a0000000-0000-0000-0000-000000000003', 'charlie@demo.com', 'Charlie User 3', 'user'),
('a0000000-0000-0000-0000-000000000004', 'david@demo.com', 'David User 4', 'user'),
('a0000000-0000-0000-0000-000000000005', 'eve@demo.com', 'Eve User 5', 'user'),
('a0000000-0000-0000-0000-000000000006', 'frank@demo.com', 'Frank User 6', 'user'),
('a0000000-0000-0000-0000-000000000010', 'xavier@hacker.com', 'Xavier (Hacker)', 'hacker');

insert into public.accounts (user_id, account_number, balance) values
('a0000000-0000-0000-0000-000000000001', 'SAL_ALICE', 100000.00),
('a0000000-0000-0000-0000-000000000002', 'SAL_BOB', 100000.00),
('a0000000-0000-0000-0000-000000000003', 'SAL_CHARLIE', 100000.00),
('a0000000-0000-0000-0000-000000000004', 'SAL_DAVID', 100000.00),
('a0000000-0000-0000-0000-000000000005', 'SAL_EVE', 100000.00),
('a0000000-0000-0000-0000-000000000006', 'SAL_FRANK', 100000.00),
('a0000000-0000-0000-0000-000000000010', 'HACKER_X', 100000.00);
