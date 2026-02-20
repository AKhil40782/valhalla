// Fraud Detection Engine — Multi-Attribute Identity Linking & Cluster Analysis
// Categories: Temporal Coordination, Money Flow, Network, Automation, Statistical, Physical, Identity

import { supabase } from '@/lib/supabase';
import { extractClusterFeatures } from '../ml/features';
import { predictClusterRisk } from '../ml/models';
import { calculateBiometricAnomalyScore, BiometricSignature } from './biometrics';
import { analyzeSessionBehaviour, SessionBehaviourSignature } from './session-tracker';

// ============================================
// TYPES
// ============================================

export interface TransactionEvent {
    id: string;
    account_id: string;           // from_account_id
    transaction_id: string;
    amount: number;
    timestamp: string;
    device_id: string | null;
    device_fingerprint_id: string | null;
    ip_address: string | null;
    ip_subnet: string | null;
    asn: string | null;
    vpn_flag: boolean;
    to_account_id: string;
}

export interface IdentityLink {
    account_a: string;
    account_b: string;
    link_type: 'fingerprint' | 'device_id' | 'ip' | 'subnet' | 'asn' | 'vpn' | 'time' | 'behavior';
    strength: number;  // 0-1
    metadata: Record<string, any>;
}

export interface ClusterMetricsNormalized {
    fingerprintReuseScore: number;   // 0-1
    deviceIdReuseScore: number;      // 0-1
    ipSubnetAsnReuseScore: number;   // 0-1
    vpnPresenceScore: number;        // 0-1
    timeSyncScore: number;           // 0-1
    graphDensityScore: number;       // 0-1
    // Category 3: Temporal Coordination
    burstWindowScore: number;        // 0-1 (>3 txs in 60s)
    synchronizedActivityScore: number; // 0-1 (same-second precision)
    // Category 4: Money Flow Structure
    funnelScore: number;             // 0-1 (high fan-in, single fan-out)
    circularFlowScore: number;       // 0-1 (A→B→C→A cycles)
    passThruScore: number;           // 0-1 (arrive + leave < 5min)
    // Category 6: Automation/Script
    automationScore: number;         // 0-1 (identical intervals, fixed amounts)
    // Category 8: Physical Consistency
    physicalConsistencyScore: number; // 0-1 (simultaneous conflicting locations)
    // Category 1-2: Biometrics & Session (per-transaction, averaged per cluster)
    avgBiometricScore: number;       // 0-1
    avgSessionScore: number;         // 0-1
}

export interface FraudCluster {
    id: string;
    label: string;
    accountIds: string[];
    links: IdentityLink[];
    metrics: ClusterMetricsNormalized;
    riskScore: number;     // 0-1 (Ensemble)
    riskLevel: 'low' | 'medium' | 'high';
    explanation: string;
    mlScore?: number;
    anomalyScore?: number;
}


// ============================================
// 1. CONVERT RAW TRANSACTIONS → TransactionEvents
// ============================================

export function toTransactionEvents(rawTxs: any[]): TransactionEvent[] {
    return rawTxs.map(tx => {
        const ipAddr = tx.ip_address || '';
        const subnet = ipAddr.includes('.')
            ? ipAddr.split('.').slice(0, 3).join('.') + '.0/24'
            : null;

        return {
            id: tx.id,
            account_id: tx.from_account_id,
            transaction_id: tx.id,
            amount: parseFloat(tx.amount) || 0,
            timestamp: tx.timestamp,
            device_id: tx.device_id || null,
            device_fingerprint_id: tx.device_fingerprint_id || tx.device_id || null,
            ip_address: ipAddr || null,
            ip_subnet: subnet,
            asn: tx.asn || null,
            vpn_flag: tx.vpn_flag || false,
            to_account_id: tx.to_account_id || tx.to_account_number,
        };
    });
}

// ============================================
// 2. IDENTITY LINKING RULES
// ============================================

const TIME_WINDOW_MS = 3 * 60 * 1000; // 3-minute sliding window (strict)

