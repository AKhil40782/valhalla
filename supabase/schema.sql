-- Enable pgvector extension for RAG
create extension if not exists vector;

-- Accounts Table
create table accounts (
  id uuid primary key default gen_random_uuid(),
  owner_name text not null,
  account_number text unique not null,
  balance decimal(12, 2) default 0.00,
  risk_score float default 0.0,
  branch_code text, -- Branch information
  branch_name text, -- Branch name
  account_type text default 'SAVINGS', -- SAVINGS, CURRENT, BUSINESS
  kyc_verified boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Transactions Table
create table transactions (
  id uuid primary key default gen_random_uuid(),
  from_account_id uuid references accounts(id),
  to_account_id uuid references accounts(id),
  amount decimal(12, 2) not null,
  currency text default 'USD',
  timestamp timestamp with time zone default now(),
  device_id text,
  ip_address text,
  location_lat float,
  location_lng float,
  location_city text,
  location_country text,
  branch_code text, -- Originating branch
  merchant_category text,
  transaction_type text default 'TRANSFER', -- TRANSFER, DEPOSIT, WITHDRAWAL, PAYMENT
  channel text default 'ONLINE', -- ONLINE, MOBILE, BRANCH, ATM
  session_id text, -- Session tracking for velocity detection
  is_flagged boolean default false
);

-- Fraud Alerts Table
create table fraud_alerts (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions(id),
  cluster_id text, -- Group related alerts
  risk_level text check (risk_level in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  alert_type text, -- STRUCTURING, VELOCITY, GEO_ANOMALY, IP_COLLISION, MULE_NETWORK
  detect_reason text,
  linked_accounts text[], -- Array of linked account IDs
  status text default 'NEW', -- NEW, INVESTIGATING, CLOSED, FALSE_POSITIVE
  assigned_to text,
  created_at timestamp with time zone default now(),
  resolved_at timestamp with time zone
);

-- Case Reports (for AI Analysis)
create table investigation_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text unique,
  title text,
  summary text, -- AI Generated Summary
  evidence_links text[], -- Array of evidence document URLs
  accounts_involved text[], -- Array of account IDs in case
  status text default 'OPEN', -- OPEN, INVESTIGATING, ESCALATED, CLOSED
  risk_score float,
  sar_filed boolean default false,
  sar_reference text,
  assigned_investigator text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  closed_at timestamp with time zone
);

-- Vector Store for RAG (Documents)
create table risk_vectors (
  id bigserial primary key,
  content text,
  metadata jsonb,
  embedding vector(1536)
);

-- Account Relationships (Graph Edges)
create table account_links (
  id uuid primary key default gen_random_uuid(),
  account_a_id uuid references accounts(id),
  account_b_id uuid references accounts(id),
  link_type text not null, -- SHARED_IP, SHARED_DEVICE, SHARED_BRANCH, SAME_BENEFICIARY
  strength float default 0.0, -- 0 to 1 relationship strength
  first_detected timestamp with time zone default now(),
  last_seen timestamp with time zone default now(),
  occurrence_count int default 1,
  metadata jsonb -- Store additional evidence
);

-- Session Tracking for Pattern Analysis
create table sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id),
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

-- Indexes for performance
create index idx_transactions_timestamp on transactions(timestamp);
create index idx_transactions_from_account on transactions(from_account_id);
create index idx_transactions_ip_address on transactions(ip_address);
create index idx_transactions_flagged on transactions(is_flagged);
create index idx_fraud_alerts_status on fraud_alerts(status);
create index idx_fraud_alerts_cluster on fraud_alerts(cluster_id);
create index idx_account_links_type on account_links(link_type);
create index idx_sessions_account on sessions(account_id);
create index idx_risk_vectors_metadata on risk_vectors using gin(metadata);

-- Stored function for link detection
create or replace function detect_account_links()
returns trigger as $$
begin
  -- Check for IP collision with other accounts
  insert into account_links (account_a_id, account_b_id, link_type, strength)
  select distinct
    NEW.from_account_id,
    t.from_account_id,
    'SHARED_IP',
    0.8
  from transactions t
  where t.ip_address = NEW.ip_address
    and t.from_account_id != NEW.from_account_id
    and t.timestamp > NOW() - interval '24 hours'
  on conflict do nothing;
  
  return NEW;
end;
$$ language plpgsql;

-- Trigger for automatic link detection
create trigger trg_detect_links
after insert on transactions
for each row
execute function detect_account_links();
