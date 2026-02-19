# Salaar Bank Fraud Intelligence Platform - Implementation Plan

## 1. Database Schema & Setup (Supabase)
- [ ] Create `schema.sql` with tables for:
    - `accounts` (id, owner_name, balance, risk_score)
    - `transactions` (id, from_account, to_account, amount, timestamp, device_id, ip_address, location, type)
    - `fraud_alerts` (id, transaction_id, risk_level, reason, status)
    - `investigation_cases` (id, status, notes, ai_summary)
- [ ] Instructions for user to run SQL in Supabase.

## 2. Data Ingestion & Simulation
- [ ] Create `src/lib/simulation/generator.ts` to generate realistic banking data (accounts, txns).
- [ ] Create `src/lib/ingestion.ts` to "ingest" data (write to Supabase/MockDB) and trigger analysis.
- [ ] Implement "Identity Linking" logic (Device/IP matching).

## 3. Graph Intelligence Engine
- [ ] Update `FraudGraph.tsx` to visualize real data from `graphElements`.
- [ ] Implement `src/lib/graph/louvain.ts` (or use library) to detect communities.
- [ ] Calculate Centrality scores for nodes.

## 4. Fraud Detection Logic
- [ ] Implement **Temporal Analysis**: Window-based frequency checks.
- [ ] Implement **Pattern Detection**: Z-Score for amount anomalies.
- [ ] Implement **Risk Scoring**: Weighted sum of factors.

## 5. AI & Explainability (RAG + OpenRouter)
- [ ] Enhance `chat-action.ts` to fetch *real* context from the database/vector store.
- [ ] Generate "Case Reports" using the LLM.

## 6. Dashboard & UI
- [ ] Update **Dashboard** to show real-time metrics (Salaar Bank branding).
- [ ] Create **Timeline Replay** component.
- [ ] Enhance **Investigator Chat** (already started).

## 7. Final Polish
- [ ] Branding (Salaar Bank logos/colors).
- [ ] Mobile Responsiveness (Verified).
