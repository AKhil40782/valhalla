'use server';

import { supabase } from './supabase';

// Types for RAG system
export interface FraudDocument {
    id?: string;
    content: string;
    metadata: {
        case_id?: string;
        document_type: 'transaction' | 'alert' | 'investigation' | 'pattern';
        risk_level?: string;
        accounts_involved?: string[];
        timestamp?: string;
        keywords?: string[];
    };
}

export interface RetrievalResult {
    content: string;
    relevance_score: number;
    metadata: FraudDocument['metadata'];
}

// Store a document for RAG retrieval
export async function storeDocument(doc: FraudDocument): Promise<{ success: boolean; id?: string }> {
    try {
        // Extract keywords from content for search
        const keywords = extractKeywords(doc.content);

        const { data, error } = await supabase
            .from('risk_vectors')
            .insert({
                content: doc.content,
                metadata: {
                    ...doc.metadata,
                    keywords,
                    indexed_at: new Date().toISOString()
                }
            })
            .select('id')
            .single();

        if (error) throw error;
        return { success: true, id: data?.id };
    } catch (error) {
        console.error('Error storing document:', error);
        return { success: false };
    }
}

// Retrieve relevant documents using keyword matching
export async function retrieveDocuments(
    query: string,
    options: {
        limit?: number;
        caseId?: string;
        documentType?: string;
    } = {}
): Promise<RetrievalResult[]> {
    const { limit = 5, caseId, documentType } = options;

    try {
        // Extract query keywords
        const queryKeywords = extractKeywords(query);

        // Build the query
        let dbQuery = supabase
            .from('risk_vectors')
            .select('id, content, metadata');

        // Filter by case ID if provided
        if (caseId) {
            dbQuery = dbQuery.eq('metadata->>case_id', caseId);
        }

        // Filter by document type if provided
        if (documentType) {
            dbQuery = dbQuery.eq('metadata->>document_type', documentType);
        }

        const { data, error } = await dbQuery.limit(50);

        if (error) throw error;
        if (!data || data.length === 0) return [];

        // Score documents by keyword overlap
        const scoredResults = data.map(doc => {
            const docKeywords = doc.metadata?.keywords || extractKeywords(doc.content);
            const score = calculateRelevance(queryKeywords, docKeywords, doc.content, query);
            return {
                content: doc.content,
                relevance_score: score,
                metadata: doc.metadata
            };
        });

        // Sort by relevance and return top results
        return scoredResults
            .sort((a, b) => b.relevance_score - a.relevance_score)
            .slice(0, limit)
            .filter(r => r.relevance_score > 0);

    } catch (error) {
        console.error('Error retrieving documents:', error);
        return [];
    }
}

// Build context string from retrieved documents
export async function buildContext(documents: RetrievalResult[]): Promise<string> {
    if (documents.length === 0) {
        return 'No relevant case documents found.';
    }

    const contextParts = documents.map((doc, idx) => {
        const typeLabel = doc.metadata.document_type?.toUpperCase() || 'DOCUMENT';
        const riskLabel = doc.metadata.risk_level ? ` [${doc.metadata.risk_level} RISK]` : '';
        return `--- ${typeLabel}${riskLabel} (Relevance: ${(doc.relevance_score * 100).toFixed(0)}%) ---\n${doc.content}`;
    });

    return contextParts.join('\n\n');
}

