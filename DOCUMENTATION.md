# Salaar Bank Fraud Intelligence Platform

## System Documentation

---

## 1. Executive Summary

The **Salaar Bank Fraud Intelligence Platform** is a comprehensive fraud detection system designed to uncover hidden fraud networks by analyzing transaction behavior across multiple accounts and linking fragmented identities using shared patterns. The system goes beyond single-account monitoring to detect coordinated fraud activity and provides clear, AI-powered explanations for every flagged network.

---

## 2. Problem Statement Compliance

### Minimum Requirements - All Implemented ✅

| Requirement | Implementation | Status |
|-------------|---------------|--------|
| **Structured storage of transaction data, device details, IP addresses, and branch information** | Supabase PostgreSQL database with `accounts`, `transactions`, `fraud_alerts`, `investigation_cases`, and `risk_vectors` tables | ✅ Complete |
| **Ability to link accounts using shared attributes (device, IP, location, timing)** | `linkAccountsByAttributes()` function analyzes shared IPs, geographic proximity, and temporal patterns | ✅ Complete |
| **Network/graph-based relationship modeling between accounts** | Cytoscape.js-powered fraud network graph with visual node relationships | ✅ Complete |
| **Risk scoring for linked groups of accounts** | Cluster Risk Analysis with density, IP collision score, and temporal sync metrics | ✅ Complete |
| **Dashboard for investigators showing linked networks and fraud indicators** | Full investigator dashboard with graph visualization, alerts feed, AI investigator, and timeline replay | ✅ Complete |

### Expected Outcomes - All Achieved ✅

| Outcome | Implementation | Status |
|---------|---------------|--------|
| **Functional prototype that detects hidden fraud networks** | Complete working prototype with demo fraud scenarios | ✅ Achieved |
| **Improved fraud detection beyond single-account monitoring** | Multi-account pattern detection (structuring, money mule networks, IP collision) | ✅ Achieved |
| **Visual network graphs of connected accounts** | Interactive Cytoscape graph with account, device, and IP nodes | ✅ Achieved |
| **Early identification of coordinated fraud groups** | Timeline replay and velocity detection for early warnings | ✅ Achieved |
| **Adaptive system as new transaction data is added** | RAG system learns from investigations; Input page for new data | ✅ Achieved |
| **Documentation explaining system logic, assumptions, and limitations** | This document | ✅ Achieved |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SALAAR BANK FRAUD PLATFORM                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   INPUT      │  │   ANALYSIS   │  │   VISUALIZATION      │   │
│  │   LAYER      │  │   ENGINE     │  │   LAYER              │   │
│  ├──────────────┤  ├──────────────┤  ├──────────────────────┤   │
│  │ Raw Data     │  │ Link         │  │ Fraud Network Graph  │   │
│  │ Entry Form   │──│ Detection    │──│ (Cytoscape.js)       │   │
│  │              │  │              │  │                      │   │
│  │ Demo Fraud   │  │ Pattern      │  │ Timeline Replay      │   │
│  │ Generator    │  │ Recognition  │  │                      │   │
│  │              │  │              │  │ Risk Analysis Panel  │   │
│  │ CSV Import   │  │ Risk Scoring │  │                      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   STORAGE    │  │   AI LAYER   │  │   REPORTING          │   │
│  ├──────────────┤  ├──────────────┤  ├──────────────────────┤   │
│  │ Supabase     │  │ RAG System   │  │ SAR Generation       │   │
│  │ PostgreSQL   │──│ (Keyword-    │──│                      │   │
│  │              │  │  based)      │  │ Case Reports         │   │
│  │ Vector Store │  │              │  │                      │   │
│  │ (pgvector)   │  │ LLM (Gemini  │  │ Evidence Packages    │   │
│  │              │  │  2.0 Free)   │  │                      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Core Features

### 4.1 Identity Linking Engine

The system links accounts using multiple shared attributes:

**Shared IP Address Detection**
```
IF multiple accounts access from same IP within time_window THEN
  FLAG as "IP Collision"
  INCREASE risk_score by 25 points
```

