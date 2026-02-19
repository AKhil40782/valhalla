// Fraud Detection Algorithms for Salaar Bank

export interface FraudMetrics {
    velocityScore: number;      // Transaction frequency anomaly
    amountAnomaly: number;      // Z-score for amount
    deviceReuseScore: number;   // Shared device indicator
    ipReuseScore: number;       // Shared IP indicator
    temporalSyncScore: number;  // Time-based synchronization
    clusterDensity: number;     // Graph density metric
    overallRisk: number;        // Weighted final score
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// Z-Score calculation for anomaly detection
export function calculateZScore(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
}

// Velocity Analysis: Detect burst patterns
export function analyzeVelocity(timestamps: Date[], windowMinutes: number = 10): number {
    if (timestamps.length < 2) return 0;

    const sorted = timestamps.sort((a, b) => a.getTime() - b.getTime());
    const windowMs = windowMinutes * 60 * 1000;

    let maxBurstCount = 0;
    for (let i = 0; i < sorted.length; i++) {
        let burstCount = 1;
        for (let j = i + 1; j < sorted.length; j++) {
            if (sorted[j].getTime() - sorted[i].getTime() <= windowMs) {
                burstCount++;
            } else {
                break;
            }
        }
        maxBurstCount = Math.max(maxBurstCount, burstCount);
    }

    // Normalize: 5+ transactions in window = high velocity (1.0)
    return Math.min(maxBurstCount / 5, 1.0);
}

// Device/IP Reuse Analysis
export function analyzeEntityReuse(entityUsageCounts: Map<string, number>): number {
    if (entityUsageCounts.size === 0) return 0;

    let reuseScore = 0;
    entityUsageCounts.forEach(count => {
        if (count > 1) {
            reuseScore += (count - 1) * 0.2; // Each reuse adds 0.2
        }
    });

    return Math.min(reuseScore, 1.0);
}

// Temporal Synchronization: Detect coordinated activity
export function analyzeTemporalSync(timestamps: Date[], thresholdSeconds: number = 60): number {
    if (timestamps.length < 2) return 0;

    const sorted = timestamps.sort((a, b) => a.getTime() - b.getTime());
    let syncPairs = 0;

    for (let i = 0; i < sorted.length - 1; i++) {
        const diffMs = sorted[i + 1].getTime() - sorted[i].getTime();
        if (diffMs <= thresholdSeconds * 1000) {
            syncPairs++;
        }
    }

    // Normalize based on total possible pairs
    return syncPairs / Math.max(timestamps.length - 1, 1);
}

// Graph Cluster Density: edges / (nodes * (nodes - 1) / 2)
export function calculateClusterDensity(nodeCount: number, edgeCount: number): number {
    if (nodeCount < 2) return 0;
    const maxEdges = (nodeCount * (nodeCount - 1)) / 2;
    return edgeCount / maxEdges;
}

// Overall Risk Score Calculation
export function calculateOverallRisk(metrics: Omit<FraudMetrics, 'overallRisk' | 'riskLevel'>): FraudMetrics {
    const weights = {
        velocityScore: 0.15,
        amountAnomaly: 0.20,
        deviceReuseScore: 0.25,
        ipReuseScore: 0.20,
        temporalSyncScore: 0.10,
        clusterDensity: 0.10
    };

    const overallRisk =
        metrics.velocityScore * weights.velocityScore +
        Math.min(Math.abs(metrics.amountAnomaly) / 3, 1) * weights.amountAnomaly + // Normalize Z-score
        metrics.deviceReuseScore * weights.deviceReuseScore +
        metrics.ipReuseScore * weights.ipReuseScore +
        metrics.temporalSyncScore * weights.temporalSyncScore +
        metrics.clusterDensity * weights.clusterDensity;

    const riskScore = overallRisk * 100;

    let riskLevel: FraudMetrics['riskLevel'] = 'LOW';
    if (riskScore >= 75) riskLevel = 'CRITICAL';
    else if (riskScore >= 50) riskLevel = 'HIGH';
    else if (riskScore >= 25) riskLevel = 'MEDIUM';

    return {
        ...metrics,
        overallRisk: riskScore,
        riskLevel
    };
}
