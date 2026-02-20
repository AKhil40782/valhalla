'use server';

import { supabase } from '@/lib/supabase';

// ============================================
// USER ACTIVITY INTELLIGENCE — SERVER ACTIONS
// (Derives intelligence from REAL accounts, transactions, & links)
// ============================================

export interface UserActivityParams {
    page?: number;
    pageSize?: number;
    sortBy?: 'risk_score' | 'virtual_name' | 'last_tx' | 'tx_count' | 'total_amount' | 'account_number';
    sortOrder?: 'asc' | 'desc';
    filterRiskLevel?: string;
    search?: string;
    includeSimulated?: boolean;
}

export interface UserIntelligenceRecord {
    id: string;
    account_number: string;
    virtual_name: string | null;
    risk_score: number;
    risk_level: string;
    is_frozen: boolean;
    is_simulated: boolean;
    created_at: string;
    // Computed from transactions
    tx_count: number;
    total_amount: number;
    last_tx: string | null;
    unique_ips: number;
    unique_devices: number;
    vpn_usage: number;
    // Computed from account_links
    link_count: number;
}

function getRiskLevel(score: number): string {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
}

/**
 * Get paginated account intelligence list — computed from REAL accounts + transactions.
 * No mock data. Everything is derived from actual database records.
 */
