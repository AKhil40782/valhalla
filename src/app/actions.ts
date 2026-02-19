'use server';

import { DEMO_ACCOUNTS, generateTransaction, Transaction } from "@/lib/simulation/generator";
import { generateFraudAlertEmail } from "@/lib/email-template";
import { addLiveTransaction, getLiveTransactions } from "@/lib/simulation/store";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import { sendFraudAlertEmailReal, sendAccountFrozenEmail, sendTestEmail as sendTestEmailInternal } from '@/lib/notifications/email';
import { sendTestWhatsapp } from '@/lib/notifications/whatsapp';
import { runFraudEngine, FraudCluster } from '@/lib/fraud/fraud-engine';

// Wrapper for email test function (server actions require async function exports)
export async function sendTestEmailAction(toEmail: string) {
    console.log('🧪 [ACTION DEBUG] sendTestEmailAction called for:', toEmail);
    const res = await sendTestEmailInternal(toEmail);
    console.log('🧪 [ACTION DEBUG] sendTestEmailAction result:', res);
    return res;
}

export async function sendTestWhatsappAction(toPhone: string) {
    return await sendTestWhatsapp(toPhone);
}

// ============================================
// SECURITY & COMPLIANCE HELPER
// ============================================

export async function logAuditAction(userId: string | null, action: string, resourceId?: string) {
    try {
        await supabase.from('audit_logs').insert({
            user_id: userId,
            action,
            resource_id: resourceId,
            ip_address: 'INTERNAL_SERVER_ACTION'
        });
    } catch (err) {
        console.error("Audit Logging Failed:", err);
    }
}

function maskAccountNumber(acc: string) {
    if (!acc || acc.length < 4) return '****';
    return `*******${acc.substring(acc.length - 4)}`;
}

// ============================================
// REAL-TIME FRAUD DATA (From Supabase)
// ============================================