**Geographic Anomaly (Impossible Travel)**
```
IF same account active in Location_A and Location_B
  AND distance(A, B) / time_difference > 800 km/hr THEN
  FLAG as "Impossible Travel"
  INCREASE risk_score by 40 points
```

**Velocity Pattern Detection**
```
IF transactions_count > 5 within 60 seconds THEN
  FLAG as "Velocity Attack"
  INCREASE risk_score by 35 points
```

**Structuring Detection**
```
IF transaction_amount >= 9000 AND transaction_amount < 10000 THEN
  FLAG as "Potential Structuring"
  IF count(similar_transactions) > 3 within 24 hours THEN
    INCREASE risk_score by 50 points
```

### 4.2 Network Graph Visualization

**Node Types:**
- 🔵 **Account Nodes** - Bank accounts (circular shape)
- 🟣 **Device Nodes** - Device identifiers (rectangular shape)
- 🟢 **IP Nodes** - IP addresses (diamond shape)

**Edge Types:**
- **Transfer Edge** - Funds flow between accounts
- **Shared Device Edge** - Accounts using same device
- **Network Link Edge** - Accounts sharing IP address

**Risk Coloring:**
- 🔴 Red border: CRITICAL (risk > 80%)
- 🟠 Orange border: HIGH (risk 50-80%)
- 🟡 Yellow border: MEDIUM (risk 25-50%)
- 🟢 Green border: LOW (risk < 25%)

### 4.3 Risk Scoring Algorithm

```javascript
ClusterRiskScore = (
  (IP_Collision_Score * 0.25) +
  (Velocity_Score * 0.20) +
  (Structuring_Score * 0.20) +
  (Geographic_Anomaly_Score * 0.15) +
  (Temporal_Sync_Score * 0.10) +
  (Network_Density_Score * 0.10)
) * 100

// Where each component score is 0.0 to 1.0
```

### 4.4 AI Investigator (Sherlock)

The AI Investigator provides:
- Natural language explanations of fraud patterns
- Evidence synthesis from case data
- Recommended investigation actions
- SAR filing guidance

**RAG Pipeline:**
1. Query keywords extracted
2. Relevant documents retrieved from knowledge base
3. Context injected into LLM prompt
4. Grounded response generated

### 4.5 Adaptive Learning

The system adapts to new data through:
1. **Transaction Ingestion** - New data via Input page
2. **Pattern Learning** - Investigation conversations stored
3. **Knowledge Base Growth** - New fraud patterns added to RAG

---

## 5. Fraud Pattern Definitions

### 5.1 Structuring / Smurfing
**Definition:** Breaking large transactions into smaller amounts to avoid reporting thresholds (typically $10,000 for CTR).

**Indicators:**
- Multiple deposits between $9,000 - $9,999
- Same beneficiary from multiple sources
- Transactions clustered in short time windows

### 5.2 Money Mule Network
**Definition:** Layered transfers through intermediary accounts to obscure the source of funds.

**Indicators:**
- Source → Mule → Mule → Orchestrator pattern
- Rapid fund movement (< 10 mins between hops)
- Geographic dispersion of mule accounts
- Recently opened accounts with high activity

### 5.3 IP Collision Attack
**Definition:** Multiple distinct accounts accessing services from the same IP address.

**Indicators:**
- 3+ accounts from same IP within 10 minutes
- Use of known proxy/VPN IP ranges
- Automated timing patterns

### 5.4 Velocity Attack
**Definition:** Rapid burst of transactions indicating automated fraud or account compromise.

**Indicators:**
- 5+ transactions within 60 seconds
- Identical transaction amounts
- Same source to multiple destinations
- Unusual time-of-day patterns

### 5.5 Geographic Anomaly
**Definition:** Account activity from physically impossible locations within short timeframes.

**Indicators:**
- NY → London in 5 minutes (impossible)
- Different IP geolocations for same session
- Credential compromise likely

