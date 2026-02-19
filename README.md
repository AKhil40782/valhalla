# 🛡️ Salaar Bank Fraud Intelligence Platform

A next-generation fraud detection system that uncovers hidden fraud networks by analyzing transaction behavior across accounts and linking fragmented identities using shared patterns.

![Platform Preview](./docs/preview.png)

---

## 🎯 Problem Statement

> Fraudsters often split their activities across many accounts, devices, and locations so that each transaction looks normal on its own. When viewed together, these actions form a hidden fraud network that banks cannot easily detect.

This system solves this by:
- Analyzing transaction behavior across multiple accounts
- Linking fragmented identities using shared patterns
- Uncovering hidden relationships between accounts
- Detecting coordinated fraud activity
- Providing clear AI-powered explanations for every flagged network

---

## ✅ Features Implemented

### Minimum Requirements
| Requirement | Status |
|-------------|--------|
| Structured storage of transaction data, device details, IP addresses, and branch information | ✅ |
| Ability to link accounts using shared attributes (device, IP, location, timing) | ✅ |
| Network/graph-based relationship modeling between accounts | ✅ |
| Risk scoring for linked groups of accounts | ✅ |
| Dashboard for investigators showing linked networks and fraud indicators | ✅ |

### Expected Outcomes
| Outcome | Status |
|---------|--------|
| Functional prototype that detects hidden fraud networks | ✅ |
| Improved fraud detection beyond single-account monitoring | ✅ |
| Visual network graphs of connected accounts | ✅ |
| Early identification of coordinated fraud groups | ✅ |
| Adaptive system as new transaction data is added | ✅ |
| Documentation explaining system logic, assumptions, and limitations | ✅ |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account (for database)

### Installation

```bash
# Clone the repository
cd fraud-system

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Add your API keys to .env.local
```

### Environment Variables
```env
OPENROUTER_API_KEY=your_openrouter_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Setup
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/schema.sql`
3. Run the SQL to create tables

### Run Development Server
```bash
npm run dev
# Open http://localhost:3000
```

---

## 📁 Project Structure

```
fraud-system/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx            # Main Dashboard
│   │   ├── input/              # Raw Transaction Input
│   │   ├── network/            # Network Graph View
│   │   ├── campaigns/          # Temporal Campaign Analysis
│   │   ├── reports/            # Intelligence Reports
│   │   ├── investigate/        # Deep Investigation
│   │   ├── actions.ts          # Server Actions
│   │   └── chat-action.ts      # AI Investigator
│   ├── components/
│   │   ├── fraud/              # Fraud-specific components
│   │   │   ├── FraudGraph.tsx  # Cytoscape network graph
│   │   │   ├── InvestigatorChat.tsx # AI chat interface
│   │   │   └── TimelineReplay.tsx   # Transaction timeline
│   │   └── ui/                 # Reusable UI components
│   └── lib/
│       ├── rag.ts              # RAG system for AI
│       ├── supabase.ts         # Database client
│       └── simulation/         # Demo data generator
├── supabase/
│   └── schema.sql              # Database schema
├── DOCUMENTATION.md            # Full system documentation
└── README.md                   # This file
```

---

## 🖥️ Dashboard Features

### 1. Fraud Network Graph
Interactive Cytoscape.js visualization showing:
- Account nodes (circular)
- Device nodes (rectangular)
- IP address nodes (diamond)
- Transaction edges with direction
- Risk-colored nodes (red=critical, orange=high)

### 2. Timeline Replay
Temporal analysis tool showing:
- Transaction events in chronological order
- Play/pause controls with speed adjustment
- Event markers for alerts
- Visual progression through fraud activity

### 3. AI Investigator (Sherlock)
RAG-powered AI assistant that:
- Analyzes fraud patterns in natural language
- Provides evidence-based explanations
- Suggests investigation actions
- Generates SAR recommendations

### 4. Cluster Risk Analysis
Real-time metrics including:
- Overall severity rating (CRITICAL/HIGH/MEDIUM/LOW)
- Risk score (0-100)
- Network density measurement
- IP collision score
- Temporal synchronization score

### 5. Raw Transaction Input
Manual data entry with:
- Transaction form fields
- Demo fraud scenario generator
- 5 pre-built fraud types
- Automated fraud analysis

---

## 🕵️ Fraud Patterns Detected

| Pattern | Description | Risk Level |
|---------|-------------|------------|
| **Structuring** | Deposits split to avoid $10K reporting threshold | HIGH |
| **Money Mule** | Layered transfers through intermediary accounts | CRITICAL |
| **IP Collision** | Multiple accounts from same IP address | HIGH |
| **Velocity Attack** | Rapid transaction burst (automation) | CRITICAL |
| **Geographic Anomaly** | Impossible travel between locations | HIGH |

---

## 🔧 Technology Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Graph Viz | Cytoscape.js + Cola Layout |
| Charts | Recharts |
| Database | Supabase (PostgreSQL) |
| Vector DB | pgvector extension |
| AI/LLM | Google Gemini 2.0 Flash (free) |
| Icons | Lucide React |

---

## 📊 API Reference

### Server Actions

```typescript
// Get fraud investigation data
getFraudData(): Promise<FraudData>

// Chat with AI investigator
chatWithInvestigator(message: string, caseId?: string): Promise<ChatResponse>

// Store RAG document
storeDocument(doc: FraudDocument): Promise<{success: boolean}>

// Retrieve relevant documents
retrieveDocuments(query: string, options?: Options): Promise<RetrievalResult[]>
```

---

## 📝 Documentation

See [DOCUMENTATION.md](./DOCUMENTATION.md) for:
- Complete system architecture
- Risk scoring algorithm
- Fraud pattern definitions
- Database schema details
- Assumptions and limitations

---

## 🎮 Demo Scenarios

Access via **Input Data** page → **Create Demo Fraud**:

1. **Structuring/Smurfing** - 4 transactions of $9,200-$9,800
2. **Shared IP Attack** - 4 accounts from IP 192.168.100.55
3. **Velocity Attack** - 6 transactions in 30 seconds
4. **Geographic Anomaly** - NY → London → Singapore in 5 mins
5. **Money Mule Ring** - 5-account layering network

---

## 🔒 Security Notes

- Demo uses simulated data
- API keys should be kept private
- Production deployment needs encryption
- HTTPS required for production

---

## 📄 License

MIT License - See LICENSE file

---

## 👥 Team

Built for HACK_AI_THON 2026

---

*Protecting banks. Catching fraudsters. One network at a time.*
