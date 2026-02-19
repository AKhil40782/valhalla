# 🔓 Account Freeze/Unfreeze Feature

## Overview
Fraud investigators can now both **freeze** and **unfreeze** accounts directly from the Network Graph interface. This provides complete control over account access during and after fraud investigations.

## How to Use

### Freezing an Account
1. Navigate to **Network Graph** (`/network`)
2. Wait for the fraud detection system to identify suspicious activity
3. When a fraud alert appears, click **"Freeze Account"**
4. Confirm the action in the popup dialog
5. The account is immediately frozen and cannot make transactions

### Unfreezing an Account
1. On the **Network Graph** page, frozen accounts show a different alert style:
   - Gray background instead of red
   - "⛔ ACCOUNT FROZEN" header
   - "Transactions Blocked" status
2. Click the **"🔓 Unfreeze Account"** button (green)
3. Confirm the action
4. The account is restored and can make transactions again

## Visual Indicators

### Active Fraud Alert (Not Frozen)
- **Background:** Red with pulse animation
- **Header:** 🚨 FRAUD DETECTED!
- **Status:** Fan-In Attack Identified
- **Button:** Red "Freeze Account"

### Frozen Account
- **Background:** Gray/slate (no animation)
- **Header:** ⛔ ACCOUNT FROZEN
- **Status:** Transactions Blocked
- **Button:** Green "🔓 Unfreeze Account"

## User Experience (Account Holder)

When an account is frozen, the user sees:

1. **Warning Banner** (top of dashboard)
   - Red border with pulse animation
   - ⛔ icon
   - "ACCOUNT FROZEN" heading
   - Explanation message

2. **Disabled Send Money Button**
   - Grayed out appearance
   - Text changes to "Account Frozen - Transactions Disabled"
   - Cannot be clicked

3. **Transaction Blocking**
   - Any attempt to send money shows error:
   - "⛔ ACCOUNT FROZEN: This account has been flagged for suspicious activity..."

## Backend Implementation

### Server Actions

**File:** `src/app/actions.ts`

#### freezeAccount()
```typescript
export async function freezeAccount(accountId: string, requesterId?: string)
```
- Sets `is_frozen = true` in database
- Sets `risk_score = 100`
- Logs audit trail
- Creates system transaction record

#### unfreezeAccount()
```typescript
export async function unfreezeAccount(accountId: string, requesterId?: string)
```
- Sets `is_frozen = false` in database
- Logs audit trail
- Creates system transaction record

### Data Flow

1. **Freeze Action:**
   ```
   Network Page → freezeAccount() → Database Update → Audit Log → System Transaction
   ```

2. **Unfreeze Action:**
   ```
   Network Page → unfreezeAccount() → Database Update → Audit Log → System Transaction
   ```

3. **Status Check:**
   ```
   getRealFraudData() → Includes is_frozen in hackerInfo → UI renders appropriate button
   ```

## Audit Trail

All freeze/unfreeze actions are logged in the `audit_logs` table:

- **Action:** `freeze_account` or `unfreeze_account`
- **User ID:** Investigator who performed the action
- **Resource ID:** Account ID that was affected
- **Timestamp:** When the action occurred

Additionally, system transactions are created:
- **Freeze:** Transaction to `SYSTEM_FREEZE`
- **Unfreeze:** Transaction to `SYSTEM_UNFREEZE`

## Security Features

1. **Confirmation Dialogs**
   - Both freeze and unfreeze require confirmation
   - Prevents accidental actions

2. **Multi-Layer Blocking**
   - UI prevents button clicks
   - Backend validates frozen status
   - Database enforces constraints

3. **Audit Logging**
   - Every action is tracked
   - Investigator accountability
   - Compliance with regulations

## Testing

### Test Freeze Flow
1. Create transactions to trigger fraud detection
2. Freeze the suspicious account
3. Log in as that user
4. Verify:
   - Warning banner appears
   - Send Money button is disabled
   - Transaction attempts are blocked

### Test Unfreeze Flow
1. With a frozen account, go to Network Graph
2. Click "🔓 Unfreeze Account"
3. Log in as that user
4. Verify:
   - Warning banner disappears
   - Send Money button is enabled
   - Transactions work normally

## Database Schema

Ensure the `accounts` table has:

```sql
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT false;
```

---

**Status:** ✅ **IMPLEMENTED**
**Version:** 1.0
**Date:** 2026-01-26
