
import { RandomForestClassifier as RF } from 'ml-random-forest';
import { IsolationForest } from 'isolation-forest';
import { ClusterFeatures } from './features';

// Model State
let rfModel: any = null;
let ifModel: any = null;
let isTraining = false;

// Configuration
const RF_OPTIONS = {
    seed: 42,
    nEstimators: 25,
    treeOptions: { maxDepth: 7 }
};

const IF_OPTIONS = {
    nEstimators: 25,
    nTrees: 25
};

// ----------------------------------------------------------------------
// 1. Synthetic Training Data Generator
// ----------------------------------------------------------------------

function generateSyntheticTrainingData(count: number) {
    const X: number[][] = [];
    const y: number[] = []; // 0 = Normal, 1 = Fraud

    for (let i = 0; i < count; i++) {
        // Label: 10% Fraud
        const isFraud = Math.random() < 0.1;
        y.push(isFraud ? 1 : 0);

        // Feature Vector: [velocity, log_variance, burst, ip_ratio, device_ratio, vpn_ratio, density]

        let velocity, variance, burst, ipRatio, deviceRatio, vpnRatio, density;

        if (isFraud) {
            // FRAUD PATTERNS: High velocity, high burst, device recycling (low ratio), VPN usage
            velocity = 0.5 + Math.random() * 0.5; // High (normalized)
            variance = Math.random();             // Random
            burst = 0.4 + Math.random() * 0.6;    // High
            ipRatio = 0.1 + Math.random() * 0.4;  // Low (proxy recycling) or High (botnet)? Assume recycling here.
            deviceRatio = 0.1 + Math.random() * 0.3; // Low (many accounts, 1 device)
            vpnRatio = 0.5 + Math.random() * 0.5; // High
            density = 0.5 + Math.random() * 0.5;  // High connectivity
        } else {
            // NORMAL PATTERNS
            velocity = Math.random() * 0.2;       // Low
            variance = Math.random();
            burst = Math.random() * 0.2;          // Low
            ipRatio = 0.8 + Math.random() * 0.2;  // High (1 IP per user usually)
            deviceRatio = 0.8 + Math.random() * 0.2; // High
            vpnRatio = Math.random() * 0.1;       // Low
            density = Math.random() * 0.3;        // Low
        }

        X.push([velocity, variance, burst, ipRatio, deviceRatio, vpnRatio, density]);
    }

    return { X, y };
}

// ----------------------------------------------------------------------
// 2. Train Models (Auto-called on start if needed)
// ----------------------------------------------------------------------

export async function ensureModelsLoaded() {
    if (rfModel && ifModel) return;
    if (isTraining) {
        // Wait for training
        while (isTraining) await new Promise(r => setTimeout(r, 100));
        return;
    }

    isTraining = true;
    console.log("🧠 [ML] Starting initial model training...");

    try {
        const { X, y } = generateSyntheticTrainingData(500);

        // Train Random Forest
        // @ts-ignore
        rfModel = new RF(RF_OPTIONS);
        rfModel.train(X, y);

        // Train Isolation Forest (Unsupervised - uses X only)
        // @ts-ignore
        ifModel = new IsolationForest(X);
        // Note: IsolationForest usually takes data in constructor or fit

        console.log("🧠 [ML] Training complete.");
    } catch (e) {
        console.error("🧠 [ML] Training failed", e);
    } finally {
        isTraining = false;
    }
}

// ----------------------------------------------------------------------
// 3. Inference
// ----------------------------------------------------------------------

export async function predictClusterRisk(features: ClusterFeatures) {
    await ensureModelsLoaded();

    if (!rfModel || !ifModel) {
        return { supervisedRisk: 0, anomalyScore: 0, explanation: [] };
    }

    const vector = features.featureVector;

    // A. Supervised Prediction
    // RF predict returns class. predictProbability returns vector?
    let rfScore = 0;
    try {
        const probs = rfModel.predictProbability ? rfModel.predictProbability([vector]) : null;
        if (probs && probs.length > 0) {
            rfScore = probs[0][1]; // Probability of class 1 (Fraud)
        } else {
            const pred = rfModel.predict([vector]);
            rfScore = pred[0] === 1 ? 0.9 : 0.1;
        }
    } catch (e) {
        // Fallback
        const pred = rfModel.predict([vector]);
        rfScore = pred[0] === 1 ? 0.9 : 0.1;
    }

    // B. Anomaly Detection
    let anomalyScore = 0;
    try {
        // IsolationForest scores: usually returns anomaly score (closer to 1 is anomaly)
        const scores = ifModel.scores([vector]);
        anomalyScore = scores[0];
    } catch (e) {
        console.warn('Anomaly detection failed', e);
    }

    // C. Explainability (Simple contribution analysis)
    const explanations: string[] = [];
    if (rfScore > 0.5) explanations.push("ML Classifier detected fraud patterns");
    if (anomalyScore > 0.6) explanations.push("High behavioral anomaly detected");

    // Feature contributions (naive)
    const [vel, , burst, ipR, devR, vpn, dens] = vector;
    if (vel > 0.4) explanations.push("High Transaction Velocity");
    if (burst > 0.4) explanations.push("Abnormal Burst Rate");
    if (devR < 0.3) explanations.push("High Device Reuse");
    if (vpn > 0.5) explanations.push("Suspicious VPN Usage");

    return {
        supervisedRisk: rfScore,
        anomalyScore: anomalyScore,
        explanation: explanations
    };
}
