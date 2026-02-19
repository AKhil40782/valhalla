-- ============================================
-- FRESH START: Remove Demo Accounts & Setup Real Auth
-- This script DELETES all old demo data and sets up
-- clean authentication for real users only
-- ============================================

-- Step 1: Clear ALL old demo data
TRUNCATE TABLE fraud_alerts CASCADE;
TRUNCATE TABLE transactions CASCADE;
TRUNCATE TABLE accounts CASCADE;

-- Drop profiles if exists (to recreate fresh)
DROP TABLE IF EXISTS profiles CASCADE;

-- Step 2: Create fresh profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Step 3: Add/update columns in accounts table
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_frozen boolean DEFAULT false;

-- Step 4: Function to generate account number
CREATE OR REPLACE FUNCTION generate_account_number()
RETURNS text AS $$
BEGIN
  RETURN 'SAL' || LPAD(floor(random() * 10000000000)::text, 10, '0');
END;
$$ LANGUAGE plpgsql;

-- Step 5: Trigger function for new user signup
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
  
  -- Create bank account with ₹1,00,000 welcome bonus
  INSERT INTO public.accounts (user_id, account_number, balance, risk_score, account_type, kyc_verified)
  VALUES (
    NEW.id,
    new_account_number,
    100000,
    0,
    'SAVINGS',
    true
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Step 7: Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Step 8: RLS Policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Step 9: RLS Policies for accounts (allow all for now - needed for transfers)
DROP POLICY IF EXISTS "Allow all account access" ON accounts;
CREATE POLICY "Allow all account access" ON accounts FOR ALL USING (true);

-- Step 10: RLS Policies for transactions
DROP POLICY IF EXISTS "Allow all transaction access" ON transactions;
CREATE POLICY "Allow all transaction access" ON transactions FOR ALL USING (true);

-- Step 11: Update transactions table to use account_number for to_account
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS to_account_number text;

-- Step 12: Create indexes
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_account_number ON accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_transactions_to_account_number ON transactions(to_account_number);

-- ============================================
-- SUCCESS: Fresh start complete!
-- ============================================
SELECT '✅ Fresh Start Complete!' as status;
SELECT 'All demo accounts deleted' as step1;
SELECT 'Auth trigger created' as step2;
SELECT 'New users will get ₹1,00,000 on signup' as step3;
SELECT 'Ready for real users!' as step4;