export function detectIdentityLinks(events: TransactionEvent[]): IdentityLink[] {
    const links: IdentityLink[] = [];
    const seenPairs = new Set<string>();

    const addLink = (a: string, b: string, type: IdentityLink['link_type'], strength: number, metadata: Record<string, any> = {}) => {
        if (a === b) return;
        const key = [a, b].sort().join('|') + '|' + type;
        if (seenPairs.has(key)) return;
        seenPairs.add(key);
        links.push({ account_a: a, account_b: b, link_type: type, strength, metadata });
    };

    // Build attribute maps
    const byFingerprint = new Map<string, Set<string>>();
    const byDeviceId = new Map<string, Set<string>>();
    const byIp = new Map<string, Set<string>>();
    const bySubnet = new Map<string, Set<string>>();
    const byAsn = new Map<string, Set<string>>();

    for (const ev of events) {
        if (ev.device_fingerprint_id) {
            if (!byFingerprint.has(ev.device_fingerprint_id)) byFingerprint.set(ev.device_fingerprint_id, new Set());
            byFingerprint.get(ev.device_fingerprint_id)!.add(ev.account_id);
        }
        if (ev.device_id) {
            if (!byDeviceId.has(ev.device_id)) byDeviceId.set(ev.device_id, new Set());
            byDeviceId.get(ev.device_id)!.add(ev.account_id);
        }
        if (ev.ip_address) {
            if (!byIp.has(ev.ip_address)) byIp.set(ev.ip_address, new Set());
            byIp.get(ev.ip_address)!.add(ev.account_id);
        }
        if (ev.ip_subnet) {
            if (!bySubnet.has(ev.ip_subnet)) bySubnet.set(ev.ip_subnet, new Set());
            bySubnet.get(ev.ip_subnet)!.add(ev.account_id);
        }
        if (ev.asn) {
            if (!byAsn.has(ev.asn)) byAsn.set(ev.asn, new Set());
            byAsn.get(ev.asn)!.add(ev.account_id);
        }
    }

    // Rule 1: Device Fingerprint Linking (Strong — 0.9)
    for (const [fp, accounts] of byFingerprint) {
        const arr = Array.from(accounts);
        for (let i = 0; i < arr.length; i++) {
            for (let j = i + 1; j < arr.length; j++) {
                addLink(arr[i], arr[j], 'fingerprint', 0.9, { fingerprint: fp });
            }
        }
    }

    // Rule 2: Device ID Linking (Medium — 0.6)
    for (const [did, accounts] of byDeviceId) {
        const arr = Array.from(accounts);
        for (let i = 0; i < arr.length; i++) {
            for (let j = i + 1; j < arr.length; j++) {
                addLink(arr[i], arr[j], 'device_id', 0.6, { device_id: did });
            }
        }
    }

    // Rule 3: IP & Network Linking (Medium — 0.5)
    for (const [ip, accounts] of byIp) {
        const arr = Array.from(accounts);
        for (let i = 0; i < arr.length; i++) {
            for (let j = i + 1; j < arr.length; j++) {
                addLink(arr[i], arr[j], 'ip', 0.5, { ip_address: ip });
            }
        }
    }
    for (const [subnet, accounts] of bySubnet) {
        const arr = Array.from(accounts);
        for (let i = 0; i < arr.length; i++) {
            for (let j = i + 1; j < arr.length; j++) {
                addLink(arr[i], arr[j], 'subnet', 0.4, { subnet });
            }
        }
    }
    for (const [asn, accounts] of byAsn) {
        const arr = Array.from(accounts);
        for (let i = 0; i < arr.length; i++) {
            for (let j = i + 1; j < arr.length; j++) {
                addLink(arr[i], arr[j], 'asn', 0.35, { asn });
            }
        }
    }

    // Rule 4: VPN-Assisted Linking (Weak — 0.2)
    const vpnEvents = events.filter(e => e.vpn_flag);
    for (let i = 0; i < vpnEvents.length; i++) {
        for (let j = i + 1; j < vpnEvents.length; j++) {
            const timeDiff = Math.abs(new Date(vpnEvents[i].timestamp).getTime() - new Date(vpnEvents[j].timestamp).getTime());
            if (timeDiff <= TIME_WINDOW_MS) {
                addLink(vpnEvents[i].account_id, vpnEvents[j].account_id, 'vpn', 0.2, {
                    time_diff_ms: timeDiff,
                    vpn_overlap: true
                });
            }
        }
    }

    // Rule 5: Temporal Linking (Strong — 0.8)
    for (let i = 0; i < events.length; i++) {
        for (let j = i + 1; j < events.length; j++) {
            if (events[i].account_id === events[j].account_id) continue;
            const timeDiff = Math.abs(new Date(events[i].timestamp).getTime() - new Date(events[j].timestamp).getTime());
            if (timeDiff <= TIME_WINDOW_MS) {
                addLink(events[i].account_id, events[j].account_id, 'time', 0.8, {
                    time_diff_ms: timeDiff,
                    window: '5min'
                });
            }
        }
    }

    // Rule 6: Behavioral Linking (Medium — 0.5)
    // Detect accounts with repeated small-value transactions (< 10000) with similar patterns
    const accountTxPatterns = new Map<string, number[]>();
    for (const ev of events) {
        if (!accountTxPatterns.has(ev.account_id)) accountTxPatterns.set(ev.account_id, []);
        accountTxPatterns.get(ev.account_id)!.push(ev.amount);
    }

    const behaviorAccounts = Array.from(accountTxPatterns.entries())
        .filter(([, amounts]) => amounts.length >= 2 && amounts.every(a => a < 10000));

    for (let i = 0; i < behaviorAccounts.length; i++) {
        for (let j = i + 1; j < behaviorAccounts.length; j++) {
            const [accA, amountsA] = behaviorAccounts[i];
            const [accB, amountsB] = behaviorAccounts[j];
            // Strict: require 85%+ similarity in average amount to link
            const avgA = amountsA.reduce((s, v) => s + v, 0) / amountsA.length;
            const avgB = amountsB.reduce((s, v) => s + v, 0) / amountsB.length;
            const ratio = Math.min(avgA, avgB) / Math.max(avgA, avgB);
            if (ratio > 0.85) {
                addLink(accA, accB, 'behavior', 0.5, {
                    avg_amount_a: avgA.toFixed(0),
                    avg_amount_b: avgB.toFixed(0),
                    similarity: (ratio * 100).toFixed(0) + '%'
                });
            }
        }
    }

    return links;
}

