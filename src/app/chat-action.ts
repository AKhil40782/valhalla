'use server';

import { retrieveDocuments, buildContext, storeDocument } from "@/lib/rag";
import { supabase } from "@/lib/supabase";

// Fetch real transaction data from Supabase
async function getRealTransactionContext() {
    try {
        // Get recent transactions
        const { data: transactions } = await supabase
            .from('transactions')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(50);

        // Get accounts
        const { data: accounts } = await supabase
            .from('accounts')
            .select('*');

        // Get profiles
        const { data: profiles } = await supabase
            .from('profiles')
            .select('*');

        if (!transactions || transactions.length === 0) {
            return null;
        }

        // Build account lookup
        const accountMap = new Map(accounts?.map(a => [a.id, a]) || []);
        const accountByNumber = new Map(accounts?.map(a => [a.account_number, a]) || []);
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        // Calculate metrics
        const inDegreeMap = new Map<string, number>();
        transactions.forEach(tx => {
            const toAcc = tx.to_account_number;
            inDegreeMap.set(toAcc, (inDegreeMap.get(toAcc) || 0) + 1);
        });

        // Find potential orchestrators (high in-degree)
        const topReceivers = Array.from(inDegreeMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Detect structuring (amounts between 9000-9999)
        const structuringTxs = transactions.filter(tx => tx.amount >= 9000 && tx.amount <= 9999);

        // Get frozen accounts
        const frozenAccounts = accounts?.filter(a => a.is_frozen) || [];

        // Build comprehensive context
        let context = `
SALAAR BANK - REAL-TIME FRAUD INVESTIGATION DATA
=================================================

📊 TRANSACTION SUMMARY:
- Total Transactions Analyzed: ${transactions.length}
- Total Accounts: ${accounts?.length || 0}
- Frozen Accounts: ${frozenAccounts.length}

💰 RECENT TRANSACTIONS (Last 10):
`;

        transactions.slice(0, 10).forEach(tx => {
            const fromAcc = accountMap.get(tx.from_account_id);
            const fromProfile = fromAcc ? profileMap.get(fromAcc.user_id) : null;
            const toAcc = accountByNumber.get(tx.to_account_number);
            const toProfile = toAcc ? profileMap.get(toAcc?.user_id) : null;

            context += `
- ₹${tx.amount.toLocaleString('en-IN')} | ${fromProfile?.full_name || tx.from_account_id} → ${toProfile?.full_name || tx.to_account_number}
  Time: ${new Date(tx.timestamp).toLocaleString('en-IN')}
  IP: ${tx.ip_address || 'Unknown'} | Device: ${tx.device_id || 'Unknown'}
  Location: ${tx.location || 'Unknown'}`;
        });

        // Add top receivers (potential orchestrators)
        if (topReceivers.length > 0) {
            context += `

🎯 HIGH IN-DEGREE ACCOUNTS (Potential Orchestrators):`;
            topReceivers.forEach(([accNum, count]) => {
                const acc = accountByNumber.get(accNum);
                const profile = acc ? profileMap.get(acc.user_id) : null;
                context += `
- ${accNum} (${profile?.full_name || 'Unknown'})
  Receiving from ${count} different sources
  Status: ${acc?.is_frozen ? '🔒 FROZEN' : '🟢 Active'}`;
            });
        }

        // Add structuring alerts
        if (structuringTxs.length > 0) {
            context += `

⚠️ STRUCTURING PATTERN DETECTED (₹9,000-₹9,999 transactions):`;
            structuringTxs.forEach(tx => {
                context += `
- ₹${tx.amount.toLocaleString('en-IN')} from ${tx.from_account_id}
  To: ${tx.to_account_number}
  Time: ${new Date(tx.timestamp).toLocaleString('en-IN')}`;
            });
        }

        // Add frozen accounts
        if (frozenAccounts.length > 0) {
            context += `

❄️ FROZEN ACCOUNTS:`;
            frozenAccounts.forEach(acc => {
                const profile = profileMap.get(acc.user_id);
                context += `
- ${acc.account_number} (${profile?.full_name || 'Unknown'})
  Balance: ₹${acc.balance.toLocaleString('en-IN')}
  Risk Score: ${acc.risk_score || 0}`;
            });
        }

        // Add total value at risk
        const totalValue = transactions.reduce((sum, tx) => sum + tx.amount, 0);
        context += `

📈 FINANCIAL METRICS:
- Total Value Transacted: ₹${totalValue.toLocaleString('en-IN')}
- Average Transaction: ₹${(totalValue / transactions.length).toLocaleString('en-IN')}
- Largest Transaction: ₹${Math.max(...transactions.map(t => t.amount)).toLocaleString('en-IN')}
`;

        return context;
    } catch (error) {
        console.error('Error fetching real data:', error);
        return null;
    }
}

// Get context for investigation - uses real data with RAG enhancement
async function getContextForCase(caseId: string, query: string) {
    // First, get real transaction data
    const realContext = await getRealTransactionContext();

    // Then try to enhance with RAG documents
    let ragContext = '';
    try {
        const documents = await retrieveDocuments(query, {
            limit: 3,
            caseId: caseId !== 'default' ? caseId : undefined
        });

        if (documents.length > 0) {
            ragContext = await buildContext(documents);
        }
    } catch (error) {
        console.log('RAG retrieval failed, using only real data');
    }

    // Combine real data with RAG knowledge
    if (realContext) {
        return realContext + (ragContext ? `\n\n📚 KNOWLEDGE BASE:\n${ragContext}` : '');
    }

    // Fallback only if no real data available
    return ragContext || `No transaction data available. Please ensure transactions exist in the database.`;
}

export async function chatWithInvestigator(message: string, caseId: string = "default") {
    try {
        const context = await getContextForCase(caseId, message);

        const systemPrompt = `
You are "Sherlock", an elite Fraud Investigation AI for SALAAR BANK.

YOUR ROLE:
- Analyze fraud patterns with precision
- Provide actionable intelligence to investigators
- Ground all responses in the provided case context
- Highlight critical risk factors clearly

RESPONSE STYLE:
- Be concise but thorough
- Use bullet points for clarity
- Bold **key terms** and account IDs
- Include specific evidence from the context
- Provide risk assessments (LOW/MEDIUM/HIGH/CRITICAL)
- Suggest concrete next steps

CONTEXT FOR THIS INVESTIGATION:
${context}

IMPORTANT:
- Only use information from the provided context
- If information is not available, clearly state so
- Never fabricate evidence or account details
- Prioritize the most critical findings first
`;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Salaar Bank Fraud Intel"
            },
            body: JSON.stringify({
                model: "google/gemini-2.0-flash-exp:free",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message }
                ],
                temperature: 0.3, // Lower temperature for more factual responses
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const text = data.choices[0]?.message?.content || "No response generated.";

        // Store the conversation for future RAG retrieval
        try {
            await storeDocument({
                content: `INVESTIGATION QUERY: ${message}\n\nAI ANALYSIS: ${text}`,
                metadata: {
                    case_id: caseId,
                    document_type: 'investigation',
                    timestamp: new Date().toISOString()
                }
            });
        } catch (err) {
            // Silently fail - don't break the response
        }

        return { response: text, success: true };

    } catch (error: any) {
        console.error("LLM Error:", error);

        // Fetch real data for fallback response
        try {
            const realContext = await getRealTransactionContext();

            if (realContext) {
                return {
                    response: `## AI Investigation (Offline Mode)

I'm currently unable to connect to the AI service, but here's the real-time data from your database:

${realContext}

**Note:** For detailed analysis, please retry your query when the AI service is available.`,
                    success: true,
                    offline: true
                };
            }
        } catch (e) {
            console.error("Fallback data fetch failed:", e);
        }

        // Ultimate fallback - no data available
        return {
            response: `## System Status

⚠️ **AI Service Temporarily Unavailable**

The AI investigation service could not process your request. This could be due to:
- API rate limiting
- Network connectivity issues
- Service maintenance

**What you can do:**
1. Check the **Network Graph** for real-time visualization
2. View **Reports** for generated analysis
3. Review **Transactions** for raw data
4. Try your query again in a few moments

*Your question: "${message}"*`,
            success: true,
            offline: true
        };
    }
}

// Generate case report using LLM
export async function generateCaseReport(caseData: {
    transactions: any[];
    alerts: any[];
    riskScore: number;
}) {
    const prompt = `Generate a formal fraud investigation case report for the following data:

TRANSACTIONS:
${JSON.stringify(caseData.transactions, null, 2)}

ALERTS:
${JSON.stringify(caseData.alerts, null, 2)}

RISK SCORE: ${caseData.riskScore}/100

Generate a professional report with:
1. Executive Summary
2. Transaction Analysis
3. Risk Assessment
4. Recommended Actions
5. Evidence Summary`;

    return chatWithInvestigator(prompt, 'report_generation');
}
