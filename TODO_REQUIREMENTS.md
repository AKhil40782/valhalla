# 📝 Remaining Feature Roadmap

This document outlines the **remaining features** required to move the **Salaar Bank Fraud System** from "Demo" to "Production Ready".

---

## 🔐 Middleware Protection (Route Guards)
**Goal:** Secure the dashboard so only authenticated users can access investigator pages.

### Implementation Tasks:
- [ ] **Add `middleware.ts`**: Block access to `/dashboard`, `/network`, `/transactions` for unauthenticated users.
- [ ] **Session Validation**: Check Supabase session or `localStorage` demo user before allowing access.
- [ ] **Redirect Logic**: Redirect unauthorized users to `/login`.

---

## 📧 Email & Notification System
**Goal:** Actually send emails/SMS when fraud is detected (currently simulated).

### Requirements:
*   **Email Service:** **Resend** (Recommended) or SendGrid.
*   **API Key:** Need a valid API Key from the provider.
*   **Domain:** Verified domain (e.g., `security@salaarbank.com`) to prevent spam filtering.

### Implementation Tasks:
- [ ] **Install SDK**: `npm install resend`
- [ ] **Update `actions.ts`**:
    ```typescript
    import { Resend } from 'resend';
    const resend = new Resend(process.env.RESEND_API_KEY);
    // Replace the simulated promise with resend.emails.send()
    ```
- [ ] **Template**: Polish the HTML email template (completed in `lib/email-template.ts`).

---

## ✅ PDF Report Generation (COMPLETED)
**Goal:** Allow investigators to download a case file for legal/compliance use.

### Implementation:
- [x] **PDF Generator Module**: Created `src/lib/pdf-generator.ts` using jsPDF + autoTable.
- [x] **Report Sections**: Executive Summary, Primary Suspect, Alerts Table, Transaction Log.
- [x] **Export Button**: Wired up "Export PDF" button on `/reports` page.
- [x] **Audit Integration**: Reports include investigator name from session.

---

## 🔄 Feedback Loop (Model Retraining)
**Goal:** Let analysts mark "False Positives" to improve the system.

### Requirements:
*   **Database:** A new column `feedback_status` (Correct/False Positive) in `fraud_alerts`.

### Implementation Tasks:
- [ ] **UI Update**: Add "Dismiss as False Positive" button on the Alert Card.
- [ ] **Server Action**: Create `updateAlertFeedback(id, status)` function.
- [ ] **Logic Update**: If an account is marked "False Positive", authorize it for 30 days (allow-list).

---

## 🛠️ Summary Checklist

| Task | Status | Difficulty | Estimated Time | Dependencies |
|------|--------|------------|----------------|--------------|
| **Middleware Protection** | ⏳ TODO | ⭐⭐ | 2 Hours | Supabase Auth |
| **Email Integration** | ⏳ TODO | ⭐ | 1 Hour | Resend API Key |
| **PDF Reporting** | ⏳ TODO | ⭐⭐ | 3 Hours | `react-pdf` |
| **Feedback Loop** | ⏳ TODO | ⭐ | 1 Hour | None |

---

## ✅ Already Completed (Reference)

The following features have been implemented and are operational:
- Security & Compliance (PII Masking, Audit Logs, pgcrypto)
- Real-Time Data Pipeline (Supabase Integration)
- Live Polling (5s refresh with toggle)
- Attack Simulator (/attack-simulator)
- Demo Auth System (Persona-based login)
- Graph Export (PNG download)