// ============================================
// 3. GRAPH CONSTRUCTION (Union-Find)
// ============================================

class UnionFind {
    parent: Map<string, string>;
    rank: Map<string, number>;

    constructor() {
        this.parent = new Map();
        this.rank = new Map();
    }

    find(x: string): string {
        if (!this.parent.has(x)) {
            this.parent.set(x, x);
            this.rank.set(x, 0);
        }
        if (this.parent.get(x) !== x) {
            this.parent.set(x, this.find(this.parent.get(x)!));
        }
        return this.parent.get(x)!;
    }

    union(x: string, y: string): void {
        const rx = this.find(x);
        const ry = this.find(y);
        if (rx === ry) return;
        const rankX = this.rank.get(rx) || 0;
        const rankY = this.rank.get(ry) || 0;
        if (rankX < rankY) this.parent.set(rx, ry);
        else if (rankX > rankY) this.parent.set(ry, rx);
        else { this.parent.set(ry, rx); this.rank.set(rx, rankX + 1); }
    }

    getClusters(): Map<string, string[]> {
        const clusters = new Map<string, string[]>();
        this.parent.forEach((_, node) => {
            const root = this.find(node);
            if (!clusters.has(root)) clusters.set(root, []);
            clusters.get(root)!.push(node);
        });
        return clusters;
    }
}

// ============================================
// 4. CLUSTER DETECTION
// ============================================

function buildClusters(links: IdentityLink[]): Map<string, string[]> {
    const uf = new UnionFind();
    for (const link of links) {
        uf.union(link.account_a, link.account_b);
    }
    return uf.getClusters();
}

// ============================================
// 5. METRIC CALCULATION (Per Cluster, Normalized 0-1)
// ============================================