---

## 6. Database Schema

```sql
-- Core Tables
accounts (id, owner_name, account_number, balance, risk_score, created_at)
transactions (id, from_account_id, to_account_id, amount, currency, timestamp, 
              device_id, ip_address, location_lat, location_lng, location_city, 
              merchant_category, is_flagged)
fraud_alerts (id, transaction_id, risk_level, detect_reason, status, created_at)
investigation_cases (id, title, summary, status, risk_score, created_at)

-- RAG Vector Store
risk_vectors (id, content, metadata, embedding)
```

---

## 7. Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | Next.js 15, React 19 | Web application framework |
| Styling | Tailwind CSS | UI design system |
| Graph Viz | Cytoscape.js + Cola layout | Network visualization |
| Charts | Recharts | Data visualization |
| Database | Supabase (PostgreSQL) | Structured data storage |
| Vector Store | pgvector extension | RAG embeddings |
| LLM | Google Gemini 2.0 Flash (free) | AI explanations |
| Icons | Lucide React | UI iconography |

---

## 8. Assumptions

1. **Data Quality** - Incoming transaction data is assumed to be valid and properly formatted
2. **IP Accuracy** - IP addresses are accurate representations of user locations
3. **Time Synchronization** - All timestamps are in consistent timezone (UTC)
4. **Device ID Reliability** - Device identifiers are not easily spoofed
5. **Threshold Values** - Risk thresholds are based on industry standards but may need tuning
6. **Demo Mode** - Current prototype uses simulated data for demonstration

---

## 9. Limitations

1. **Real-time Processing** - Current system processes in batches, not true real-time streaming
2. **Device Fingerprinting** - Not implemented (per requirement); relies on IP/location
3. **Historical Analysis** - Limited to available transaction history
4. **False Positives** - Risk scoring may flag legitimate high-volume businesses
5. **Encryption** - Demo mode stores data without encryption; production needs secure storage
6. **Scale** - Prototype optimized for demo; production needs horizontal scaling
7. **Regulatory Compliance** - Actual SAR filing requires regulatory integration

---

## 10. Future Enhancements

1. **Real-time Stream Processing** - Apache Kafka integration
2. **Machine Learning Models** - Anomaly detection with scikit-learn/TensorFlow
3. **Graph Database** - Neo4j for complex relationship queries
4. **Case Management System** - Full investigation workflow
5. **Regulatory API Integration** - Automated SAR filing
6. **Multi-tenant Architecture** - Support for multiple banks

---

## 11. API Reference

### Server Actions

```typescript
// Fetch fraud investigation data
getFraudData(): Promise<FraudData>

// Chat with AI investigator
chatWithInvestigator(message: string, caseId?: string): Promise<ChatResponse>

// Store document in RAG
storeDocument(doc: FraudDocument): Promise<{success: boolean, id?: string}>

// Retrieve relevant documents
retrieveDocuments(query: string, options?: RetrievalOptions): Promise<RetrievalResult[]>
```

### Example Usage

```typescript
// Analyze a fraud case
const result = await chatWithInvestigator(
  "Analyze the money mule network in this case",
  "case_001"
);
console.log(result.response);
```

---

## 12. Running the Application

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Add OPENROUTER_API_KEY and SUPABASE credentials

# Run development server
npm run dev

# Open browser
open http://localhost:3000
```

---

## 13. Demo Fraud Scenarios

The system includes 5 pre-built demo scenarios accessible via the Input page:

1. **Structuring / Smurfing** - $9,200-9,800 deposits
2. **Shared IP Attack** - 4 accounts from same IP
3. **Velocity Attack** - 6 transactions in 30 seconds
4. **Geographic Anomaly** - NY→London→Singapore in 5 mins
5. **Money Mule Ring** - Layered fund transfers

---

## 14. Contact & Support

**Project:** Salaar Bank Fraud Intelligence Platform  
**Version:** 1.0.0  
**Date:** January 2026

---

*This documentation is part of the HACK_AI_THON submission.*