export async function getUserActivityList(params: UserActivityParams = {}) {
    const {
        page = 1,
        pageSize = 20,
        sortBy = 'risk_score',
        sortOrder = 'desc',
        filterRiskLevel,
        search,
        includeSimulated = true,
    } = params;

    try {
        // Get all accounts with their transaction stats using a raw SQL query
        // This computes everything server-side for performance
        const { data: rows, error } = await supabase.rpc('get_user_intelligence_list', {}).select();

        // If the RPC doesn't exist yet, fall back to manual query
        let accounts: any[] = [];

        // Fetch accounts
        let accountQuery = supabase
            .from('accounts')
            .select('id, account_number, virtual_name, risk_score, is_frozen, is_simulated, created_at');

        if (!includeSimulated) {
            accountQuery = accountQuery.or('is_simulated.eq.false,is_simulated.is.null');
        }

        if (search && search.trim()) {
            accountQuery = accountQuery.or(`virtual_name.ilike.%${search.trim()}%,account_number.ilike.%${search.trim()}%`);
        }

        if (filterRiskLevel && filterRiskLevel !== 'ALL') {
            const ranges: Record<string, [number, number]> = {
                CRITICAL: [80, 100],
                HIGH: [60, 79],
                MEDIUM: [30, 59],
                LOW: [0, 29],
            };
            const range = ranges[filterRiskLevel];
            if (range) {
                accountQuery = accountQuery.gte('risk_score', range[0]).lte('risk_score', range[1]);
            }
        }

        // Sort
        const sortField = sortBy === 'virtual_name' ? 'virtual_name' :
            sortBy === 'account_number' ? 'account_number' : 'risk_score';
        accountQuery = accountQuery.order(sortField, { ascending: sortOrder === 'asc' });

        const { data: allAccounts, error: accError, count: totalFromQuery } = await accountQuery
            .range((page - 1) * pageSize, page * pageSize - 1);

        if (accError) throw accError;

        // For each account, compute transaction intelligence
        const enrichedAccounts = await Promise.all(
            (allAccounts || []).map(async (acc: any) => {
                // Get transaction stats
                const { data: txStats } = await supabase
                    .from('transactions')
                    .select('id, amount, ip_address, device_id, vpn_flag, timestamp')
                    .eq('from_account_id', acc.id);

                const txs = txStats || [];
                const uniqueIps = new Set(txs.map((t: any) => t.ip_address).filter(Boolean)).size;
                const uniqueDevices = new Set(txs.map((t: any) => t.device_id).filter(Boolean)).size;
                const vpnCount = txs.filter((t: any) => t.vpn_flag === true).length;
                const totalAmount = txs.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
                const lastTx = txs.length > 0 ? txs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp : null;

                // Get link count from account_links
                const { count: linkCount } = await supabase
                    .from('account_links')
                    .select('*', { count: 'exact', head: true })
                    .or(`account_a_id.eq.${acc.id},account_b_id.eq.${acc.id}`);

                return {
                    id: acc.id,
                    account_number: acc.account_number,
                    virtual_name: acc.virtual_name,
                    risk_score: acc.risk_score || 0,
                    risk_level: getRiskLevel(acc.risk_score || 0),
                    is_frozen: acc.is_frozen || false,
                    is_simulated: acc.is_simulated || false,
                    created_at: acc.created_at,
                    tx_count: txs.length,
                    total_amount: totalAmount,
                    last_tx: lastTx,
                    unique_ips: uniqueIps,
                    unique_devices: uniqueDevices,
                    vpn_usage: vpnCount,
                    link_count: linkCount || 0,
                } as UserIntelligenceRecord;
            })
        );

        // Sort by computed fields if needed
        if (sortBy === 'tx_count' || sortBy === 'total_amount' || sortBy === 'last_tx') {
            enrichedAccounts.sort((a, b) => {
                let aVal: any, bVal: any;
                if (sortBy === 'tx_count') { aVal = a.tx_count; bVal = b.tx_count; }
                else if (sortBy === 'total_amount') { aVal = a.total_amount; bVal = b.total_amount; }
                else { aVal = a.last_tx ? new Date(a.last_tx).getTime() : 0; bVal = b.last_tx ? new Date(b.last_tx).getTime() : 0; }
                return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
            });
        }

        // Compute global stats
        const { count: totalAccounts } = await supabase
            .from('accounts')
            .select('*', { count: 'exact', head: true });

        const { count: highRiskCount } = await supabase
            .from('accounts')
            .select('*', { count: 'exact', head: true })
            .gte('risk_score', 60);

        const { count: criticalCount } = await supabase
            .from('accounts')
            .select('*', { count: 'exact', head: true })
            .gte('risk_score', 80);

        const { count: frozenCount } = await supabase
            .from('accounts')
            .select('*', { count: 'exact', head: true })
            .eq('is_frozen', true);

        const { data: avgData } = await supabase
            .from('accounts')
            .select('risk_score')
            .gt('risk_score', 0);

        const avgRisk = avgData && avgData.length > 0
            ? Math.round(avgData.reduce((sum: number, a: any) => sum + a.risk_score, 0) / avgData.length)
            : 0;

        const { count: linkedGroupCount } = await supabase
            .from('account_links')
            .select('*', { count: 'exact', head: true });

        const { count: txCount } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true });

        return {
            users: enrichedAccounts,
            totalCount: totalAccounts || 0,
            page,
            pageSize,
            stats: {
                totalAccounts: totalAccounts || 0,
                highRiskCount: highRiskCount || 0,
                criticalCount: criticalCount || 0,
                frozenAccounts: frozenCount || 0,
                avgRisk,
                linkedGroups: linkedGroupCount || 0,
                totalTransactions: txCount || 0,
            },
        };
    } catch (e) {
        console.error('getUserActivityList error:', e);
        return {
            users: [],
            totalCount: 0,
            page,
            pageSize,
            stats: { totalAccounts: 0, highRiskCount: 0, criticalCount: 0, frozenAccounts: 0, avgRisk: 0, linkedGroups: 0, totalTransactions: 0 },
        };
    }
}

/**
 * Get full account intelligence profile — derived from real transactions + links.
 */
