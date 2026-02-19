# 🔐 Authentication Setup Guide

## Overview
The fraud detection system now uses real Supabase authentication instead of demo users. When a user registers, they automatically get:
- A profile in the `profiles` table
- A bank account in the `accounts` table with ₹1,00,000 welcome bonus

## Setup Steps

### 1. Run the Authentication SQL Script

Go to your **Supabase Dashboard** → **SQL Editor** and run the contents of:
```
supabase/auth_setup.sql
```

This creates:
- `profiles` table linked to `auth.users`
- `user_id` column in `accounts` table
- `is_frozen` column for account freezing
- Trigger to automatically create profile + account on signup
- Row Level Security (RLS) policies

### 2. Enable Email Auth in Supabase

1. Go to **Supabase Dashboard** → **Authentication** → **Providers**
2. Ensure **Email** provider is enabled
3. (Optional) Disable email confirmation for faster testing:
   - Go to **Authentication** → **Email Templates**
   - Toggle off "Confirm email"

### 3. Test Registration

1. Go to `http://localhost:3000/register`
2. Enter:
   - Full Name
   - Email
   - Password (min 6 characters)
3. Click "Open Account"
4. You should see success message
5. Go to `http://localhost:3000/login`
6. Login with your email/password

## How It Works

### Registration Flow:
```
User fills form → supabase.auth.signUp() → 
Trigger fires → Creates profile → Creates account with ₹1,00,000 → 
Redirect to login
```

### Login Flow:
```
User enters credentials → supabase.auth.signInWithPassword() →
Session created → Redirect to /user/dashboard
```

### Dashboard:
- Shows user's real account info
- Balance is fetched from `accounts` table
- Transactions can be made to other account numbers
- Shows frozen account warning if applicable

## Database Tables

### profiles
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Links to auth.users(id) |
| full_name | text | User's full name |
| email | text | User's email |
| phone | text | Phone number (optional) |
| created_at | timestamp | When created |

### accounts (updated)
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Links to auth.users(id) |
| account_number | text | SAL + 10 digits |
| balance | numeric | Current balance (starts at 100000) |
| is_frozen | boolean | Whether account is frozen |
| risk_score | float | Fraud risk score |

## Security Features

1. **Row Level Security (RLS)**
   - Users can only view/edit their own profile
   - Users can view their own accounts
   - Authenticated users can view all transactions (for network graph)

2. **Session Management**
   - Sessions stored in Supabase
   - Auto logout on session expiry
   - Secure token handling

## Removed Demo Features

- ❌ Demo user selection on login page
- ❌ localStorage demo_user_id
- ❌ Hardcoded demo accounts

## New Features

- ✅ Real email/password authentication
- ✅ Automatic account creation on signup
- ✅ ₹1,00,000 welcome bonus
- ✅ User name displayed in header
- ✅ Secure session management
- ✅ Account freezing persists in database

## Troubleshooting

### "Invalid login credentials"
- Make sure you registered first
- Check email/password spelling
- Password must be at least 6 characters

### Account not created after registration
- Check if the trigger exists in Supabase
- Run `auth_setup.sql` again
- Check Supabase logs for errors

### Can't see transactions
- Make sure RLS policies are created
- User must be logged in
- Check `transactions` table has data

---

**Status:** ✅ **COMPLETE**
**Date:** 2026-01-26