// Seed initial fraud knowledge base
export async function seedFraudKnowledgeBase(): Promise<{ success: boolean; count: number }> {
    const fraudDocuments: FraudDocument[] = [
        {
            content: `STRUCTURING PATTERN DEFINITION: Structuring, also known as "smurfing," is the practice of executing financial transactions in a specific pattern calculated to avoid triggering reporting requirements. Common indicators include: multiple deposits just under ₹10,000 threshold, same beneficiary receiving funds from multiple sources, transactions split across multiple days or accounts.`,
            metadata: {
                document_type: 'pattern',
                risk_level: 'HIGH',
                keywords: ['structuring', 'smurfing', 'threshold', 'deposits', 'reporting']
            }
        },
        {
            content: `MONEY MULE NETWORK INDICATORS: Money mules are individuals who transfer illegally obtained money on behalf of others. Key indicators: rapid fund transfers between accounts, new accounts with immediate high activity, funds received and quickly withdrawn or transferred, geographic dispersion of recipients, accounts opened with stolen identities.`,
            metadata: {
                document_type: 'pattern',
                risk_level: 'CRITICAL',
                keywords: ['money mule', 'laundering', 'transfer', 'network', 'stolen identity']
            }
        },
        {
            content: `IP ADDRESS COLLISION FRAUD: Multiple distinct accounts accessing from the same IP address within short timeframes indicates potential fraud ring activity. This could suggest: shared credential access, automated bot attacks, identity theft ring operations, or account takeover scenarios. Proxy and VPN usage should be flagged.`,
            metadata: {
                document_type: 'pattern',
                risk_level: 'HIGH',
                keywords: ['ip address', 'collision', 'proxy', 'vpn', 'bot', 'account takeover']
            }
        },
        {
            content: `VELOCITY ATTACK PATTERN: Velocity attacks involve rapid, automated transaction attempts designed to exploit system weaknesses or test stolen credentials. Indicators: many transactions within seconds, same source to multiple destinations, small test amounts followed by large transfers, unusual time-of-day patterns.`,
            metadata: {
                document_type: 'pattern',
                risk_level: 'CRITICAL',
                keywords: ['velocity', 'rapid', 'automated', 'test', 'bot attack']
            }
        },
        {
            content: `GEOGRAPHIC ANOMALY (IMPOSSIBLE TRAVEL): When an account shows activity from geographically distant locations within a timeframe that makes physical travel impossible, this indicates credential compromise. Example: Transaction in New York at 10:00 AM followed by Singapore transaction at 10:30 AM. Always flag users with logins from different countries within 2 hours.`,
            metadata: {
                document_type: 'pattern',
                risk_level: 'HIGH',
                keywords: ['geographic', 'impossible travel', 'location', 'credential', 'compromise']
            }
        },
        {
            content: `ACCOUNT TAKEOVER (ATO) INDICATORS: Signs of compromised accounts include: password changes followed by immediate high-value transfers, new payees added and funded rapidly, login from new device/location followed by suspicious activity, changes to notification settings, contact information modifications.`,
            metadata: {
                document_type: 'pattern',
                risk_level: 'CRITICAL',
                keywords: ['account takeover', 'ato', 'password', 'compromise', 'payee']
            }
        },
        {
            content: `INVESTIGATION PROTOCOL FOR SALAAR BANK: When a fraud alert is triggered, investigators should: 1) Freeze suspicious accounts immediately, 2) Document all evidence including IP logs and transaction history, 3) Cross-reference with known fraud patterns, 4) Generate SAR filing if warranted, 5) Notify affected customers through verified channels.`,
            metadata: {
                document_type: 'investigation',
                risk_level: 'MEDIUM',
                keywords: ['investigation', 'freeze', 'sar', 'protocol', 'evidence']
            }
        }
    ];

    let successCount = 0;
    for (const doc of fraudDocuments) {
        const result = await storeDocument(doc);
        if (result.success) successCount++;
    }

    return { success: successCount > 0, count: successCount };
}

// Helper: Extract keywords from text
function extractKeywords(text: string): string[] {
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
        'by', 'from', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had',
        'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
        'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ]);

    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word))
        .slice(0, 50); // Limit keywords
}

// Helper: Calculate relevance score
function calculateRelevance(
    queryKeywords: string[],
    docKeywords: string[],
    docContent: string,
    query: string
): number {
    const docKeywordSet = new Set(docKeywords);
    const queryLower = query.toLowerCase();
    const contentLower = docContent.toLowerCase();

    // Keyword overlap score
    let keywordMatches = 0;
    queryKeywords.forEach(kw => {
        if (docKeywordSet.has(kw)) keywordMatches++;
    });
    const keywordScore = queryKeywords.length > 0 ? keywordMatches / queryKeywords.length : 0;

    // Phrase match score
    let phraseScore = 0;
    const queryPhrases = queryLower.split(' ').filter(w => w.length > 3);
    queryPhrases.forEach(phrase => {
        if (contentLower.includes(phrase)) phraseScore += 0.1;
    });
    phraseScore = Math.min(phraseScore, 0.5);

    // Combined score
    return Math.min((keywordScore * 0.7) + (phraseScore * 0.3) + 0.1, 1);
}