export async function getUserProfile(accountId: string) {
    try {
        // Get account
        const { data: account, error } = await supabase
            .from('accounts')
            .select('*')
            .eq('id', accountId)
            .single();

        if (error) throw error;

        // Get all transactions (sent + received)
        const { data: sentTxs } = await supabase
            .from('transactions')
            .select('*')
            .eq('from_account_id', accountId)
            .order('timestamp', { ascending: false });

        const { data: receivedTxs } = await supabase
            .from('transactions')
            .select('*')
            .eq('to_account_id', accountId)
            .order('timestamp', { ascending: false });

        const allTxs = [...(sentTxs || []), ...(receivedTxs || [])].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        // Compute behavioural metrics from real transactions
        const sentOnly = sentTxs || [];
        const uniqueIps = [...new Set(allTxs.map((t: any) => t.ip_address).filter(Boolean))];
        const uniqueDevices = [...new Set(allTxs.map((t: any) => t.device_id).filter(Boolean))];
        const vpnTxs = allTxs.filter((t: any) => t.vpn_flag === true);
        const totalSent = sentOnly.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
        const totalReceived = (receivedTxs || []).reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

        // Build events timeline from real transactions
        const events = allTxs.map((tx: any) => ({
            id: tx.id,
            event_type: 'transaction' as const,
            severity: tx.vpn_flag ? 'critical' : Number(tx.amount) > 5000 ? 'warning' : 'info',
            description: `${tx.from_account_id === accountId ? 'Sent' : 'Received'} ₹${Number(tx.amount).toLocaleString()} ${tx.vpn_flag ? '(VPN)' : ''} ${tx.device_name ? `via ${tx.device_name}` : ''}`.trim(),
            metadata: {
                amount: tx.amount,
                ip: tx.ip_address,
                device: tx.device_name || tx.device_id,
                vpn: tx.vpn_flag,
                asn: tx.asn,
                location: tx.location || tx.ip_city,
            },
            created_at: tx.timestamp,
        }));

        // Get account links (relationships)
        const { data: links } = await supabase
            .from('account_links')
            .select('*, acc_a:accounts!account_links_account_a_id_fkey(id, account_number, virtual_name, risk_score), acc_b:accounts!account_links_account_b_id_fkey(id, account_number, virtual_name, risk_score)')
            .or(`account_a_id.eq.${accountId},account_b_id.eq.${accountId}`);

        // Get behavior profile (only exists for real accounts)
        const { data: behaviorProfile } = await supabase
            .from('user_behavior_profiles')
            .select('*')
            .eq('account_id', accountId)
            .maybeSingle();

        // Build profile-like object from real data
        const profile = {
            id: account.id,
            account_number: account.account_number,
            user_name: account.virtual_name || account.account_number,
            risk_score: account.risk_score || 0,
            risk_level: getRiskLevel(account.risk_score || 0),
            is_frozen: account.is_frozen,
            is_simulated: account.is_simulated,
            balance: account.balance,
            // Computed metrics
            total_sent: totalSent,
            total_received: totalReceived,
            tx_count: allTxs.length,
            sent_count: sentOnly.length,
            received_count: (receivedTxs || []).length,
            unique_ips: uniqueIps,
            unique_devices: uniqueDevices,
            vpn_tx_count: vpnTxs.length,
            last_tx: allTxs[0]?.timestamp || null,
            typical_device: uniqueDevices[0] || 'Unknown',
            typical_ip: uniqueIps[0] || 'Unknown',
            created_at: account.created_at,
            // Behavioral metrics (from user_behavior_profiles — only real accounts)
            // Use ?? instead of || to preserve 0 values (0 is falsy but valid)
            avg_transaction_time_ms: behaviorProfile?.avg_transaction_time_ms ?? null,
            avg_clicks_per_session: behaviorProfile?.avg_clicks_per_session ?? null,
            avg_mouse_speed: behaviorProfile?.avg_mouse_speed ?? null,
            total_sessions: behaviorProfile?.total_sessions ?? null,
            typical_login_hour: behaviorProfile?.typical_login_hour ?? null,
            anomaly_flags: behaviorProfile?.anomaly_flags ?? {},
        };

        return {
            profile,
            events,
            relationships: links || [],
        };
    } catch (e) {
        console.error('getUserProfile error:', e);
        return { profile: null, events: [], relationships: [] };
    }
}

/**
 * Get Cytoscape-compatible network graph elements from REAL account_links + transaction patterns.
 */