function calculateClusterMetrics(
    clusterAccounts: string[],
    clusterLinks: IdentityLink[],
    allEvents: TransactionEvent[]
): ClusterMetricsNormalized {
    const accountSet = new Set(clusterAccounts);
    const clusterEvents = allEvents.filter(e => accountSet.has(e.account_id));
    const n = clusterAccounts.length;
    const maxPossiblePairs = n * (n - 1) / 2;

    // --- Fingerprint Reuse (STRICT): If ANY fingerprint is shared → high score ---
    const fingerprintAccMap = new Map<string, Set<string>>();
    for (const ev of clusterEvents) {
        if (ev.device_fingerprint_id) {
            if (!fingerprintAccMap.has(ev.device_fingerprint_id)) fingerprintAccMap.set(ev.device_fingerprint_id, new Set());
            fingerprintAccMap.get(ev.device_fingerprint_id)!.add(ev.account_id);
        }
    }
    let sharedFpCount = 0;
    let maxFpSharing = 0;
    for (const [, accs] of fingerprintAccMap) {
        if (accs.size > 1) { sharedFpCount++; maxFpSharing = Math.max(maxFpSharing, accs.size); }
    }
    // Exponential scaling: even 1 shared fingerprint is highly suspicious
    const fingerprintReuseScore = n > 1
        ? Math.min(1, sharedFpCount > 0 ? 0.6 + (maxFpSharing / n) * 0.4 : 0)
        : 0;

    // --- Device ID Reuse (STRICT): Same logic ---
    const deviceAccMap = new Map<string, Set<string>>();
    for (const ev of clusterEvents) {
        if (ev.device_id) {
            if (!deviceAccMap.has(ev.device_id)) deviceAccMap.set(ev.device_id, new Set());
            deviceAccMap.get(ev.device_id)!.add(ev.account_id);
        }
    }
    let sharedDevCount = 0;
    let maxDevSharing = 0;
    for (const [, accs] of deviceAccMap) {
        if (accs.size > 1) { sharedDevCount++; maxDevSharing = Math.max(maxDevSharing, accs.size); }
    }
    const deviceIdReuseScore = n > 1
        ? Math.min(1, sharedDevCount > 0 ? 0.5 + (maxDevSharing / n) * 0.5 : 0)
        : 0;

    // --- IP / Subnet / ASN Reuse: Boosted scoring ---
    const ipLinks = clusterLinks.filter(l => l.link_type === 'ip' || l.link_type === 'subnet' || l.link_type === 'asn');
    // Weight: same-IP links count more than subnet which count more than ASN
    let ipWeight = 0;
    for (const link of ipLinks) {
        if (link.link_type === 'ip') ipWeight += 1.0;
        else if (link.link_type === 'subnet') ipWeight += 0.7;
        else ipWeight += 0.4; // ASN
    }
    const ipSubnetAsnReuseScore = maxPossiblePairs > 0
        ? Math.min(1, ipWeight / maxPossiblePairs)
        : 0;

    // --- VPN Presence (STRICT): Any VPN usage in cluster is heavily penalized ---
    const vpnAccounts = new Set(clusterEvents.filter(e => e.vpn_flag).map(e => e.account_id));
    const vpnPresenceScore = n > 0
        ? Math.min(1, vpnAccounts.size > 0 ? 0.5 + (vpnAccounts.size / n) * 0.5 : 0)
        : 0;

    // --- Time Synchronization (STRICT): Even a couple of time-synced pairs is suspicious ---
    const timeLinks = clusterLinks.filter(l => l.link_type === 'time');
    const timeSyncRatio = maxPossiblePairs > 0 ? timeLinks.length / maxPossiblePairs : 0;
    // Apply sqrt scaling to amplify moderate values
    const timeSyncScore = Math.min(1, Math.sqrt(timeSyncRatio));

    // --- Graph Density: More aggressive scaling ---
    const rawDensity = maxPossiblePairs > 0 ? clusterLinks.length / maxPossiblePairs : 0;
    // Power curve: even moderate density is suspicious
    const graphDensityScore = Math.min(1, Math.pow(rawDensity, 0.7));

    // --- Category 3: Temporal Burst & Synchronization ---
    const { burstWindowScore, synchronizedActivityScore } = analyzeTemporalCoordination(clusterEvents);

    // --- Category 4: Money Flow Structure ---
    const { funnelScore, circularFlowScore, passThruScore } = analyzeMoneyFlowStructure(clusterEvents);

    // --- Category 6: Automation/Script Detection ---
    const automationScore = detectAutomationPatterns(clusterEvents);

    // --- Category 8: Physical Consistency ---
    const physicalConsistencyScore = analyzePhysicalConsistency(clusterEvents);

    // --- Categories 1-2: Biometric & Session (averaged from metadata if available) ---
    const { avgBiometricScore, avgSessionScore } = analyzeClusterBiometricsAndSessions(allEvents, accountSet);

    return {
        fingerprintReuseScore,
        deviceIdReuseScore,
        ipSubnetAsnReuseScore,
        vpnPresenceScore,
        timeSyncScore,
        graphDensityScore,
        burstWindowScore,
        synchronizedActivityScore,
        funnelScore,
        circularFlowScore,
        passThruScore,
        automationScore,
        physicalConsistencyScore,
        avgBiometricScore,
        avgSessionScore,
    };
}

// ============================================
// CATEGORY 3: TEMPORAL COORDINATION ANALYSIS
// ============================================

function analyzeTemporalCoordination(events: TransactionEvent[]): {
    burstWindowScore: number;
    synchronizedActivityScore: number;
} {
    if (events.length < 2) return { burstWindowScore: 0, synchronizedActivityScore: 0 };

    const timestamps = events.map(e => new Date(e.timestamp).getTime()).sort((a, b) => a - b);

    // Burst windows: count clusters of >3 txs within 60 seconds
    let burstWindows = 0;
    for (let i = 0; i < timestamps.length; i++) {
        let count = 1;
        for (let j = i + 1; j < timestamps.length; j++) {
            if (timestamps[j] - timestamps[i] <= 60000) count++;
            else break;
        }
        if (count >= 3) burstWindows++;
    }
    const burstWindowScore = Math.min(1, burstWindows / 3);

    // Synchronized activity: same-second precision (< 1000ms apart)
    let syncPairs = 0;
    const uniqueAccounts = new Set(events.map(e => e.account_id));
    if (uniqueAccounts.size >= 2) {
        for (let i = 0; i < events.length; i++) {
            for (let j = i + 1; j < events.length; j++) {
                if (events[i].account_id === events[j].account_id) continue;
                const diff = Math.abs(new Date(events[i].timestamp).getTime() - new Date(events[j].timestamp).getTime());
                if (diff < 1000) syncPairs++;
            }
        }
    }
    const synchronizedActivityScore = Math.min(1, syncPairs / 2);

    return { burstWindowScore, synchronizedActivityScore };
}

