-- ============================================
-- MINIMAL SETUP: Just create profiles table and add columns
-- Run this FIRST before trying to register
-- ============================================

-- Create profiles table (for user info)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  full_name text,
  email text,
  phone text,
  created_at timestamp with time zone DEFAULT now()
);

-- Add user_id and is_frozen to accounts
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS user_id uuid,
ADD COLUMN IF NOT EXISTS is_frozen boolean DEFAULT false;

-- Disable RLS temporarily (for testing)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- Success!
SELECT 'Setup complete! Now try registering.' as status;
