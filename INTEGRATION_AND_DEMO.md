# 🏦 Salaar Bank Fraud Detection - Integration & Demo Workflow

This guide outlines how to integrate the **Salaar Bank Fraud Intelligence Platform** into a real banking environment and how to present it effectively.

---

## 1. Integration Workflow (How to Connect)

### Phase 1: Data Ingestion (The Pipeline)
**Goal:** Feed live transaction data into the fraud system.

1.  **Direct Database Connection (Simplest)**
    *   **Action:** Connect our Supabase/Postgres directly to Salaar Bank's Core Banking System (CBS) read-replica.
    *   **Mechanism:** ETL Job runs every minute to sync `transactions` table.
    *   **Status:** *Simulated in Prototype* (Ready for real DB creds).

2.  **API Integration (Real-Time)**
    *   **Action:** Salaar Bank's payment gateway sends a webhook to our `/api/transaction-event` endpoint for every transaction.
    *   **Payload:**
        ```json
        {
          "transaction_id": "TX_998877",
          "amount": 9500,
          "sender": "ACC_123",
          "receiver": "ACC_456",
          "device_fingerprint": "dev_hash_abc",
          "ip": "192.168.1.5",
          "location": "Mumbai"
        }
        ```
    *   **Latency:** < 200ms processing time.

### Phase 2: Detection Engine (The Brain)
**Goal:** Detect patterns instantly.

1.  **Rule Execution:**
    *   System checks: *Is Amount > 50,000? Is Velocity > 10 tx/min?*
2.  **Graph Analysis:**
    *   System queries: *Does Sender link to a known Mule via Device/IP?*
3.  **Scoring:**
    *   Calculates `ClusterRiskScore` (0-100).
    *   If Score > 85 → **Block Transaction** + **Raise Alert**.

### Phase 3: Investigation (The Dashboard)
**Goal:** Human review.

*   Alert cards appear on Analyst Dashboard.
*   AI "Sherlock" auto-generates a case file.
*   Investigator clicks "Freeze Account" or "Dismiss".

---

## 2. Explanation Script (How to Present)

**"Welcome to the Salaar Bank Fraud Intelligence Platform. We don't just stop bad transactions; we dismantle fraud networks."**

### Step 1: The Problem (1 Minute)
> "Traditional systems look at transactions in isolation. If Vikram sends $5,000, it looks fine. If John sends $5,000, it looks fine.
> **But what if they both send it to the same person, from the same IP address, within 5 seconds?**
> That's a Mule Network. Traditional rules miss it. We catch it."

### Step 2: The Solution - Graph Intelligence (2 Minutes)
*Show the **Network Graph** page.*
> "This is our Graph Brain.
> - **Blue Nodes** are Accounts.
> - **Purple Nodes** are Devices.
> - **Green Nodes** are IPs.
> 
> See this **Cluster** here? (Point to Red Cluster).
> - These 5 accounts are completely unrelated on paper.
> - **BUT** they are all connected by this single **Device ID**.
> - The graph effectively reveals the hidden 'Fraud Ring' instantly."

### Step 3: The AI Advantage (2 Minutes)
*Show the **Investigator Chat**.*
> "Analysts are overwhelmed with data. Our AI Investigator, 'Sherlock,' processes the case for them.
> (Click on a node)
> Look at this note: *'Vikram Sen is acting as a High-Velocity Hub... Fan-In pattern detected.'*
> It explains **WHY** it's fraud in plain English, reducing investigation time by 90%."

### Step 4: Live Demo (The "Magic Moment")
*Go to **Input Data** page.*
1.  "Let's simulate an attack live."
2.  Select **"Money Mule Ring"**.
3.  Click **"Generate"**.
4.  Switch to **Network Graph**.
5.  "Boom. The system instantly linked these new transactions, identified the Mule Hub, and flagged it as CRITICAL. We just stopped a money laundering operation in real-time."

---

## 3. Deployment Checklist

- [ ] **Database**: Provision PostgreSQL with `pgvector` extension.
- [ ] **API**: secure endpoints with JWT/OAuth2.
- [ ] **LLM**: Connect to Enterprise Azure OpenAI / Gemini instance (for privacy).
- [ ] **Friction**: Configure risk thresholds (e.g., Block if score > 90).

---

**This platform transforms Salaar Bank from 'Reactionary' to 'Preventative'.**