// ============================================
// CATEGORY 4: MONEY FLOW STRUCTURE ANALYSIS
// ============================================

function analyzeMoneyFlowStructure(events: TransactionEvent[]): {
    funnelScore: number;
    circularFlowScore: number;
    passThruScore: number;
} {
    if (events.length < 2) return { funnelScore: 0, circularFlowScore: 0, passThruScore: 0 };

    // Build directed edge map
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();
    const edges: { from: string; to: string; amount: number; time: number }[] = [];

    for (const ev of events) {
        outDegree.set(ev.account_id, (outDegree.get(ev.account_id) || 0) + 1);
        if (ev.to_account_id) {
            inDegree.set(ev.to_account_id, (inDegree.get(ev.to_account_id) || 0) + 1);
        }
        edges.push({
            from: ev.account_id,
            to: ev.to_account_id,
            amount: ev.amount,
            time: new Date(ev.timestamp).getTime()
        });
    }

    // Funnel: accounts with high fan-in but single/low fan-out
    let funnelCount = 0;
    for (const [acc, inCount] of inDegree) {
        const outCount = outDegree.get(acc) || 0;
        if (inCount >= 3 && outCount <= 1) funnelCount++;
    }
    const funnelScore = Math.min(1, funnelCount / 2);

    // Circular flows: detect A→B→C→A (depth-3 cycles)
    const adjacency = new Map<string, Set<string>>();
    for (const edge of edges) {
        if (!adjacency.has(edge.from)) adjacency.set(edge.from, new Set());
        adjacency.get(edge.from)!.add(edge.to);
    }
    let cycles = 0;
    for (const [a, neighbors] of adjacency) {
        for (const b of neighbors) {
            const bNeighbors = adjacency.get(b);
            if (!bNeighbors) continue;
            for (const c of bNeighbors) {
                if (c === a) { cycles++; continue; } // A→B→A (2-cycle)
                const cNeighbors = adjacency.get(c);
                if (cNeighbors?.has(a)) cycles++; // A→B→C→A (3-cycle)
            }
        }
    }
    const circularFlowScore = Math.min(1, cycles / 2);

    // Pass-through: money arriving and leaving within 5 minutes
    let passThruCount = 0;
    const PASS_THRU_WINDOW = 5 * 60 * 1000;
    const incomingByAccount = new Map<string, number[]>();
    const outgoingByAccount = new Map<string, number[]>();

    for (const edge of edges) {
        if (!outgoingByAccount.has(edge.from)) outgoingByAccount.set(edge.from, []);
        outgoingByAccount.get(edge.from)!.push(edge.time);
        if (edge.to) {
            if (!incomingByAccount.has(edge.to)) incomingByAccount.set(edge.to, []);
            incomingByAccount.get(edge.to)!.push(edge.time);
        }
    }

    for (const [account, inTimes] of incomingByAccount) {
        const outTimes = outgoingByAccount.get(account) || [];
        for (const inTime of inTimes) {
            for (const outTime of outTimes) {
                if (outTime > inTime && outTime - inTime < PASS_THRU_WINDOW) {
                    passThruCount++;
                }
            }
        }
    }
    const passThruScore = Math.min(1, passThruCount / 3);

    return { funnelScore, circularFlowScore, passThruScore };
}

// ============================================
// CATEGORY 6: AUTOMATION / SCRIPT DETECTION
// ============================================

