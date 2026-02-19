-- Fix Schema V2: Add missing columns and tables safely

-- 1. Fix 'accounts' table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS branch_code text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS branch_name text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'SAVINGS';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS kyc_verified boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 2. Fix 'transactions' table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS location_country text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS branch_code text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_type text DEFAULT 'TRANSFER';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS channel text DEFAULT 'ONLINE';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS session_id text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_flagged boolean DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS location_lat float;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS location_lng float;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS location_city text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS device_id text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS merchant_category text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';

-- 3. Fix 'fraud_alerts' table
ALTER TABLE fraud_alerts ADD COLUMN IF NOT EXISTS cluster_id text;
ALTER TABLE fraud_alerts ADD COLUMN IF NOT EXISTS alert_type text;
ALTER TABLE fraud_alerts ADD COLUMN IF NOT EXISTS linked_accounts text[];
ALTER TABLE fraud_alerts ADD COLUMN IF NOT EXISTS assigned_to text;
ALTER TABLE fraud_alerts ADD COLUMN IF NOT EXISTS resolved_at timestamp with time zone;
-- Fix enum constraint for risk_level if needed, or just let text be text if check constraint fails
DO $$ BEGIN
    ALTER TABLE fraud_alerts DROP CONSTRAINT IF EXISTS fraud_alerts_risk_level_check;
    ALTER TABLE fraud_alerts ADD CONSTRAINT fraud_alerts_risk_level_check CHECK (risk_level in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;


-- 4. Create missing tables
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

CREATE TABLE IF NOT EXISTS risk_vectors (
  id bigserial primary key,
  content text,
  metadata jsonb,
  embedding vector(1536)
);

CREATE TABLE IF NOT EXISTS account_links (
  id uuid primary key default gen_random_uuid(),
  account_a_id uuid references accounts(id),
  account_b_id uuid references accounts(id),
  link_type text not null,
  strength float default 0.0,
  first_detected timestamp with time zone default now(),
  last_seen timestamp with time zone default now(),
  occurrence_count int default 1,
  metadata jsonb
);

CREATE TABLE IF NOT EXISTS sessions (
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

-- 5. Create Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_transactions_from_account ON transactions(from_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_ip_address ON transactions(ip_address);
CREATE INDEX IF NOT EXISTS idx_transactions_flagged ON transactions(is_flagged);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON fraud_alerts(status);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_cluster ON fraud_alerts(cluster_id);
CREATE INDEX IF NOT EXISTS idx_account_links_type ON account_links(link_type);
CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_risk_vectors_metadata ON risk_vectors using gin(metadata);

