-- ==============================================================================
-- CONSOLIDATED SCHEMA: All Tables for Salaar Bank Fraud Detection System
-- ==============================================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid primary key, 
  email text,
  full_name text,
  role text default 'user' check (role in ('user', 'investigator', 'hacker', 'admin')),
  phone text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamp with time zone default now()
);

-- 2. Accounts Table
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  account_number text unique not null,
  balance decimal(12,2) default 100000.00,
  is_frozen boolean default false,
  risk_score int default 0,
  owner_name text,
  branch_code text,
  branch_name text,
  account_type text default 'SAVINGS',
  kyc_verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamp with time zone default now()
);

-- 3. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid default gen_random_uuid() primary key,
  from_account_id uuid references public.accounts(id),
  to_account_id uuid references public.accounts(id),
  to_account_number text not null,
  amount decimal(12,2) not null,
  currency text default 'USD',
  status text default 'completed',
  ip_address text,
  subnet_mask text default '255.255.255.0',
  device_id text,
  device_name text,
  imei text,
  location text,
  location_lat float,
  location_lng float,
  location_city text,
  location_country text,
  branch_code text,
  merchant_category text,
  transaction_type text default 'TRANSFER',
  channel text default 'ONLINE',
  session_id text,
  is_flagged boolean default false,
  timestamp timestamptz default now()
);

-- 4. Fraud Alerts Table
CREATE TABLE IF NOT EXISTS public.fraud_alerts (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.accounts(id),
  transaction_id uuid references public.transactions(id),
  risk_score int,
  risk_level text check (risk_level in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  alert_type text,
  detect_reason text,
  status text default 'open',
  feedback_status text,
  cluster_id text,
  linked_accounts text[],
  assigned_to text,
  created_at timestamptz default now(),
  resolved_at timestamp with time zone
);

-- 5. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid,
  action text not null,
  resource_id text,
  ip_address text,
  user_agent text,
  timestamp timestamptz default now()
);

-- 6. Investigation Cases Table
CREATE TABLE IF NOT EXISTS investigation_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text unique,
  title text,
  summary text,
  evidence_links text[],
  accounts_involved text[],
  status text default 'OPEN',
  risk_score float,
  sar_filed boolean default false,
  sar_reference text,
  assigned_investigator text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  closed_at timestamp with time zone
);

-- 7. Account Links Table
CREATE TABLE IF NOT EXISTS account_links (
  id uuid primary key default gen_random_uuid(),
  account_a_id uuid references public.accounts(id),
  account_b_id uuid references public.accounts(id),
  link_type text not null,
  strength float default 0.0,
  first_detected timestamp with time zone default now(),
  last_seen timestamp with time zone default now(),
  occurrence_count int default 1,
  metadata jsonb
);

-- 8. Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id),
  session_id text not null,
  ip_address text,
  device_id text,
  location_city text,
  location_country text,
  started_at timestamp with time zone default now(),
  ended_at timestamp with time zone,
  transaction_count int default 0,
  is_suspicious boolean default false
);

-- 9. Risk Vectors Table
CREATE TABLE IF NOT EXISTS risk_vectors (
  id bigserial primary key,
  content text,
  metadata jsonb,
  embedding vector(1536)
);

-- 10. Tor Exit Nodes Table
CREATE TABLE IF NOT EXISTS tor_exit_nodes (
    ip_address TEXT PRIMARY KEY,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    source TEXT DEFAULT 'torproject'
);

-- 11. Anonymous Access Logs Table
CREATE TABLE IF NOT EXISTS anonymous_access_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address TEXT,
    tor_detected BOOLEAN DEFAULT FALSE,
    proxy_detected BOOLEAN DEFAULT FALSE,
    vpn_detected BOOLEAN DEFAULT FALSE,
    hosting_detected BOOLEAN DEFAULT FALSE,
    geo_anomaly BOOLEAN DEFAULT FALSE,
    fingerprint_hardened BOOLEAN DEFAULT FALSE,
    risk_score FLOAT DEFAULT 0,
    risk_level TEXT DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    action_taken TEXT DEFAULT 'none',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