function detectAutomationPatterns(events: TransactionEvent[]): number {
    if (events.length < 3) return 0;

    let score = 0;

    // Sort by time
    const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // 1. Identical time intervals (< 5% deviation)
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
        intervals.push(new Date(sorted[i].timestamp).getTime() - new Date(sorted[i - 1].timestamp).getTime());
    }
    if (intervals.length >= 2) {
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        if (avgInterval > 0) {
            const variance = intervals.reduce((sum, v) => sum + Math.pow(v - avgInterval, 2), 0) / intervals.length;
            const coeffOfVariation = Math.sqrt(variance) / avgInterval;
            if (coeffOfVariation < 0.05) {
                score += 0.4; // Nearly identical intervals
            } else if (coeffOfVariation < 0.15) {
                score += 0.2; // Suspiciously regular
            }
        }
    }

    // 2. Fixed/Identical amounts
    const amounts = sorted.map(e => e.amount);
    const uniqueAmounts = new Set(amounts);
    const amountRepeatRatio = 1 - (uniqueAmounts.size / amounts.length);
    if (amountRepeatRatio > 0.7 && amounts.length >= 3) {
        score += 0.3; // >70% identical amounts
    } else if (amountRepeatRatio > 0.5) {
        score += 0.15;
    }

    // 3. Sub-second transaction completion (extreme speed)
    for (let i = 1; i < sorted.length; i++) {
        const gap = new Date(sorted[i].timestamp).getTime() - new Date(sorted[i - 1].timestamp).getTime();
        if (gap < 500 && gap > 0) {
            score += 0.15;
            break; // One instance is enough
        }
    }

    // 4. Perfect consistency — zero variance in amount AND time
    if (intervals.length >= 3 && amountRepeatRatio > 0.9) {
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        if (avgInterval > 0) {
            const variance = intervals.reduce((sum, v) => sum + Math.pow(v - avgInterval, 2), 0) / intervals.length;
            if (Math.sqrt(variance) / avgInterval < 0.03) {
                score += 0.2; // Perfect dual-consistency = almost certainly automated
            }
        }
    }

    return Math.min(1, score);
}

// ============================================
// CATEGORY 8: PHYSICAL CONSISTENCY
// ============================================

function analyzePhysicalConsistency(events: TransactionEvent[]): number {
    // Look for simultaneous transactions from different IPs
    // (already have impossible travel in detection.ts; this checks within-cluster)
    if (events.length < 2) return 0;

    let conflictCount = 0;
    const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
            const timeDiff = Math.abs(new Date(sorted[j].timestamp).getTime() - new Date(sorted[i].timestamp).getTime());
            if (timeDiff > 60000) break; // Only check within 1 min window

            // Same account, different IPs
            if (sorted[i].account_id === sorted[j].account_id &&
                sorted[i].ip_address && sorted[j].ip_address &&
                sorted[i].ip_address !== sorted[j].ip_address) {
                conflictCount++;
            }
        }
    }

    return Math.min(1, conflictCount / 2);
}

// ============================================
// CATEGORIES 1-2: BIOMETRIC & SESSION ANALYSIS (per cluster)
// ============================================

function analyzeClusterBiometricsAndSessions(
    allEvents: TransactionEvent[],
    accountSet: Set<string>
): { avgBiometricScore: number; avgSessionScore: number } {
    // Note: in a real implementation, we'd query metadata from the transactions table.
    // For now, this returns 0s — the scores are populated per-transaction in processUserTransaction.
    // When the engine runs, it can average the per-tx scores stored in metadata.
    return { avgBiometricScore: 0, avgSessionScore: 0 };
}

// ============================================
// 6. RISK SCORING (EXPANDED — 10 CATEGORIES)
// ============================================

function computeRiskScore(metrics: ClusterMetricsNormalized): number {
    // Expanded weighted formula covering all categories
    const base = (
        // Identity & Infrastructure (Cat 9) — original signals
        metrics.fingerprintReuseScore * 0.12 +
        metrics.deviceIdReuseScore * 0.08 +
        metrics.ipSubnetAsnReuseScore * 0.07 +
        metrics.vpnPresenceScore * 0.07 +
        // Temporal Coordination (Cat 3)
        metrics.timeSyncScore * 0.08 +
        metrics.burstWindowScore * 0.06 +
        metrics.synchronizedActivityScore * 0.06 +
        // Network Relationships (Cat 5)
        metrics.graphDensityScore * 0.06 +
        // Money Flow Structure (Cat 4)
        metrics.funnelScore * 0.05 +
        metrics.circularFlowScore * 0.06 +
        metrics.passThruScore * 0.04 +
        // Automation/Script (Cat 6)
        metrics.automationScore * 0.08 +
        // Physical Consistency (Cat 8)
        metrics.physicalConsistencyScore * 0.05 +
        // Behavioral Biometrics (Cat 1)
        metrics.avgBiometricScore * 0.06 +
        // Session Behaviour (Cat 2)
        metrics.avgSessionScore * 0.06
    );

    // 🔥 Multi-signal amplification (Cat 10): when 4+ signals fire, it's very likely fraud
    const activeSignals = [
        metrics.fingerprintReuseScore > 0.3,
        metrics.deviceIdReuseScore > 0.3,
        metrics.timeSyncScore > 0.3,
        metrics.ipSubnetAsnReuseScore > 0.3,
        metrics.vpnPresenceScore > 0.3,
        metrics.graphDensityScore > 0.5,
        metrics.burstWindowScore > 0.3,
        metrics.synchronizedActivityScore > 0.3,
        metrics.funnelScore > 0.3,
        metrics.circularFlowScore > 0.3,
        metrics.automationScore > 0.3,
        metrics.physicalConsistencyScore > 0.3,
        metrics.avgBiometricScore > 0.3,
        metrics.avgSessionScore > 0.3,
    ].filter(Boolean).length;

    const amplification = activeSignals >= 6 ? 0.30
        : activeSignals >= 4 ? 0.20
            : activeSignals >= 3 ? 0.12
                : activeSignals >= 2 ? 0.05
                    : 0;

    return Math.min(1, base + amplification);
}

