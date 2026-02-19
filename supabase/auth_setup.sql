-- ============================================
-- OPTION 1: KEEP EXISTING DATA (Recommended for Demo)
-- This adds new auth features while keeping your existing 
-- transactions and accounts for fraud detection testing
-- ============================================

-- Add new columns to accounts (won't affect existing data)
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_frozen boolean DEFAULT false;

-- Create profiles table  
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Function to generate account number
CREATE OR REPLACE FUNCTION generate_account_number()
RETURNS text AS $$
BEGIN
  RETURN 'SAL' || LPAD(floor(random() * 10000000000)::text, 10, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger function for new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_account_number text;
BEGIN
  -- Generate unique account number
  new_account_number := generate_account_number();
  
  -- Create profile
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  
  -- Create bank account with welcome bonus
  INSERT INTO public.accounts (user_id, account_number, balance, risk_score, account_type, kyc_verified)
  VALUES (
    NEW.id,
    new_account_number,
    100000, -- ₹1,00,000 welcome bonus
    0,
    'SAVINGS',
    true
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow authenticated users to see all data for fraud detection)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow all account access" ON accounts;
CREATE POLICY "Allow all account access" ON accounts FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all transaction access" ON transactions;
CREATE POLICY "Allow all transaction access" ON transactions FOR ALL USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

SELECT '✅ OPTION 1 Complete: Auth added, existing data preserved!' as status;


-- ============================================
-- OPTION 2: FRESH START (Uncomment to use)
-- This deletes ALL existing data and starts clean
-- Only use if you want a completely fresh database
-- ============================================

/*
-- WARNING: This deletes ALL data!
TRUNCATE TABLE transactions CASCADE;
TRUNCATE TABLE fraud_alerts CASCADE;
TRUNCATE TABLE accounts CASCADE;
TRUNCATE TABLE profiles CASCADE;

SELECT '⚠️ OPTION 2 Complete: All data deleted, fresh start!' as status;
*/
