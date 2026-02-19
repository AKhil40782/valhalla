-- Fix Auth V3: Create profiles table and setting up auth triggers

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 2. Add user_id to accounts if missing (it should be there, but just in case)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_frozen boolean DEFAULT false;

-- 3. Function to generate account number
CREATE OR REPLACE FUNCTION generate_account_number()
RETURNS text AS $$
BEGIN
  RETURN 'SAL' || LPAD(floor(random() * 10000000000)::text, 10, '0');
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger function for new user signup
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
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Create bank account with ₹1,00,000 welcome bonus
  INSERT INTO public.accounts (user_id, account_number, balance, risk_score, account_type, kyc_verified)
  VALUES (
    NEW.id,
    new_account_number,
    100000,
    0,
    'SAVINGS',
    true
  )
  ON CONFLICT (account_number) DO NOTHING; -- unlikely collision but safe
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 6. RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow all account access" ON accounts;
CREATE POLICY "Allow all account access" ON accounts FOR ALL USING (true); -- Relaxed for demo

DROP POLICY IF EXISTS "Allow all transaction access" ON transactions;
CREATE POLICY "Allow all transaction access" ON transactions FOR ALL USING (true); -- Relaxed for demo

-- 7. Add to_account_number to transactions if missing
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS to_account_number text;

-- 8. Create indexes
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_account_number ON accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_transactions_to_account_number ON transactions(to_account_number);