export async function getUserNetwork(accountId: string) {
    try {
        // Get the center account
        const { data: centerAccount } = await supabase
            .from('accounts')
            .select('id, account_number, virtual_name, risk_score')
            .eq('id', accountId)
            .single();

        if (!centerAccount) return { elements: [] };

        const nodes: any[] = [];
        const edges: any[] = [];
        const addedNodeIds = new Set<string>();

        const riskColors: Record<string, string> = {
            CRITICAL: '#dc2626',
            HIGH: '#f97316',
            MEDIUM: '#eab308',
            LOW: '#22c55e',
        };

        const riskLevel = getRiskLevel(centerAccount.risk_score || 0);

        // Add center node
        nodes.push({
            data: {
                id: centerAccount.id,
                label: centerAccount.virtual_name || centerAccount.account_number,
                risk_score: centerAccount.risk_score || 0,
                risk_level: riskLevel,
                color: riskColors[riskLevel] || '#64748b',
                isCenter: true,
            },
        });
        addedNodeIds.add(centerAccount.id);

        // --- Method 1: Account Links (explicit relationships) ---
        const { data: links } = await supabase
            .from('account_links')
            .select('*, acc_a:accounts!account_links_account_a_id_fkey(id, account_number, virtual_name, risk_score), acc_b:accounts!account_links_account_b_id_fkey(id, account_number, virtual_name, risk_score)')
            .or(`account_a_id.eq.${accountId},account_b_id.eq.${accountId}`);

        (links || []).forEach((link: any) => {
            const isA = link.account_a_id === accountId;
            const otherAcc = isA ? link.acc_b : link.acc_a;
            const otherId = isA ? link.account_b_id : link.account_a_id;

            if (!addedNodeIds.has(otherId) && otherAcc) {
                const otherRisk = getRiskLevel(otherAcc.risk_score || 0);
                nodes.push({
                    data: {
                        id: otherId,
                        label: otherAcc.virtual_name || otherAcc.account_number,
                        risk_score: otherAcc.risk_score || 0,
                        risk_level: otherRisk,
                        color: riskColors[otherRisk] || '#64748b',
                        isCenter: false,
                    },
                });
                addedNodeIds.add(otherId);
            }

            edges.push({
                data: {
                    id: `link-${link.id}`,
                    source: link.account_a_id,
                    target: link.account_b_id,
                    label: (link.link_type || 'linked').replace('_', ' '),
                    strength: link.strength || 0.5,
                    type: link.link_type || 'linked',
                    width: Math.max(1, (link.strength || 0.5) * 5),
                },
            });
        });

        // --- Method 2: Transaction partners (implicit relationships) ---
        const { data: sentTxs } = await supabase
            .from('transactions')
            .select('to_account_id, to_account_number, amount')
            .eq('from_account_id', accountId)
            .not('to_account_id', 'is', null);

        const { data: receivedTxs } = await supabase
            .from('transactions')
            .select('from_account_id, amount')
            .eq('to_account_id', accountId)
            .not('from_account_id', 'is', null);

        // Group by partner
        const partnerMap = new Map<string, { count: number; totalAmount: number; direction: string }>();

        (sentTxs || []).forEach((tx: any) => {
            if (tx.to_account_id && tx.to_account_id !== accountId) {
                const existing = partnerMap.get(tx.to_account_id) || { count: 0, totalAmount: 0, direction: 'sent' };
                existing.count++;
                existing.totalAmount += Number(tx.amount || 0);
                partnerMap.set(tx.to_account_id, existing);
            }
        });

        (receivedTxs || []).forEach((tx: any) => {
            if (tx.from_account_id && tx.from_account_id !== accountId) {
                const existing = partnerMap.get(tx.from_account_id) || { count: 0, totalAmount: 0, direction: 'received' };
                existing.count++;
                existing.totalAmount += Number(tx.amount || 0);
                existing.direction = existing.direction === 'sent' ? 'both' : 'received';
                partnerMap.set(tx.from_account_id, existing);
            }
        });

        // Fetch partner accounts
        const partnerIds = [...partnerMap.keys()].filter(id => !addedNodeIds.has(id));
        if (partnerIds.length > 0) {
            const { data: partnerAccounts } = await supabase
                .from('accounts')
                .select('id, account_number, virtual_name, risk_score')
                .in('id', partnerIds);

            (partnerAccounts || []).forEach((acc: any) => {
                const partnerRisk = getRiskLevel(acc.risk_score || 0);
                if (!addedNodeIds.has(acc.id)) {
                    nodes.push({
                        data: {
                            id: acc.id,
                            label: acc.virtual_name || acc.account_number,
                            risk_score: acc.risk_score || 0,
                            risk_level: partnerRisk,
                            color: riskColors[partnerRisk] || '#64748b',
                            isCenter: false,
                        },
                    });
                    addedNodeIds.add(acc.id);
                }

                const partner = partnerMap.get(acc.id)!;
                edges.push({
                    data: {
                        id: `tx-${accountId}-${acc.id}`,
                        source: accountId,
                        target: acc.id,
                        label: `${partner.count} txn${partner.count > 1 ? 's' : ''}`,
                        strength: Math.min(1, partner.count / 5),
                        type: 'transaction_pattern',
                        width: Math.max(1, Math.min(5, partner.count)),
                    },
                });
            });
        }

        // --- Method 3: Shared device/IP connections ---
        // Find other accounts using the same device_id or IP
        const { data: myTxs } = await supabase
            .from('transactions')
            .select('device_id, ip_address')
            .eq('from_account_id', accountId);

        const myDevices = [...new Set((myTxs || []).map((t: any) => t.device_id).filter(Boolean))];
        const myIps = [...new Set((myTxs || []).map((t: any) => t.ip_address).filter(Boolean))];

        // Find shared device users
        if (myDevices.length > 0) {
            const { data: sharedDeviceTxs } = await supabase
                .from('transactions')
                .select('from_account_id, device_id')
                .in('device_id', myDevices)
                .neq('from_account_id', accountId);

            const devicePartners = new Set((sharedDeviceTxs || []).map((t: any) => t.from_account_id));
            const newDevicePartners = [...devicePartners].filter(id => !addedNodeIds.has(id));

            if (newDevicePartners.length > 0) {
                const { data: deviceAccounts } = await supabase
                    .from('accounts')
                    .select('id, account_number, virtual_name, risk_score')
                    .in('id', newDevicePartners);

                (deviceAccounts || []).forEach((acc: any) => {
                    const accRisk = getRiskLevel(acc.risk_score || 0);
                    if (!addedNodeIds.has(acc.id)) {
                        nodes.push({
                            data: {
                                id: acc.id,
                                label: acc.virtual_name || acc.account_number,
                                risk_score: acc.risk_score || 0,
                                risk_level: accRisk,
                                color: riskColors[accRisk] || '#64748b',
                                isCenter: false,
                            },
                        });
                        addedNodeIds.add(acc.id);
                    }

                    edges.push({
                        data: {
                            id: `device-${accountId}-${acc.id}`,
                            source: accountId,
                            target: acc.id,
                            label: 'shared device',
                            strength: 0.9,
                            type: 'shared_device',
                            width: 4,
                        },
                    });
                });
            }
        }

        // Find shared IP users
        if (myIps.length > 0) {
            const { data: sharedIpTxs } = await supabase
                .from('transactions')
                .select('from_account_id, ip_address')
                .in('ip_address', myIps)
                .neq('from_account_id', accountId);

            const ipPartners = new Set((sharedIpTxs || []).map((t: any) => t.from_account_id));
            const newIpPartners = [...ipPartners].filter(id => !addedNodeIds.has(id));

            if (newIpPartners.length > 0) {
                const { data: ipAccounts } = await supabase
                    .from('accounts')
                    .select('id, account_number, virtual_name, risk_score')
                    .in('id', newIpPartners);

                (ipAccounts || []).forEach((acc: any) => {
                    const accRisk = getRiskLevel(acc.risk_score || 0);
                    if (!addedNodeIds.has(acc.id)) {
                        nodes.push({
                            data: {
                                id: acc.id,
                                label: acc.virtual_name || acc.account_number,
                                risk_score: acc.risk_score || 0,
                                risk_level: accRisk,
                                color: riskColors[accRisk] || '#64748b',
                                isCenter: false,
                            },
                        });
                        addedNodeIds.add(acc.id);
                    }

                    if (!edges.find((e: any) => e.data.id === `device-${accountId}-${acc.id}`)) {
                        edges.push({
                            data: {
                                id: `ip-${accountId}-${acc.id}`,
                                source: accountId,
                                target: acc.id,
                                label: 'shared IP',
                                strength: 0.7,
                                type: 'shared_ip',
                                width: 3,
                            },
                        });
                    }
                });
            }
        }

        return { elements: [...nodes, ...edges] };
    } catch (e) {
        console.error('getUserNetwork error:', e);
        return { elements: [] };
    }
}