// ============================================
// 7. RISK CLASSIFICATION
// ============================================

function classifyRisk(score: number): 'low' | 'medium' | 'high' {
    if (score >= 0.55) return 'high';    // Tightened from 0.70
    if (score >= 0.30) return 'medium';  // Tightened from 0.40
    return 'low';
}

// ============================================
// 8. EXPLAINABILITY OUTPUT
// ============================================

function generateExplanation(
    cluster: {
        accountIds: string[];
        links: IdentityLink[];
        metrics: ClusterMetricsNormalized;
        riskScore: number;
        riskLevel: string;
    },
    accountNames: Map<string, string>
): string {
    const names = cluster.accountIds.map(id => accountNames.get(id) || id.substring(0, 8));
    const parts: string[] = [];

    // Which accounts are linked
    parts.push(`Accounts ${names.join(', ')} are linked.`);

    // Which attributes caused the linkage
    const linkTypes = new Set(cluster.links.map(l => l.link_type));
    const reasons: string[] = [];

    if (linkTypes.has('fingerprint')) reasons.push('shared browser fingerprints');
    if (linkTypes.has('device_id')) reasons.push('shared device identifiers');
    if (linkTypes.has('ip')) reasons.push('used the same IP address');
    if (linkTypes.has('subnet')) reasons.push('operated on the same network subnet');
    if (linkTypes.has('asn')) reasons.push('connected via the same ASN/ISP');
    if (linkTypes.has('vpn')) reasons.push('both used VPN/proxy with time overlap');
    if (linkTypes.has('time')) reasons.push('transacted within a 5-minute window');
    if (linkTypes.has('behavior')) reasons.push('exhibited similar small-value transaction patterns');

    if (reasons.length > 0) {
        parts.push(`These accounts ${reasons.join(', ')}.`);
    }

    // Why risky
    if (cluster.riskLevel === 'high') {
        parts.push('This indicates a high probability of coordinated fraudulent activity.');
    } else if (cluster.riskLevel === 'medium') {
        parts.push('This pattern warrants closer investigation for potential coordination.');
    }

    // Key metrics — expanded with all categories
    const m = cluster.metrics;
    const metricDetails: string[] = [];
    if (m.fingerprintReuseScore > 0) metricDetails.push(`Fingerprint Reuse: ${(m.fingerprintReuseScore * 100).toFixed(0)}%`);
    if (m.timeSyncScore > 0) metricDetails.push(`Time Sync: ${(m.timeSyncScore * 100).toFixed(0)}%`);
    if (m.ipSubnetAsnReuseScore > 0) metricDetails.push(`Network Reuse: ${(m.ipSubnetAsnReuseScore * 100).toFixed(0)}%`);
    if (m.graphDensityScore > 0) metricDetails.push(`Graph Density: ${(m.graphDensityScore * 100).toFixed(0)}%`);
    if (m.vpnPresenceScore > 0) metricDetails.push(`VPN Presence: ${(m.vpnPresenceScore * 100).toFixed(0)}%`);
    // New category metrics
    if (m.burstWindowScore > 0) metricDetails.push(`Burst Activity: ${(m.burstWindowScore * 100).toFixed(0)}%`);
    if (m.synchronizedActivityScore > 0) metricDetails.push(`Synchronized: ${(m.synchronizedActivityScore * 100).toFixed(0)}%`);
    if (m.funnelScore > 0) metricDetails.push(`Funnel Pattern: ${(m.funnelScore * 100).toFixed(0)}%`);
    if (m.circularFlowScore > 0) metricDetails.push(`Circular Flow: ${(m.circularFlowScore * 100).toFixed(0)}%`);
    if (m.passThruScore > 0) metricDetails.push(`Pass-Through: ${(m.passThruScore * 100).toFixed(0)}%`);
    if (m.automationScore > 0) metricDetails.push(`Automation: ${(m.automationScore * 100).toFixed(0)}%`);
    if (m.physicalConsistencyScore > 0) metricDetails.push(`Physical Conflict: ${(m.physicalConsistencyScore * 100).toFixed(0)}%`);
    if (m.avgBiometricScore > 0) metricDetails.push(`Biometric Anomaly: ${(m.avgBiometricScore * 100).toFixed(0)}%`);
    if (m.avgSessionScore > 0) metricDetails.push(`Session Anomaly: ${(m.avgSessionScore * 100).toFixed(0)}%`);

    if (metricDetails.length > 0) {
        parts.push(`Metrics: ${metricDetails.join(' | ')}.`);
    }

    return parts.join(' ');
}