export async function getRealFraudData(requesterId?: string, forceUnmask: boolean = false) {
    // 0️⃣ AUTH & AUDIT
    await logAuditAction(requesterId || null, 'view_fraud_graph');
    // 1️⃣ DATA ACQUISITION
    const { data: rawTransactions, error } = await supabase
        .from('transactions')
        .select(`*`)
        .order('timestamp', { ascending: false })
        .limit(100);

    if (error) {
        console.error("Error fetching transactions:", error);
        return { graphElements: [], timelineEvents: [], alerts: [], stats: {} };
    }

    // OPTIMIZATION: Only fetch relevant accounts and profiles (instead of entire DB)
    const involvedAccountIds = new Set<string>();
    const involvedAccountNumbers = new Set<string>();

    rawTransactions?.forEach((tx: any) => {
        if (tx.from_account_id) involvedAccountIds.add(tx.from_account_id);
        if (tx.to_account_number) involvedAccountNumbers.add(tx.to_account_number);
    });

    // Parallel fetch for accounts by ID and Account Number (since we have both keys)
    const [accByIdRes, accByNumRes] = await Promise.all([
        involvedAccountIds.size > 0 ? supabase.from('accounts').select('*').in('id', Array.from(involvedAccountIds)) : { data: [] },
        involvedAccountNumbers.size > 0 ? supabase.from('accounts').select('*').in('account_number', Array.from(involvedAccountNumbers)) : { data: [] }
    ]);

    // Merge unique accounts
    const allAccountsMap = new Map<string, any>();
    accByIdRes.data?.forEach((a: any) => allAccountsMap.set(a.id, a));
    accByNumRes.data?.forEach((a: any) => allAccountsMap.set(a.id, a));
    const accounts = Array.from(allAccountsMap.values());

    // Fetch only relevant profiles
    const involvedUserIds = new Set(accounts.map((a: any) => a.user_id).filter(Boolean));
    const { data: profiles } = involvedUserIds.size > 0
        ? await supabase.from('profiles').select('*').in('id', Array.from(involvedUserIds))
        : { data: [] };

    const accountMap = new Map(accounts?.map(a => [a.id, a]) || []);
    const accountByNumber = new Map();
    accounts?.forEach(a => {
        if (a.account_number) accountByNumber.set(a.account_number.trim().toUpperCase(), a);
    });
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // 2️⃣ METRIC TRACKERS
    const deviceMap = new Map<string, Set<string>>();
    const ipMap = new Map<string, Set<string>>();
    const accountTxsMap = new Map<string, any[]>();
    const inDegreeMap = new Map<string, number>();
    const outDegreeMap = new Map<string, number>();
    const timeSyncMap = new Map<string, number>();

    const transactions = rawTransactions?.map(tx => {
        const fromAccount = accountMap.get(tx.from_account_id);
        const cleanToNum = (tx.to_account_number || '').trim().toUpperCase();
        const toAccount = accountByNumber.get(cleanToNum);

        const fromProfile = fromAccount ? profileMap.get(fromAccount.user_id) : null;
        const toProfile = toAccount ? profileMap.get(toAccount.user_id) : null;

        const transformed = {
            ...tx,
            from_name: fromProfile?.full_name || fromAccount?.virtual_name || (fromAccount ? 'Unknown User' : 'External / Unknown'),
            to_account_id: toAccount?.id || cleanToNum, // Use UUID if found, else normalized number
            to_name: toProfile?.full_name || toAccount?.virtual_name || tx.to_account_number,
        };

        if (tx.device_id) {
            if (!deviceMap.has(tx.device_id)) deviceMap.set(tx.device_id, new Set());
            deviceMap.get(tx.device_id)!.add(tx.from_account_id);
        }
        if (tx.ip_address) {
            if (!ipMap.has(tx.ip_address)) ipMap.set(tx.ip_address, new Set());
            ipMap.get(tx.ip_address)!.add(tx.from_account_id);
        }

        if (!accountTxsMap.has(tx.from_account_id)) accountTxsMap.set(tx.from_account_id, []);
        accountTxsMap.get(tx.from_account_id)!.push(transformed);

        outDegreeMap.set(tx.from_account_id, (outDegreeMap.get(tx.from_account_id) || 0) + 1);
        inDegreeMap.set(transformed.to_account_id, (inDegreeMap.get(transformed.to_account_id) || 0) + 1);

        return transformed;
    }) || [];

    // 3️⃣ FRAUD ENGINE — Multi-Attribute Identity Linking & Cluster Risk
    // Build account name map for explainability
    const accountNameMap = new Map<string, string>();
    for (const [id, acc] of accountMap) {
        const profile = profileMap.get(acc.user_id);
        accountNameMap.set(id, profile?.full_name || acc.account_number || id);
    }

    // Also resolve to_account_ids from tx data
    transactions.forEach(tx => {
        if (!accountNameMap.has(tx.to_account_id)) {
            accountNameMap.set(tx.to_account_id, tx.to_name || tx.to_account_id);
        }
    });

    // Run the 9-step fraud engine
    const engineResult = await runFraudEngine(rawTransactions || [], accountNameMap);
    const { clusters: fraudClusters, accountRiskMap: engineRiskMap } = engineResult;

    // 3️⃣b COORDINATION & TEMPORAL ANALYSIS (legacy metrics for UI)
    transactions.forEach(tx => {
        const overlaps = transactions.filter(t =>
            t.id !== tx.id &&
            Math.abs(new Date(t.timestamp).getTime() - new Date(tx.timestamp).getTime()) < 180000
        );
        if (overlaps.length > 0) {
            timeSyncMap.set(tx.from_account_id, (timeSyncMap.get(tx.from_account_id) || 0) + overlaps.length);
        }
    });

    // ------------------------------------------------------------------
    // 4️⃣ OPTIMIZED GRAPH GENERATION (Edge Aggregation & Performance)
    // ------------------------------------------------------------------

    const nodes: any[] = [];
    const processedNodes = new Set<string>();

    // Aggregation Maps
    const edgeMap = new Map<string, { source: string, target: string, amount: number, count: number, type: string }>();
    const uniqueIpsToResolve = new Set<string>();

    transactions.forEach(tx => {
        // Collect IPs for batch resolution
        const rawIp = (tx.ip_address || '').split(' ')[0].split('[')[0].trim();
        if (rawIp && rawIp !== '0.0.0.0' && (!tx.asn || tx.asn === 'Unknown ISP')) {
            uniqueIpsToResolve.add(rawIp);
        }

        // Aggregate Edges
        if (tx.from_account_id && tx.to_account_id) {
            const edgeKey = `${tx.from_account_id}-${tx.to_account_id}`;
            const existing = edgeMap.get(edgeKey);
            if (existing) {
                existing.amount += tx.amount;
                existing.count += 1;
            } else {
                edgeMap.set(edgeKey, {
                    source: tx.from_account_id,
                    target: tx.to_account_id,
                    amount: tx.amount,
                    count: 1,
                    type: 'transfer'
                });
            }
        }
    });

    // 🚀 BATCH IP RESOLUTION
    const ipCache = new Map<string, any>();
    const ipArray = Array.from(uniqueIpsToResolve);
    // Limit to 5 to prevent rate-limiting and timeouts (was 20)
    const ipsToFetch = ipArray.slice(0, 5);

    if (ipsToFetch.length > 0) {
        await Promise.all(ipsToFetch.map(async (ip) => {
            try {
                const data = await getRealIpLocation(ip);
                if (data) ipCache.set(ip, data);
            } catch (e) { /* ignore */ }
        }));
    }

    // Build Nodes
    const potentialLinksCount = (accounts?.length || 1) * ((accounts?.length || 1) - 1);
    const graphDensity = potentialLinksCount > 0 ? transactions.length / potentialLinksCount : 0;

    // Build cluster lookup
    const accountClusterMap = new Map<string, FraudCluster>();
    for (const cluster of fraudClusters) {
        for (const accId of cluster.accountIds) {
            accountClusterMap.set(accId, cluster);
        }
    }

    transactions.forEach(tx => {
        // NODES
        [tx.from_account_id, tx.to_account_id].forEach(accId => {
            if (accId && !processedNodes.has(accId)) {
                // Identity Sharing Metrics (for display)
                let maxDeviceReuse = 0;
                deviceMap.forEach(users => { if (users.has(accId)) maxDeviceReuse = Math.max(maxDeviceReuse, users.size); });
                let maxIpReuse = 0;
                ipMap.forEach(users => { if (users.has(accId)) maxIpReuse = Math.max(maxIpReuse, users.size); });

                const syncValue = timeSyncMap.get(accId) || 0;
                const normalizedSync = Math.min(1, syncValue / 5);
                const burstMode = (accountTxsMap.get(accId)?.filter(t => (Date.now() - new Date(t.timestamp).getTime()) < 900000).length || 0) >= 5;
                const thresholdDodging = transactions.some(t => t.from_account_id === accId && t.amount >= 9000 && t.amount <= 9999);

                const engineData = engineRiskMap.get(accId);
                const inDegree = inDegreeMap.get(accId) || 0;
                let finalRiskScore = engineData ? engineData.riskScore * 100 : 0;

                if (inDegree >= 3) finalRiskScore = Math.max(finalRiskScore, 85);
                else if (inDegree >= 2) finalRiskScore = Math.max(finalRiskScore, 65);
                if (burstMode) finalRiskScore = Math.min(100, finalRiskScore + 15);
                if (thresholdDodging) finalRiskScore = Math.min(100, finalRiskScore + 20);
                finalRiskScore = Math.min(100, finalRiskScore);

                const label = (accId.startsWith('SAL_') ? accId : (profileMap.get(accountMap.get(accId)?.user_id)?.full_name || accountMap.get(accId)?.virtual_name)) || accId;
                const maskedLabel = forceUnmask ? label : (accId.startsWith('SAL_') ? maskAccountNumber(accId) : label);

                const userIps = ipMap.get(accId);
                let isVpn = accountTxsMap.get(accId)?.some(tx => tx.vpn_flag) || false;

                if (!isVpn && userIps) {
                    userIps.forEach(ip => {
                        // 185.x is our sim VPN, 45.33 is Linode (often VPN), 10.0 is legacy sim
                        if (ip.startsWith('45.33') || ip.startsWith('185.') || ip.startsWith('10.0')) isVpn = true;
                    });
                }

                const cluster = accountClusterMap.get(accId);

                nodes.push({
                    data: {
                        id: accId,
                        label: maskedLabel,
                        type: 'account',
                        isHacker: profileMap.get(accountMap.get(accId)?.user_id)?.role === 'hacker',
                        isVpn: isVpn,
                        ips: Array.from(userIps || []).slice(0, 3), // Limit payload size
                        risk: finalRiskScore,
                        clusterId: cluster?.id || null,
                        clusterLabel: cluster?.label || null,
                        clusterRiskLevel: cluster?.riskLevel || engineData?.riskLevel || 'low',
                        clusterExplanation: cluster?.explanation || null,
                        clusterMetrics: cluster?.metrics || null,
                        metrics: {
                            deviceReuse: maxDeviceReuse,
                            ipReuse: maxIpReuse,
                            syncScore: (normalizedSync * 100).toFixed(0),
                            degree: (inDegreeMap.get(accId) || 0) + (outDegreeMap.get(accId) || 0),
                            burstMode,
                            thresholdDodging,
                            engineRiskScore: engineData ? (engineData.riskScore * 100).toFixed(0) : '0',
                            fingerprintReuse: cluster?.metrics?.fingerprintReuseScore ? (cluster.metrics.fingerprintReuseScore * 100).toFixed(0) : '0',
                            timeSyncEngine: cluster?.metrics?.timeSyncScore ? (cluster.metrics.timeSyncScore * 100).toFixed(0) : '0',
                            networkReuse: cluster?.metrics?.ipSubnetAsnReuseScore ? (cluster.metrics.ipSubnetAsnReuseScore * 100).toFixed(0) : '0',
                            graphDensityEngine: cluster?.metrics?.graphDensityScore ? (cluster.metrics.graphDensityScore * 100).toFixed(0) : '0',
                            vpnPresence: cluster?.metrics?.vpnPresenceScore ? (cluster.metrics.vpnPresenceScore * 100).toFixed(0) : '0',
                            // New ML fields
                            ml_score: cluster?.mlScore || 0,
                            anomaly_score: cluster?.anomalyScore || 0
                        }
                    },
                    classes: `${finalRiskScore > 80 ? 'critical-risk' : finalRiskScore > 50 ? 'high-risk' : finalRiskScore > 30 ? 'medium-risk' : ''} ${profileMap.get(accountMap.get(accId)?.user_id)?.role === 'hacker' || accountMap.get(accId)?.simulation_type === 'Hacker' ? 'hacker-node' : ''} ${isVpn ? 'vpn-node' : ''}`.trim()
                });
                processedNodes.add(accId);
            }
        });

        // 🔗 FORENSIC ENTITY CHAIN (Account -> Device -> IP)
        if (tx.device_id) {
            const devId = tx.device_id;
            if (!processedNodes.has(devId)) {
                nodes.push({
                    data: {
                        id: devId,
                        label: `Device: ${devId.substring(0, 8)}...`,
                        type: 'device',
                        risk: (deviceMap.get(devId)?.size || 0) > 1 ? 75 : 15
                    },
                    classes: (deviceMap.get(devId)?.size || 0) > 1 ? 'high-risk' : ''
                });
                processedNodes.add(devId);
            }
            // Device links don't get aggregated usually, but we could if needed
            // Checking if edge exists? No, for Device->Account there's usually one link per tx.
            // But if user used same device 100 times, we get 100 edges.
            // Deduplicate Device Links!
            const devEdgeKey = `${tx.from_account_id}-${devId}`;
            if (!edgeMap.has(devEdgeKey)) {
                edgeMap.set(devEdgeKey, { source: tx.from_account_id, target: devId, amount: 0, count: 1, type: 'device_link' });
            }

            if (tx.ip_address) {
                const ipId = tx.ip_address;
                if (!processedNodes.has(ipId)) {
                    nodes.push({
                        data: {
                            id: ipId,
                            label: `IP: ${ipId}`,
                            type: 'ip',
                            risk: (ipMap.get(ipId)?.size || 0) > 1 ? 70 : 10
                        },
                        classes: (ipMap.get(ipId)?.size || 0) > 1 ? 'medium-risk' : ''
                    });
                    processedNodes.add(ipId);
                }
                const netEdgeKey = `${devId}-${ipId}`;
                if (!edgeMap.has(netEdgeKey)) {
                    edgeMap.set(netEdgeKey, { source: devId, target: ipId, amount: 0, count: 1, type: 'network_link' });
                }
            }
        }
    });

    const edges = Array.from(edgeMap.values()).map(e => ({
        data: e
    }));

    // 🚨 CLUSTER RISK INHERITANCE
    const clusterMaxRisk = new Map<string, number>();
    nodes.forEach(node => {
        if (node.data.clusterId && node.data.type === 'account') {
            const currentMax = clusterMaxRisk.get(node.data.clusterId) || 0;
            if (node.data.risk > currentMax) {
                clusterMaxRisk.set(node.data.clusterId, node.data.risk);
            }
        }
    });

    nodes.forEach(node => {
        if (node.data.clusterId && node.data.type === 'account') {
            const maxRisk = clusterMaxRisk.get(node.data.clusterId);
            if (maxRisk && maxRisk > node.data.risk) {
                node.data.risk = maxRisk;
                node.classes = `${maxRisk > 80 ? 'critical-risk' : maxRisk > 50 ? 'high-risk' : maxRisk > 30 ? 'medium-risk' : ''} ${node.data.isHacker ? 'hacker-node' : ''} ${node.data.isVpn ? 'vpn-node' : ''}`.trim();
            }
        }
    });

    // 4️⃣ ALERT GENERATION
    const alerts: any[] = [];
    const maxInDegreeVal = Math.max(...Array.from(inDegreeMap.values()), 0);
    const topHackerNodeId = Array.from(inDegreeMap.entries())
        .filter(([id]) => id !== 'SYSTEM_FREEZE')
        .sort((a, b) => b[1] - a[1])[0]?.[0];

    if (maxInDegreeVal >= 3) {
        const suspectName = accountByNumber.get(topHackerNodeId!)?.account_number || topHackerNodeId;
        alerts.push({ id: 'alert-critical-fanin', title: `🔴 CRITICAL: Aggregated Fan-In Cluster`, severity: 'Critical', time: 'LIVE', description: `Core node "${suspectName}" is receiving coordinated funds from ${maxInDegreeVal} sources. High probability of Money Laundering.` });
    } else if (maxInDegreeVal >= 2) {
        const suspectName = accountByNumber.get(topHackerNodeId!)?.account_number || topHackerNodeId;
        alerts.push({ id: 'alert-moderate-velocity', title: `🟡 MODERATE: Multi-Source Inflow`, severity: 'Medium', time: 'LIVE', description: `Account "${suspectName}" is receiving funds from ${maxInDegreeVal} different accounts. Monitoring for "Mule" behavior.` });
    }

    const accountNodes = nodes.filter(n => n.data.type === 'account');
    const totalSync = accountNodes.reduce((sum, n) => sum + parseFloat(n.data.metrics?.syncScore || '0'), 0);
    const avgSync = accountNodes.length > 0 ? (totalSync / accountNodes.length).toFixed(0) : '0';

    // 5️⃣ TIMELINE GENERATION (Using Cache)
    const timelineEvents = transactions.map(tx => {
        let riskLevel = 'low';
        if (tx.amount > 50000) riskLevel = 'critical';
        else if (tx.amount >= 9000 && tx.amount <= 9999) riskLevel = 'high';
        else if (tx.amount >= 5000) riskLevel = 'medium';

        const rawIp = (tx.ip_address || '').split(' ')[0].split('[')[0].trim();
        let ipCity = 'Unknown';
        let ispName = 'Unknown';
        let isVpnTransaction = tx.vpn_flag || false;
        let ipLat = null;
        let ipLon = null;

        if (tx.asn && tx.asn !== 'Unknown ISP') {
            ispName = tx.asn;
            if (tx.location && !tx.location.includes('(IP)')) {
                // location good
            } else {
                ipCity = tx.location?.split(' ')[0] || 'Unknown';
            }
        } else {
            // Use pre-fetched cache
            if (ipCache.has(rawIp)) {
                const data = ipCache.get(rawIp);
                ipCity = data.city;
                ispName = data.isp;
                ipLat = data.lat;
                ipLon = data.lon;
                const ispLower = ispName.toLowerCase();
                if (ispLower.includes('vpn') || ispLower.includes('cloud') || ispLower.includes('hosting') || ispLower.includes('proxy')) {
                    isVpnTransaction = true;
                }
                // Dist check omitted for speed in this pass, trust legacy flag or basic ISP check
            }
        }

        return {
            id: tx.id,
            timestamp: tx.timestamp,
            description: `₹${tx.amount.toLocaleString()} flow from ${tx.from_name} to ${tx.to_name}`,
            riskLevel,
            type: riskLevel === 'critical' || riskLevel === 'high' ? 'ALERT' : 'FLOW',
            details: {
                ...tx,
                from: tx.from_name,
                to: tx.to_name,
                time: tx.timestamp,
                ip: tx.ip_address || 'Unknown',
                subnet: tx.ip_address && tx.ip_address.includes('.') ? tx.ip_address.split('.').slice(0, 3).join('.') + '.0' : 'Unknown',
                imei: tx.device_id || 'Unknown Hardware ID',
                device: tx.device_name || 'Web Browser',
                isVpn: isVpnTransaction,
                isp: ispName,
                ipCity: ipCity,
                ipLat: ipLat,
                ipLon: ipLon,
                macAddress: tx.device_id ? `MAC-${tx.device_id.substring(0, 2)}...` : 'N/A'
            }
        };
    });

    return {
        graphElements: [...nodes, ...edges],
        timelineEvents,
        alerts,
        stats: {
            totalTransactions: transactions.length,
            uniqueAccounts: accounts?.length || 0,
            graphDensity: graphDensity.toFixed(4),
            avgSyncScore: avgSync,
            suspectedHacker: maxInDegreeVal >= 3 ? 'Critical' : maxInDegreeVal >= 2 ? 'Moderate' : 'Negative',
        },
        hackerInfo: (topHackerNodeId && maxInDegreeVal >= 2) ? {
            id: topHackerNodeId,
            name: accountByNumber.get(topHackerNodeId)?.account_number || topHackerNodeId,
            inDegree: maxInDegreeVal,
            severity: maxInDegreeVal >= 3 ? 'CRITICAL' : 'MODERATE',
            is_frozen: accountByNumber.get(topHackerNodeId)?.is_frozen || false
        } : null,
        fraudClusters: fraudClusters.map(c => ({
            id: c.id,
            label: c.label,
            accountIds: c.accountIds,
            riskScore: (c.riskScore * 100).toFixed(0),
            riskLevel: c.riskLevel,
            explanation: c.explanation,
            metrics: c.metrics,
            edgeCount: c.links.length,
        })),
    };
}
// ============================================
// LIVE ATTACK ACTION (Real + Simulation)
// ============================================