/**
 * Get transaction-based events for the activity timeline.
 */
export async function getUserRiskEvents(accountId: string, limit: number = 50) {
    try {
        // Get transactions for this account (both sent and received)
        const { data: txs, error } = await supabase
            .from('transactions')
            .select('*')
            .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`)
            .order('timestamp', { ascending: false })
            .limit(limit);

        if (error) throw error;

        const events = (txs || []).map((tx: any) => ({
            id: tx.id,
            event_type: tx.vpn_flag ? 'anomaly' : 'transaction',
            severity: tx.vpn_flag ? 'critical' : Number(tx.amount) > 5000 ? 'warning' : 'info',
            description: `${tx.from_account_id === accountId ? 'Sent' : 'Received'} ₹${Number(tx.amount).toLocaleString()} ${tx.vpn_flag ? '🔴 VPN' : ''} ${tx.device_name ? `via ${tx.device_name}` : ''}`.trim(),
            metadata: {
                amount: tx.amount,
                ip: tx.ip_address,
                device: tx.device_name || tx.device_id,
                vpn: tx.vpn_flag,
                asn: tx.asn,
                to: tx.to_account_number,
                location: tx.location || tx.ip_city,
            },
            created_at: tx.timestamp,
        }));

        return { events };
    } catch (e) {
        console.error('getUserRiskEvents error:', e);
        return { events: [] };
    }
}

// ============================================
// DOWNLOAD / COMPARE / SIMILAR — NEW ACTIONS
// ============================================

/**
 * Get full export data for one or more accounts — used for JSON download.
 */
export async function getAccountExportData(accountIds: string[]) {
    try {
        const results = await Promise.all(
            accountIds.map(async (id) => {
                const { profile, events, relationships } = await getUserProfile(id);
                return { profile, transactions: events, relationships };
            })
        );
        return { data: results };
    } catch (e) {
        console.error('getAccountExportData error:', e);
        return { data: [] };
    }
}

/**
 * Compare two accounts side by side — returns both profiles with computed metrics.
 */
export async function compareAccounts(accountIdA: string, accountIdB: string) {
    try {
        const [profileA, profileB] = await Promise.all([
            getUserProfile(accountIdA),
            getUserProfile(accountIdB),
        ]);

        // Find common attributes
        const commonIps = (profileA.profile?.unique_ips || []).filter(
            (ip: string) => (profileB.profile?.unique_ips || []).includes(ip)
        );
        const commonDevices = (profileA.profile?.unique_devices || []).filter(
            (dev: string) => (profileB.profile?.unique_devices || []).includes(dev)
        );

        // Check if they have transactions between each other
        const { count: directTxCount } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .or(`and(from_account_id.eq.${accountIdA},to_account_id.eq.${accountIdB}),and(from_account_id.eq.${accountIdB},to_account_id.eq.${accountIdA})`);

        return {
            accountA: profileA,
            accountB: profileB,
            commonalities: {
                shared_ips: commonIps,
                shared_devices: commonDevices,
                direct_transactions: directTxCount || 0,
                same_risk_level: profileA.profile?.risk_level === profileB.profile?.risk_level,
                risk_diff: Math.abs((profileA.profile?.risk_score || 0) - (profileB.profile?.risk_score || 0)),
            },
        };
    } catch (e) {
        console.error('compareAccounts error:', e);
        return { accountA: null, accountB: null, commonalities: null };
    }
}

/**
 * Find accounts similar to a given account.
 * Similarity is based on: risk score range, shared IPs, shared devices, similar transaction volume.
 */
export async function findSimilarAccounts(accountId: string, limit: number = 15) {
    try {
        // Get target account
        const { data: target } = await supabase
            .from('accounts')
            .select('*')
            .eq('id', accountId)
            .single();

        if (!target) return { similar: [], target: null };

        // Get target's transactions for fingerprint
        const { data: targetTxs } = await supabase
            .from('transactions')
            .select('ip_address, device_id, amount, vpn_flag')
            .eq('from_account_id', accountId);

        const targetIps = new Set((targetTxs || []).map((t: any) => t.ip_address).filter(Boolean));
        const targetDevices = new Set((targetTxs || []).map((t: any) => t.device_id).filter(Boolean));
        const targetVpnCount = (targetTxs || []).filter((t: any) => t.vpn_flag).length;
        const targetTotalAmount = (targetTxs || []).reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
        const targetRisk = target.risk_score || 0;

        // Find candidates: accounts with similar risk score (±20 range)
        const riskLow = Math.max(0, targetRisk - 20);
        const riskHigh = Math.min(100, targetRisk + 20);

        const { data: candidates } = await supabase
            .from('accounts')
            .select('id, account_number, virtual_name, risk_score, is_frozen, is_simulated, created_at')
            .gte('risk_score', riskLow)
            .lte('risk_score', riskHigh)
            .neq('id', accountId)
            .limit(100);

        if (!candidates || candidates.length === 0) return { similar: [], target };

        // Score each candidate
        const scored = await Promise.all(
            candidates.map(async (candidate: any) => {
                let similarityScore = 0;
                const reasons: string[] = [];

                // 1. Risk score proximity (max 30 pts)
                const riskDiff = Math.abs(targetRisk - (candidate.risk_score || 0));
                const riskPoints = Math.round(30 * (1 - riskDiff / 20));
                similarityScore += riskPoints;
                if (riskDiff <= 5) reasons.push('Very similar risk score');

                // 2. Shared IPs/devices (max 40 pts)
                const { data: candTxs } = await supabase
                    .from('transactions')
                    .select('ip_address, device_id, amount, vpn_flag')
                    .eq('from_account_id', candidate.id);

                const candIps = new Set((candTxs || []).map((t: any) => t.ip_address).filter(Boolean));
                const candDevices = new Set((candTxs || []).map((t: any) => t.device_id).filter(Boolean));

                const sharedIps = [...targetIps].filter(ip => candIps.has(ip));
                const sharedDevices = [...targetDevices].filter(dev => candDevices.has(dev));

                if (sharedDevices.length > 0) {
                    similarityScore += 25;
                    reasons.push(`Shared ${sharedDevices.length} device(s)`);
                }
                if (sharedIps.length > 0) {
                    similarityScore += 15;
                    reasons.push(`Shared ${sharedIps.length} IP(s)`);
                }

                // 3. Transaction pattern similarity (max 20 pts)
                const candVpnCount = (candTxs || []).filter((t: any) => t.vpn_flag).length;
                const candTotalAmount = (candTxs || []).reduce((s: number, t: any) => s + Number(t.amount || 0), 0);

                if (targetVpnCount > 0 && candVpnCount > 0) {
                    similarityScore += 10;
                    reasons.push('Both use VPN');
                }

                if (targetTotalAmount > 0 && candTotalAmount > 0) {
                    const amountRatio = Math.min(targetTotalAmount, candTotalAmount) / Math.max(targetTotalAmount, candTotalAmount);
                    if (amountRatio > 0.5) {
                        similarityScore += Math.round(10 * amountRatio);
                        reasons.push('Similar transaction volume');
                    }
                }

                // 4. Same frozen status (5 pts)
                if (target.is_frozen === candidate.is_frozen && target.is_frozen) {
                    similarityScore += 5;
                    reasons.push('Both frozen');
                }

                return {
                    ...candidate,
                    risk_level: getRiskLevel(candidate.risk_score || 0),
                    similarity_score: similarityScore,
                    reasons,
                    shared_ips: sharedIps,
                    shared_devices: sharedDevices,
                    tx_count: (candTxs || []).length,
                    vpn_usage: candVpnCount,
                };
            })
        );

        // Sort by similarity score and take top N
        const sorted = scored
            .filter(s => s.similarity_score > 10) // Only meaningful matches
            .sort((a, b) => b.similarity_score - a.similarity_score)
            .slice(0, limit);

        return {
            similar: sorted,
            target: {
                ...target,
                risk_level: getRiskLevel(targetRisk),
            },
        };
    } catch (e) {
        console.error('findSimilarAccounts error:', e);
        return { similar: [], target: null };
    }
}
