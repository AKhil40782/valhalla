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

// ============================================
// Category 7: Statistical & Anomaly Detection
// ============================================

export interface PersonalBaseline {
    avgAmount: number;
    stdAmount: number;
    avgFrequencyPerDay: number;
    typicalHours: number[]; // 0-23
    typicalLocations: string[];
    txCount: number;
}

/**
 * Analyze a transaction against a user's personal history baseline.
 * Returns anomaly score 0-1 and flags.
 */
export function analyzePersonalHistory(
    amount: number,
    timestamp: Date,
    location: string | null,
    baseline: PersonalBaseline
): { score: number; flags: string[] } {
    if (baseline.txCount < 5) {
        return { score: 0, flags: ['Insufficient history for personal baseline'] };
    }

    const flags: string[] = [];
    let score = 0;

    // 1. Amount Z-score against personal history
    const amountZ = calculateZScore(amount, baseline.avgAmount, baseline.stdAmount);
    if (Math.abs(amountZ) > 3) {
        score += 0.35;
        flags.push(`Amount ${amount.toLocaleString()} is ${Math.abs(amountZ).toFixed(1)}σ from user's average (${baseline.avgAmount.toLocaleString()})`);
    } else if (Math.abs(amountZ) > 2) {
        score += 0.2;
        flags.push(`Unusual amount: ${Math.abs(amountZ).toFixed(1)}σ deviation from personal average`);
    }

    // 2. Time-of-day anomaly
    const hour = timestamp.getHours();
    if (baseline.typicalHours.length > 0 && !baseline.typicalHours.includes(hour)) {
        score += 0.15;
        flags.push(`Transaction at unusual hour (${hour}:00) — typical: ${baseline.typicalHours.join(', ')}:00`);
    }

    // 3. Location anomaly
    if (location && baseline.typicalLocations.length > 0 && !baseline.typicalLocations.includes(location)) {
        score += 0.2;
        flags.push(`New location: ${location} — not in user's history`);
    }

    return { score: Math.min(1, score), flags };
}

/**
 * Compare a transaction against population-level norms.
 * Returns anomaly score 0-1.
 */
export function analyzePopulationAnomaly(
    amount: number,
    populationMean: number,
    populationStd: number,
    txCountPerDay: number,
    avgPopulationFreq: number,
    stdPopulationFreq: number
): { score: number; flags: string[] } {
    const flags: string[] = [];
    let score = 0;

    // Amount population Z-score
    const amountZ = calculateZScore(amount, populationMean, populationStd);
    if (Math.abs(amountZ) > 4) {
        score += 0.3;
        flags.push(`Amount is ${Math.abs(amountZ).toFixed(1)}σ from population average`);
    } else if (Math.abs(amountZ) > 3) {
        score += 0.15;
        flags.push(`Amount deviation: ${Math.abs(amountZ).toFixed(1)}σ from population norm`);
    }

    // Frequency population Z-score
    const freqZ = calculateZScore(txCountPerDay, avgPopulationFreq, stdPopulationFreq);
    if (freqZ > 3) {
        score += 0.25;
        flags.push(`Transaction frequency ${txCountPerDay}/day is ${freqZ.toFixed(1)}σ above population average`);
    }

    return { score: Math.min(1, score), flags };
}
