
import { FraudCluster, TransactionEvent } from '../fraud/fraud-engine';

export interface ClusterFeatures {
    // Raw Metrics
    txCount: number;
    totalAmount: number;
    avgAmount: number;
    amountVariance: number;
    timeSpanMinutes: number;
    velocity: number;        // Txs per minute
    burstRate: number;       // Max txs in 1 min window
    uniqueIPs: number;
    uniqueDevices: number;
    uniqueAccounts: number;

    // Ratios
    ipRatio: number;         // Unique IPs / Txs
    deviceRatio: number;     // Unique Devices / Txs
    vpnRatio: number;        // VPN Txs / Txs

    // ML Vector (Normalized 0-1 approx for critical features)
    featureVector: number[];
}

export function extractClusterFeatures(cluster: FraudCluster, allEvents: TransactionEvent[]): ClusterFeatures {
    // 1. Filter events for this cluster
    const clusterEvents = allEvents.filter(e => cluster.accountIds.includes(e.account_id));

    const count = clusterEvents.length;
    if (count === 0) {
        return {
            txCount: 0, totalAmount: 0, avgAmount: 0, amountVariance: 0, timeSpanMinutes: 0,
            velocity: 0, burstRate: 0, uniqueIPs: 0, uniqueDevices: 0, uniqueAccounts: 0,
            ipRatio: 0, deviceRatio: 0, vpnRatio: 0, featureVector: []
        };
    }

    // 2. Calculate Amount Metrics
    const amounts = clusterEvents.map(e => e.amount);
    const totalAmount = amounts.reduce((sum, a) => sum + a, 0);
    const avgAmount = totalAmount / count;
    const variance = amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / count;

    // 3. Time Metrics
    const timestamps = clusterEvents.map(e => new Date(e.timestamp).getTime()).sort((a, b) => a - b);
    const minTime = timestamps[0];
    const maxTime = timestamps[count - 1];
    const timeSpanMinutes = (maxTime - minTime) / 60000;
    const velocity = timeSpanMinutes > 0 ? count / timeSpanMinutes : count; // If instantaneous, velocity is count

    // Burst Rate (Sliding 1-min window)
    let maxBurst = 0;
    for (let i = 0; i < count; i++) {
        let burst = 0;
        const windowEnd = timestamps[i] + 60000;
        for (let j = i; j < count; j++) {
            if (timestamps[j] <= windowEnd) burst++;
            else break;
        }
        if (burst > maxBurst) maxBurst = burst;
    }

    // 4. Network Metrics
    const uniqueIPs = new Set(clusterEvents.map(e => e.ip_address).filter(ip => ip)).size;
    const uniqueDevices = new Set(clusterEvents.map(e => e.device_fingerprint_id).filter(d => d)).size;
    const vpnCount = clusterEvents.filter(e => e.vpn_flag).length;

    // 5. Ratios
    const ipRatio = count > 0 ? uniqueIPs / count : 0;
    const deviceRatio = count > 0 ? uniqueDevices / count : 0;
    const vpnRatio = count > 0 ? vpnCount / count : 0;

    // 6. Construct Feature Vector for ML
    // [velocity, variance_log, burst_rate, ip_ratio, device_ratio, vpn_ratio, density_score]
    // Note: Log transform variance to handle range.

    // We also use graph density from the cluster metrics if available
    const density = cluster.metrics.graphDensityScore || 0;

    const featureVector = [
        Math.min(velocity / 10, 1),           // Cap velocity at 10/min
        Math.min(Math.log10(variance + 1) / 5, 1), // Log variance, normalized approx
        Math.min(maxBurst / 5, 1),            // Cap burst at 5
        ipRatio,                              // 0-1 (Low is suspicious for botnets, High is normalish?)
        // Actually, low IP ratio (manys txs, 1 IP) = High risk?
        // High IP ratio (many txs, many IPs) = High risk (Distributed)?
        deviceRatio,
        vpnRatio,
        density
    ];

    return {
        txCount: count,
        totalAmount,
        avgAmount,
        amountVariance: variance,
        timeSpanMinutes,
        velocity,
        burstRate: maxBurst,
        uniqueIPs,
        uniqueDevices,
        uniqueAccounts: cluster.accountIds.length,
        ipRatio,
        deviceRatio,
        vpnRatio,
        featureVector
    };
}
