'use server';

import { DEMO_ACCOUNTS, generateTransaction, Transaction } from "@/lib/simulation/generator";
import { generateFraudAlertEmail } from "@/lib/email-template";
import { addLiveTransaction, getLiveTransactions } from "@/lib/simulation/store";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import { sendFraudAlertEmailReal, sendAccountFrozenEmail, sendTestEmail as sendTestEmailInternal } from '@/lib/notifications/email';
import { sendTestWhatsapp } from '@/lib/notifications/whatsapp';

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

    const { data: accounts } = await supabase.from('accounts').select('*');
    const { data: profiles } = await supabase.from('profiles').select('*');

    const accountMap = new Map(accounts?.map(a => [a.id, a]) || []);
    const accountByNumber = new Map(accounts?.map(a => [a.account_number, a]) || []);
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
        const toAccount = accountByNumber.get(tx.to_account_number);
        const fromProfile = fromAccount ? profileMap.get(fromAccount.user_id) : null;
        const toProfile = toAccount ? profileMap.get(toAccount.user_id) : null;

        const transformed = {
            ...tx,
            from_name: fromProfile?.full_name || (fromAccount ? 'Unknown User' : 'External / Unknown'),
            to_account_id: toAccount?.id || tx.to_account_number,
            to_name: toProfile?.full_name || tx.to_account_number,
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

    // 3️⃣ COORDINATION & TEMPORAL ANALYSIS
    transactions.forEach(tx => {
        const overlaps = transactions.filter(t =>
            t.id !== tx.id &&
            Math.abs(new Date(t.timestamp).getTime() - new Date(tx.timestamp).getTime()) < 180000
        );
        if (overlaps.length > 0) {
            timeSyncMap.set(tx.from_account_id, (timeSyncMap.get(tx.from_account_id) || 0) + overlaps.length);
        }
    });

    const nodes: any[] = [];
    const edges: any[] = [];
    const processedNodes = new Set<string>();

    // Formula Component: Graph Density
    const potentialLinksCount = (accounts?.length || 1) * ((accounts?.length || 1) - 1);
    const graphDensity = potentialLinksCount > 0 ? transactions.length / potentialLinksCount : 0;

    transactions.forEach(tx => {
        [tx.from_account_id, tx.to_account_id].forEach(accId => {
            if (!processedNodes.has(accId)) {
                // Identity Sharing Metrics
                let maxDeviceReuse = 0;
                deviceMap.forEach(users => { if (users.has(accId)) maxDeviceReuse = Math.max(maxDeviceReuse, users.size); });
                let maxIpReuse = 0;
                ipMap.forEach(users => { if (users.has(accId)) maxIpReuse = Math.max(maxIpReuse, users.size); });

                // Sync Score
                const syncValue = timeSyncMap.get(accId) || 0;
                const normalizedSync = Math.min(1, syncValue / 5);

                // Behavior Spikes
                const burstMode = (accountTxsMap.get(accId)?.filter(t => (Date.now() - new Date(t.timestamp).getTime()) < 900000).length || 0) >= 5;
                const thresholdDodging = transactions.some(t => t.from_account_id === accId && t.amount >= 9000 && t.amount <= 9999);

                // 🛑 FINAL WEIGHTED RISK SCORE
                // Risk = (DeviceReuse*0.2) + (IPReuse*0.15) + (TimeSync*0.25) + (Centrality/FanIn*0.4)
                const inDegree = inDegreeMap.get(accId) || 0;
                const centralityBonus = Math.min(1, inDegree / 3) * 100; // Max bonus if 3+ senders

                let riskScoreValue = (
                    (Math.min(maxDeviceReuse, 5) / 5 * 100 * 0.20) +
                    (Math.min(maxIpReuse, 5) / 5 * 100 * 0.15) +
                    (normalizedSync * 100 * 0.25) +
                    (centralityBonus * 0.40)
                );

                if (burstMode) riskScoreValue += 15;
                if (thresholdDodging) riskScoreValue += 20;

                // Orchestrator detection: If in-degree is very high, force a high baseline risk
                if (inDegree >= 3) riskScoreValue = Math.max(riskScoreValue, 85);
                else if (inDegree >= 2) riskScoreValue = Math.max(riskScoreValue, 65);

                const finalRiskScore = Math.min(100, riskScoreValue);

                const label = (accId.startsWith('SAL_') ? accId : profileMap.get(accountMap.get(accId)?.user_id)?.full_name) || accId;
                const maskedLabel = forceUnmask ? label : (accId.startsWith('SAL_') ? maskAccountNumber(accId) : label);

                nodes.push({
                    data: {
                        id: accId,
                        label: maskedLabel,
                        type: 'account',
                        isHacker: profileMap.get(accountMap.get(accId)?.user_id)?.role === 'hacker',
                        risk: finalRiskScore,
                        metrics: {
                            deviceReuse: maxDeviceReuse,
                            ipReuse: maxIpReuse,
                            syncScore: (normalizedSync * 100).toFixed(0),
                            degree: (inDegreeMap.get(accId) || 0) + (outDegreeMap.get(accId) || 0),
                            burstMode,
                            thresholdDodging
                        }
                    },
                    classes: `${finalRiskScore > 80 ? 'critical-risk' : finalRiskScore > 50 ? 'high-risk' : finalRiskScore > 30 ? 'medium-risk' : ''} ${profileMap.get(accountMap.get(accId)?.user_id)?.role === 'hacker' ? 'hacker-node' : ''}`.trim()
                });
                processedNodes.add(accId);
            }
        });

        edges.push({
            data: { source: tx.from_account_id, target: tx.to_account_id, type: 'transfer', amount: tx.amount }
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
            edges.push({ data: { source: tx.from_account_id, target: devId, type: 'device_link' } });

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
                edges.push({ data: { source: devId, target: ipId, type: 'network_link' } });
            }
        }
    });

    // 4️⃣ ALERT GENERATION (Fan-In Pattern Detection)
    const alerts: any[] = [];
    const maxInDegreeVal = Math.max(...Array.from(inDegreeMap.values()), 0);
    const topHackerNodeId = Array.from(inDegreeMap.entries())
        .filter(([id]) => id !== 'SYSTEM_FREEZE') // Ignore system nodes
        .sort((a, b) => b[1] - a[1])[0]?.[0];

    if (maxInDegreeVal >= 3) {
        const suspectName = accountByNumber.get(topHackerNodeId!)?.account_number || topHackerNodeId;
        alerts.push({
            id: 'alert-critical-fanin',
            title: `🔴 CRITICAL: Aggregated Fan-In Cluster`,
            severity: 'Critical',
            time: 'LIVE',
            description: `Core node "${suspectName}" is receiving coordinated funds from ${maxInDegreeVal} sources. High probability of Money Laundering.`
        });
    } else if (maxInDegreeVal >= 2) {
        const suspectName = accountByNumber.get(topHackerNodeId!)?.account_number || topHackerNodeId;
        alerts.push({
            id: 'alert-moderate-velocity',
            title: `🟡 MODERATE: Multi-Source Inflow`,
            severity: 'Medium',
            time: 'LIVE',
            description: `Account "${suspectName}" is receiving funds from ${maxInDegreeVal} different accounts. Monitoring for "Mule" behavior.`
        });
    }

    const accountNodes = nodes.filter(n => n.data.type === 'account');
    const totalSync = accountNodes.reduce((sum, n) => {
        return sum + parseFloat(n.data.metrics?.syncScore || '0');
    }, 0);
    const avgSync = accountNodes.length > 0 ? (totalSync / accountNodes.length).toFixed(0) : '0';

    return {
        graphElements: [...nodes, ...edges],
        timelineEvents: transactions.map(tx => {
            // Risk Classification:
            // - critical: Large amounts (>50k) - likely money laundering
            // - high: Threshold dodging pattern (9000-9999 to avoid 10k reporting)
            // - medium: Elevated amounts (5000-50000)
            // - low: Normal banking activity (<5000)
            let riskLevel = 'low';
            if (tx.amount > 50000) riskLevel = 'critical';
            else if (tx.amount >= 9000 && tx.amount <= 9999) riskLevel = 'high';
            else if (tx.amount >= 5000) riskLevel = 'medium';

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
                    subnet: tx.ip_address && tx.ip_address.includes('.')
                        ? tx.ip_address.split('.').slice(0, 3).join('.') + '.0'
                        : 'Unknown',
                    imei: tx.device_id || 'Unknown Hardware ID',
                    device: tx.device_name || 'Web Browser'
                }
            };
        }),
        alerts,
        stats: {
            totalTransactions: transactions.length,
            uniqueAccounts: accounts?.length || 0,
            graphDensity: graphDensity.toFixed(4),
            avgSyncScore: avgSync,
            suspectedHacker: maxInDegreeVal >= 3 ? 'Critical' : maxInDegreeVal >= 2 ? 'Moderate' : 'Negative',
        },
        // Only show hacker alert when there's actual pattern (2+ sources)
        hackerInfo: (topHackerNodeId && maxInDegreeVal >= 2) ? {
            id: topHackerNodeId,
            name: accountByNumber.get(topHackerNodeId)?.account_number || topHackerNodeId,
            inDegree: maxInDegreeVal,
            severity: maxInDegreeVal >= 3 ? 'CRITICAL' : 'MODERATE',
            is_frozen: accountByNumber.get(topHackerNodeId)?.is_frozen || false
        } : null
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
        const { data: receiverAccount } = await supabase.from('accounts').select('*').eq('account_number', data.recipient).single();

        if (!senderAccount || senderAccount.balance < data.amount) {
            return { success: false, error: "Insufficient funds" };
        }

        if (senderAccount.is_frozen) {
            return { success: false, error: "Account Frozen" };
        }

        // 2. Insert Transaction
        const txId = uuidv4();
        const timestamp = new Date().toISOString();

        await supabase.from('transactions').insert({
            id: txId,
            from_account_id: data.fromAccountId,
            to_account_number: data.recipient,
            amount: data.amount,
            ip_address: data.forensics.ip,
            device_id: data.forensics.deviceId,
            device_name: data.forensics.device,
            location: data.forensics.location,
            timestamp: timestamp
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

        const txData = {
            id: txId,
            from_account_id: fromId,
            to_account_number: data.receiver,
            amount: data.amount,
            status: 'completed',
            ip_address: data.isVpn ? '45.33.21.99' : `106.51.22.${Math.floor(Math.random() * 255)}`,
            device_name: data.isVpn ? 'Linux x86_64 | HeadlessBrowser' : 'Win32 | Chrome 120.0',
            device_id: data.deviceId,
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