// 🚨 REAL-TIME FRAUD DETECTION HELPER
async function runFraudDetection(data: {
    fromId: string,
    toAccount: string,
    amount: number,
    senderAccount: any,
    receiverAccount: any,
    toId: string,
    forensics?: any
}) {
    let riskLevel = 'LOW';
    let alertType: 'CRITICAL' | 'MODERATE' | 'LOW' = 'LOW';
    let detectionReason = "Suspicious Pattern";

    // CHECK 1: Existing Watchlist Status
    const senderRisk = data.senderAccount?.risk_score || 0;
    const receiverRisk = data.receiverAccount?.risk_score || 0;

    if (senderRisk >= 80 || receiverRisk >= 80) {
        riskLevel = 'CRITICAL';
        alertType = 'CRITICAL';
        detectionReason = "Activity on Critical Risk Account";
    } else if ((senderRisk >= 50 || receiverRisk >= 50)) {
        riskLevel = 'HIGH';
        alertType = 'MODERATE';
        detectionReason = "Activity on Moderate Risk Account";
    }

    // CHECK 2: Transaction Specifics (Amount)
    if (data.amount > 50000) {
        riskLevel = 'CRITICAL';
        alertType = 'CRITICAL';
        detectionReason = "High Value Transaction (>50k)";
    }
    else if (data.amount >= 5000) {
        riskLevel = 'HIGH';
        alertType = 'MODERATE';
        detectionReason = "Elevated Value Transaction (>5k)";
    }
    else if (data.amount >= 9000 && data.amount <= 9999) {
        riskLevel = 'HIGH';
        alertType = 'MODERATE';
        detectionReason = "Structuring / Smurfing Detected";
    }

    // CHECK 4: Hardware & Geo-Forensics (Real-Time Signals)
    if (data.forensics) {
        // A. Device Reuse / Cloning Detection
        if (data.forensics.deviceId && data.senderAccount) {
            const { data: previousDevices } = await supabase
                .from('transactions')
                .select('device_id')
                .eq('from_account_id', data.fromId)
                .neq('device_id', data.forensics.deviceId)
                .limit(1);

            if (previousDevices && previousDevices.length > 0) {
                riskLevel = 'CRITICAL';
                alertType = 'CRITICAL';
                detectionReason = "Unauthorized Device Signature (Cloning Suspected)";
            }
        }

        // B. VPN / Proxy Detection (Simulation of IP range intelligence)
        const isSuspiciousIp = data.forensics.ip.startsWith('192.168') || data.forensics.ip.startsWith('10.0');
        if (isSuspiciousIp && alertType !== 'CRITICAL') {
            riskLevel = 'HIGH';
            alertType = 'MODERATE';
            detectionReason = "Suspicious Network Layer (Proxy/VPN)";
        }

        // C. Impossible Travel (Geo-Velocity)
        if (data.forensics.location && data.forensics.location !== "Unknown (Permission Denied)") {
            const { data: lastLocation } = await supabase
                .from('transactions')
                .select('location')
                .eq('from_account_id', data.fromId)
                .order('timestamp', { ascending: false })
                .limit(1)
                .single();

            if (lastLocation?.location && lastLocation.location !== data.forensics.location) {
                riskLevel = 'CRITICAL';
                alertType = 'CRITICAL';
                detectionReason = "Impossible Travel Signature (Geo-Drift)";
            }
        }
    }

    // CHECK 3: Fan-In (Cluster Analysis)
    const { data: recentTxs } = await supabase
        .from('transactions')
        .select('from_account_id')
        .eq('to_account_number', data.toAccount)
        .gte('timestamp', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    if (recentTxs) {
        const uniqueSenders = new Set(recentTxs.map(t => t.from_account_id)).size;
        if (uniqueSenders >= 3 && alertType !== 'CRITICAL') {
            riskLevel = 'CRITICAL';
            alertType = 'CRITICAL';
            detectionReason = "Fan-In Money Mule Detected";
        } else if (uniqueSenders >= 2 && alertType === 'LOW') {
            riskLevel = 'HIGH';
            alertType = 'MODERATE';
            detectionReason = "Suspicious Inflow Cluster";
        }
    }

    // CHECK 5: Geo-Location Mismatch (VPN/Proxy Leak) & ISP Check
    if (data.forensics?.location && data.forensics?.ip) {
        const ipLoc = await getRealIpLocation(data.forensics.ip);

        if (ipLoc) {
            // A. ISP / Org Analysis (VPN Detection)
            const isp = (ipLoc.isp || '').toLowerCase();
            if (isp.includes('vpn') || isp.includes('cloud') || isp.includes('hosting') || isp.includes('datacenter') || isp.includes('proxy')) {
                riskLevel = 'HIGH'; // Elevated risk for known hosting providers
                if (alertType !== 'CRITICAL') {
                    alertType = 'MODERATE';
                    detectionReason = `Suspicious ISP Detected: ${ipLoc.isp}`;
                }
            }

            // B. Geo-Mismatch Analysis
            // Parse GPS string "lat, lon"
            const [gpsLat, gpsLon] = data.forensics.location.split(',').map((c: string) => parseFloat(c.trim()));
            if (!isNaN(gpsLat) && !isNaN(gpsLon)) {
                // Determine tolerance based on accuracy confidence (relaxed to 500km for real world drift)
                const driftTolerance = 500;
                const dist = calculateHaversineDistance(gpsLat, gpsLon, ipLoc.lat, ipLoc.lon);

                // If distance > tolerance and not a private IP, flag it
                if (dist > driftTolerance && ipLoc.city !== 'Private Network') {
                    riskLevel = 'CRITICAL';
                    alertType = 'CRITICAL';
                    detectionReason = `True Location Mismatch: GPS is ${dist.toFixed(0)}km from IP Location (${ipLoc.city})`;
                }
            }
        }
    }

    // CHECK 6: Device Anomaly (Headless Browser)
    if (data.forensics?.device) {
        const dev = data.forensics.device.toLowerCase();
        if (dev.includes('headless') || dev.includes('selenium') || dev.includes('puppeteer') || dev.includes('bot')) {
            riskLevel = 'CRITICAL';
            alertType = 'CRITICAL';
            detectionReason = "Automation Tool Detected (Headless Browser)";
        }
    }

    console.log(`🔍 [RISK ENGINE] Evaluated ${data.amount} to ${data.toAccount} -> Risk: ${riskLevel}, Alert: ${alertType}`);

    // EXECUTE ALERTS
    if (alertType !== 'LOW') {
        console.log(`🚨 RISK DETECTED: ${alertType} (${detectionReason})`);

        // A. Update Risk Score in DB
        if (data.receiverAccount) {
            const newScore = Math.min(100, Math.max(data.receiverAccount.risk_score || 0, alertType === 'CRITICAL' ? 85 : 55));
            await supabase.from('accounts').update({ risk_score: newScore }).eq('id', data.receiverAccount.id);
        }

        // B. Send Email Alert
        const { data: affectedUser } = await supabase
            .from('accounts')
            .select('user_id, profiles(email, full_name)')
            .eq('id', data.receiverAccount?.id || data.toId)
            .single();

        const { data: adminUser } = await supabase
            .from('profiles')
            .select('email, full_name')
            .neq('email', 'alice@demo.com')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // PRIORITY ROUTING: Ensure the primary investigator (Varun) AND the user get it
        const primaryInvestigator = 'varunsanjeevula91@gmail.com';
        const profile = Array.isArray(affectedUser?.profiles) ? affectedUser.profiles[0] : affectedUser?.profiles;
        const userEmail = profile?.email || 'tellapallyakhil89@gmail.com';

        console.log(`📡 [ENGINE] Dispatching alerts to: ${primaryInvestigator} & ${userEmail}`);

        const alertPayload = {
            recipientName: 'Security Lead & User',
            alertType: alertType,
            suspectAccount: `${data.toAccount} (${detectionReason})`,
            incomingSources: (recentTxs?.length || 0) + 1,
            totalAmount: data.amount,
            caseId: `ALERT-${Date.now().toString().slice(-6)}`,
            timestamp: new Date()
        };

        // Send to investigator
        await sendFraudAlertEmailReal({
            ...alertPayload,
            recipientEmail: primaryInvestigator,
            recipientName: 'Varun (Lead Investigator)'
        });

        // Send to user (if different)
        if (userEmail !== primaryInvestigator) {
            await sendFraudAlertEmailReal({
                ...alertPayload,
                recipientEmail: userEmail,
                recipientName: profile?.full_name || 'Valued Customer'
            });
        }
    }

    return { riskLevel, alertType };
}

// 🏦 USER DASHBOARD TRANSACTION ACTION
export async function processUserTransaction(data: {
    amount: number,
    recipient: string,
    fromAccountId: string,
    forensics: any
}) {
    console.log('💰 [DASHBOARD] processUserTransaction started:', data.amount, 'to', data.recipient);
    try {
        // 1. Validate & Fetch Accounts
        const { data: senderAccount } = await supabase.from('accounts').select('*').eq('id', data.fromAccountId).single();
        // Fix: Case-insensitive lookup and trim whitespace to prevent "Account not found" for valid inputs
        const safeRecipient = data.recipient.trim();
        let { data: receiverAccount } = await supabase.from('accounts').select('*').ilike('account_number', safeRecipient).maybeSingle();

        // Fallback: Lookup by Full Name if account number not found
        if (!receiverAccount) {
            const { data: profile } = await supabase.from('profiles').select('id').ilike('full_name', safeRecipient).maybeSingle();
            if (profile) {
                const { data: byProfile } = await supabase.from('accounts').select('*').eq('user_id', profile.id).single();
                receiverAccount = byProfile;
            }
        }

        if (!senderAccount || senderAccount.balance < data.amount) {
            return { success: false, error: "Insufficient funds" };
        }

        if (senderAccount.is_frozen) {
            return { success: false, error: "Account Frozen" };
        }

        if (!receiverAccount) {
            return { success: false, error: "Invalid Recipient: Account not found" };
        }

        if (data.forensics.location && (data.forensics.location.includes('Permission Denied') || data.forensics.location === 'Unknown')) {
            return { success: false, error: "Secure Sync Failed: Location permission denied. Please allow location access." };
        }

        // 2. Insert Transaction
        const txId = uuidv4();
        const timestamp = new Date().toISOString();

        // 🚀 OPTIMIZATION: Resolve IP Intelligence ONCE at write time
        let asn = 'Unknown ISP';
        let vpnFlag = false;
        let finalLocation = data.forensics.location;

        try {
            if (data.forensics.ip && data.forensics.ip !== '0.0.0.0') {
                const ipData = await getRealIpLocation(data.forensics.ip);
                if (ipData) {
                    asn = ipData.isp || 'Unknown ISP';
                    const ispLower = asn.toLowerCase();
                    if (ispLower.includes('vpn') || ispLower.includes('cloud') || ispLower.includes('hosting') || ispLower.includes('datacenter') || ispLower.includes('proxy')) {
                        vpnFlag = true;
                    }
                    // Fallback location if GPS denied
                    if ((!finalLocation || finalLocation.includes('Permission Denied')) && ipData.city) {
                        finalLocation = `${ipData.city} (IP)`;
                    }
                }
            }
        } catch (e) { console.error("IP Lookup Failed", e); }

        await supabase.from('transactions').insert({
            id: txId,
            from_account_id: data.fromAccountId,
            to_account_id: receiverAccount?.id, // 👈 CRITICAL FIX: Link to receiver's UUID
            to_account_number: receiverAccount?.account_number || data.recipient, // 👈 FIX: Use real number if found
            amount: data.amount,
            ip_address: data.forensics.ip,
            device_id: data.forensics.deviceId,
            device_name: data.forensics.device,
            location: finalLocation,
            timestamp: timestamp,
            // Store intelligence to avoid re-fetching on read
            asn: asn,
            vpn_flag: vpnFlag,
            device_fingerprint_id: data.forensics.deviceId ? `fp_${data.forensics.deviceId.substring(0, 12)}` : null,
            metadata: data.forensics // 🚀 Save full forensics (OS, Browser, Screen, Timezone)
        });

        // 3. Update Balances
        await supabase.from('accounts').update({ balance: senderAccount.balance - data.amount }).eq('id', senderAccount.id);
        if (receiverAccount) {
            await supabase.from('accounts').update({ balance: receiverAccount.balance + data.amount }).eq('id', receiverAccount.id);
        }

        // 4. 🚨 RUN FRAUD DETECTION
        await runFraudDetection({
            fromId: data.fromAccountId,
            toAccount: data.recipient,
            amount: data.amount,
            senderAccount,
            receiverAccount,
            toId: receiverAccount?.id || data.recipient,
            forensics: data.forensics
        });

        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

export async function createAttackTransaction(data: { sender: string, amount: number, receiver: string, isVpn: boolean, deviceId: string }) {
    console.log("🔥🔥🔥 [PROCESS START] createAttackTransaction received:", data);

    try {
        const { data: accounts } = await supabase.from('accounts')
            .select('id, account_number, user_id, risk_score, is_frozen')
            .in('account_number', [data.sender, data.receiver]);

        const senderAccount = accounts?.find(a => a.account_number === data.sender);
        const receiverAccount = accounts?.find(a => a.account_number === data.receiver);

        const fromId = senderAccount ? senderAccount.id : (data.sender.includes('-') ? data.sender : uuidv4());
        const toId = receiverAccount ? receiverAccount.id : (data.receiver.includes('-') ? data.receiver : uuidv4());

        if (senderAccount?.is_frozen || receiverAccount?.is_frozen) {
            return { success: false, error: "Transaction Failed: Account Frozen" };
        }

        const txId = uuidv4();
        const timestamp = new Date().toISOString();

        const locations = [
            '17.3850, 78.4867', // Hyderabad
            '12.9716, 77.5946', // Bangalore
            '19.0760, 72.8777', // Mumbai
            '28.6139, 77.2090', // Delhi
            '6.5244, 3.3792',   // Lagos (High Risk)
            '40.7128, -74.0060' // New York
        ];

        // Generate fingerprint from device ID (simulates browser fingerprinting)
        const fingerprint = data.deviceId ? `fp_${data.deviceId.substring(0, 12)}` : null;
        // Simulate ASN based on IP
        const ipAddr = data.isVpn ? '45.33.21.99' : `106.51.22.${Math.floor(Math.random() * 255)}`;
        const asn = data.isVpn ? 'AS9009-M247' : 'AS55836-Reliance';

        const txData = {
            id: txId,
            from_account_id: fromId,
            to_account_number: data.receiver,
            amount: data.amount,
            status: 'completed',
            ip_address: ipAddr,
            device_name: data.isVpn ? 'Linux x86_64 | HeadlessBrowser' : 'Win32 | Chrome 120.0',
            device_id: data.deviceId,
            device_fingerprint_id: fingerprint,
            asn: asn,
            vpn_flag: data.isVpn,
            location: data.isVpn ? '6.5244, 3.3792' : locations[Math.floor(Math.random() * 4)],
            timestamp: timestamp
        };

        const { error: insertError } = await supabase.from('transactions').insert(txData);

        const simTx: Transaction = {
            id: txId,
            from_account_id: fromId,
            to_account_id: toId,
            amount: data.amount,
            timestamp: timestamp,
            ip_address: txData.ip_address,
            device_id: data.deviceId,
            location: 'Unknown',
            type: 'transfer'
        };
        addLiveTransaction(simTx);

        // 🚨 RUN FRAUD DETECTION
        const { riskLevel } = await runFraudDetection({
            fromId,
            toAccount: data.receiver,
            amount: data.amount,
            senderAccount,
            receiverAccount,
            toId,
            forensics: {
                ip: txData.ip_address,
                deviceId: txData.device_id,
                location: txData.location
            }
        });

        return { success: true, riskLevel };

    } catch (e) {
        console.error("Attack Simulation Error:", e);
        return { success: false, error: String(e) };
    }
}

// ============================================
// GEOLOCATION & DEVICE FUNDAMENTALS (New Metrics)
// ============================================

// ============================================
// GEOLOCATION & DEVICE FUNDAMENTALS (New Metrics)
// ============================================

// Real IP Geolocation Database (Using ip-api.com)
async function getRealIpLocation(ip: string): Promise<{ lat: number, lon: number, city: string, isp: string } | null> {
    try {
        // Skip local/private IPs
        if (ip.startsWith('192.168') || ip.startsWith('10.') || ip.startsWith('127.') || ip === '::1') {
            return { lat: 0, lon: 0, city: 'Private Network', isp: 'Local Network' };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout

        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,lat,lon,city,isp`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await response.json();

        if (data.status === 'success') {
            return {
                lat: data.lat,
                lon: data.lon,
                city: data.city,
                isp: data.isp
            };
        }
        return null;
    } catch (e) {
        // console.warn("IP Geolocation Fetch Failed/Timed Out:", e);
        return null;
    }
}

// Haversine Formula for Distance (km)
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}


// ============================================
// CLUSTER-BASED RISK CALCULATION ENGINE
// ============================================

interface ClusterMetrics {
    inDegree: number;      // How many accounts send TO this node
    outDegree: number;     // How many accounts receive FROM this node
    sharedDevices: number; // How many devices link to this account
    sharedIPs: number;     // How many IPs link to this account
    totalConnections: number;
}

function calculateClusterRisk(metrics: ClusterMetrics, baseRisk: number): number {
    // Weighted formula for cluster-based risk
    let clusterBonus = 0;

    // Fan-In Pattern (Many sending TO one) → High risk for receiver (Money Mule Hub)
    if (metrics.inDegree >= 3) {
        clusterBonus += 35; // Major red flag
    } else if (metrics.inDegree >= 2) {
        clusterBonus += 15;
    }

    // Fan-Out Pattern (One sending TO many) → High risk for sender (Distributor)
    if (metrics.outDegree >= 3) {
        clusterBonus += 25;
    }

    // Shared Device/IP increases risk (identity collision)
    clusterBonus += metrics.sharedDevices * 10;
    clusterBonus += metrics.sharedIPs * 8;

    // Network density bonus (highly connected nodes are suspicious)
    if (metrics.totalConnections >= 5) {
        clusterBonus += 20;
    }

    // Final risk capped at 100
    return Math.min(100, baseRisk + clusterBonus);
}

// ============================================
// CLUSTER DETECTION (Union-Find Algorithm)
// ============================================

const CLUSTER_COLORS = [
    { bg: '#7f1d1d', border: '#ef4444', label: 'Cluster A (Critical)' },  // Red
    { bg: '#1e3a5f', border: '#3b82f6', label: 'Cluster B' },              // Blue
    { bg: '#14532d', border: '#22c55e', label: 'Cluster C' },              // Green
    { bg: '#581c87', border: '#a855f7', label: 'Cluster D' },              // Purple
    { bg: '#78350f', border: '#f59e0b', label: 'Cluster E' },              // Orange
];

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
        const rootX = this.find(x);
        const rootY = this.find(y);
        if (rootX === rootY) return;

        const rankX = this.rank.get(rootX) || 0;
        const rankY = this.rank.get(rootY) || 0;

        if (rankX < rankY) {
            this.parent.set(rootX, rootY);
        } else if (rankX > rankY) {
            this.parent.set(rootY, rootX);
        } else {
            this.parent.set(rootY, rootX);
            this.rank.set(rootX, rankX + 1);
        }
    }

    getClusters(): Map<string, string[]> {
        const clusters = new Map<string, string[]>();
        this.parent.forEach((_, node) => {
            const root = this.find(node);
            if (!clusters.has(root)) {
                clusters.set(root, []);
            }
            clusters.get(root)!.push(node);
        });
        return clusters;
    }
}

// ============================================
// SHARED UTILITIES
// ============================================

export async function sendFraudAlertEmail(email: string, name: string, details: any) {
    // Determine if we have a real key to use
    if (process.env.RESEND_API_KEY?.startsWith('re_')) {
        return await sendFraudAlertEmailReal({
            recipientEmail: email,
            recipientName: name,
            alertType: (details.riskScore > 80 || details.severity === 'Critical') ? 'CRITICAL' : 'MODERATE',
            suspectAccount: details.accountNumber || 'Unknown',
            incomingSources: details.inDegree || 1,
            totalAmount: details.totalAmount || 0,
            caseId: details.caseId || `CASE_${Math.floor(Math.random() * 10000)}`,
            timestamp: new Date()
        });
    }

    // Simulate network delay for demo
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log(`[SIMULATED EMAIL] To: ${email} | Subject: ⚠️ Fraud Alert: Action Required`);
    return { success: true, message: `Alert sent to ${email}` };
}

export async function resolveEntity(entityId: string, requesterId?: string) {
    await logAuditAction(requesterId || null, 'resolve_entity', entityId);
    return { success: true, message: `Entity ${entityId} resolved` };
}

export async function freezeAccount(accountId: string, requesterId?: string) {
    await logAuditAction(requesterId || null, 'freeze_account', accountId);
    console.log("❄️ FREEZING ACCOUNT:", accountId);

    const { error } = await supabase
        .from('accounts')
        .update({ is_frozen: true, risk_score: 100 })
        .eq('id', accountId);

    if (error) {
        console.error("Error freezing account:", error);
        return { success: false, error: error.message };
    }

    // Also add a system transaction to record the freeze
    await addLiveTransaction({
        id: uuidv4(),
        from_account_id: accountId,
        to_account_id: 'SYSTEM_FREEZE',
        amount: 0,
        timestamp: new Date().toISOString(),
        type: 'transfer',
        location: 'SYSTEM',
        device_id: 'INTERNAL'
    } as any);

    // 📧 Send Notification
    // Seek user details
    const { data: account } = await supabase.from('accounts').select('*, profiles(email, full_name)').eq('id', accountId).single();

    if (account && account.profiles) {
        // @ts-ignore
        const email = account.profiles.email;
        // @ts-ignore
        const name = account.profiles.full_name;

        await sendAccountFrozenEmail({
            recipientEmail: email,
            recipientName: name,
            frozenAccount: account.account_number,
            reason: 'Suspicious Activity Detected',
            frozenBy: 'Fraud Detection System',
            caseId: `FRZ-${Date.now().toString().substr(-6)}`
        });
    }

    return { success: true, message: `Account ${accountId} has been frozen.` };
}

export async function unfreezeAccount(accountId: string, requesterId?: string) {
    await logAuditAction(requesterId || null, 'unfreeze_account', accountId);
    console.log("🔓 UNFREEZING ACCOUNT:", accountId);

    const { error } = await supabase
        .from('accounts')
        .update({ is_frozen: false })
        .eq('id', accountId);

    if (error) {
        console.error("Error unfreezing account:", error);
        return { success: false, error: error.message };
    }

    // Add a system transaction to record the unfreeze
    await addLiveTransaction({
        id: uuidv4(),
        from_account_id: accountId,
        to_account_id: 'SYSTEM_UNFREEZE',
        amount: 0,
        timestamp: new Date().toISOString(),
        type: 'transfer',
        location: 'SYSTEM',
        device_id: 'INTERNAL'
    } as any);

    return { success: true, message: `Account ${accountId} has been unfrozen.` };
}

export async function resetSimulationData() {
    console.log("♻️ RESETTING SIMULATION DATA");

    // 1. Delete all transactions
    const { error: txError } = await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (txError) console.error("Error deleting transactions:", txError);

    // 2. Reset Accounts (Risk Score = 0, Unfrozen, Balance Reset to 100k)
    const { error: accError } = await supabase.from('accounts').update({
        risk_score: 0,
        is_frozen: false,
        balance: 100000
    }).neq('id', '00000000-0000-0000-0000-000000000000');

    if (accError) console.error("Error resetting accounts:", accError);

    return { success: true };
}

// ============================================
// BATCH SIMULATION ACTIONS
// ============================================

export async function saveAccountsBatch(accounts: any[], ownerId?: string) {
    // 1. Get a valid user ID (simulation owner)
    // Preference: Explicit ownerId > First available user
    let targetUserId = ownerId;

    if (!targetUserId) {
        const { data: users } = await supabase.from('profiles').select('id').limit(1);
        targetUserId = users?.[0]?.id;
    }

    if (!targetUserId) return { success: false, error: "No valid user found to own simulated accounts." };

    const accountsWithUser = accounts.map(acc => ({
        ...acc,
        user_id: targetUserId, // Link to valid user
        is_simulated: true
    }));

    const { error } = await supabase.from('accounts').insert(accountsWithUser);

    if (error) {
        console.error("Batch Account Insert Error:", error);
        return { success: false, error: error.message };
    }
    return { success: true };
}

export async function saveTransactionsBatch(transactions: any[]) {
    console.log(`💾 Saving batch of ${transactions.length} transactions...`);

    const { error } = await supabase.from('transactions').insert(transactions);

    if (error) {
        console.error("Batch Transaction Insert Error:", error);
        return { success: false, error: error.message };
    }
    return { success: true };
}

