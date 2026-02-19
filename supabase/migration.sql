-- ============================================
-- MIGRATION SCRIPT: Update Existing Tables
-- Run this in Supabase SQL Editor
-- This ADDS new columns without deleting data
-- ============================================

-- 1. Add new columns to ACCOUNTS table
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS branch_code text,
ADD COLUMN IF NOT EXISTS branch_name text,
ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'SAVINGS',
ADD COLUMN IF NOT EXISTS kyc_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 2. Add new columns to TRANSACTIONS table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS location_country text,
ADD COLUMN IF NOT EXISTS branch_code text,
ADD COLUMN IF NOT EXISTS transaction_type text DEFAULT 'TRANSFER',
ADD COLUMN IF NOT EXISTS channel text DEFAULT 'ONLINE',
ADD COLUMN IF NOT EXISTS session_id text;

-- 3. Add new columns to FRAUD_ALERTS table
ALTER TABLE fraud_alerts
ADD COLUMN IF NOT EXISTS cluster_id text,
ADD COLUMN IF NOT EXISTS alert_type text,
ADD COLUMN IF NOT EXISTS linked_accounts text[],
ADD COLUMN IF NOT EXISTS assigned_to text,
ADD COLUMN IF NOT EXISTS resolved_at timestamp with time zone;

-- 4. Add new columns to INVESTIGATION_CASES table
ALTER TABLE investigation_cases
ADD COLUMN IF NOT EXISTS case_number text UNIQUE,
ADD COLUMN IF NOT EXISTS evidence_links text[],
ADD COLUMN IF NOT EXISTS accounts_involved text[],
ADD COLUMN IF NOT EXISTS sar_filed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sar_reference text,
ADD COLUMN IF NOT EXISTS assigned_investigator text,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone;

-- 5. Create NEW tables (only if they don't exist)

-- Account Links table for graph relationships
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

-- Sessions table for pattern analysis
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

-- 6. Create indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_transactions_from_account ON transactions(from_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_ip_address ON transactions(ip_address);
CREATE INDEX IF NOT EXISTS idx_transactions_flagged ON transactions(is_flagged);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON fraud_alerts(status);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_cluster ON fraud_alerts(cluster_id);
CREATE INDEX IF NOT EXISTS idx_account_links_type ON account_links(link_type);
CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_risk_vectors_metadata ON risk_vectors USING gin(metadata);

-- 7. Success message
SELECT 'Migration completed successfully! Your existing data is preserved.' as status;