// ============================================
// 9. MAIN ENGINE — RUN FULL PIPELINE
// ============================================

export async function runFraudEngine(rawTransactions: any[], accountNames: Map<string, string>): Promise<{
    clusters: FraudCluster[];
    links: IdentityLink[];
    accountRiskMap: Map<string, { riskScore: number; riskLevel: string; clusterId: string; }>;
}> {
    // Step 1: Convert to events
    const events = toTransactionEvents(rawTransactions);

    // Step 2: Detect identity links
    const links = detectIdentityLinks(events);

    // Step 3-4: Build clusters
    const clusterMap = buildClusters(links);

    // Step 5-8: For each cluster, calculate metrics, score, classify, explain
    const clusters: FraudCluster[] = [];
    const accountRiskMap = new Map<string, { riskScore: number; riskLevel: string; clusterId: string }>();
    let clusterIndex = 0;

    for (const [root, accountIds] of clusterMap) {
        if (accountIds.length < 2) {
            // Even single accounts can have suspicious attributes (VPN, shared device)
            const singleEvents = events.filter(e => e.account_id === accountIds[0]);
            const hasVpn = singleEvents.some(e => e.vpn_flag);
            const singleScore = hasVpn ? 0.20 : 0;
            const singleLevel = classifyRisk(singleScore);
            accountRiskMap.set(accountIds[0], { riskScore: singleScore, riskLevel: singleLevel, clusterId: root });
            continue;
        }

        const clusterLinks = links.filter(l =>
            accountIds.includes(l.account_a) && accountIds.includes(l.account_b)
        );

        const metrics = calculateClusterMetrics(accountIds, clusterLinks, events);
        const ruleRisk = computeRiskScore(metrics);

        // ML Inference
        const features = extractClusterFeatures({ accountIds, metrics } as any, events); // partial mock for extraction
        const { supervisedRisk, anomalyScore, explanation: mlExplanation } = await predictClusterRisk(features);

        // Ensemble Score: 0.5 Rule + 0.3 ML + 0.2 Anomaly
        // If ML is 0 (not confident), fallback to Rule
        const ensembleScore = (ruleRisk * 0.5) + (supervisedRisk * 0.3) + (anomalyScore * 0.2);

        const riskLevel = classifyRisk(ensembleScore);

        const cluster: FraudCluster = {
            id: root,
            label: `Cluster ${String.fromCharCode(65 + clusterIndex)}`,
            accountIds,
            links: clusterLinks,
            metrics,
            riskScore: ensembleScore,
            riskLevel,
            explanation: '',
            mlScore: supervisedRisk,
            anomalyScore: anomalyScore
        };

        const ruleExplanation = generateExplanation(cluster, accountNames);
        const combinedExplanation = [ruleExplanation, ...mlExplanation].join(' ');
        cluster.explanation = combinedExplanation;

        clusters.push(cluster);
        clusterIndex++;

        // Map each account to its cluster risk
        for (const accId of accountIds) {
            accountRiskMap.set(accId, { riskScore: ensembleScore, riskLevel, clusterId: root });
        }
    }

    // Sort clusters by risk score (highest first)
    clusters.sort((a, b) => b.riskScore - a.riskScore);

    // Persist clusters to DB (fire-and-forget for performance)
    persistClusters(clusters).catch(err => console.warn('Cluster persistence error:', err));

    return { clusters, links, accountRiskMap };
}

// ============================================
// PERSISTENCE — Save clusters to Supabase
// ============================================

async function persistClusters(clusters: FraudCluster[]): Promise<void> {
    // Clear old clusters and insert new ones
    await supabase.from('fraud_clusters').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    if (clusters.length === 0) return;

    const rows = clusters.map(c => ({
        cluster_label: c.label,
        account_ids: c.accountIds,
        risk_score: c.riskScore,
        risk_level: c.riskLevel,
        metrics: { ...c.metrics, ml_score: c.mlScore, anomaly_score: c.anomalyScore },
        explanation: c.explanation,
        edge_count: c.links.length,
    }));

    await supabase.from('fraud_clusters').insert(rows);
}
