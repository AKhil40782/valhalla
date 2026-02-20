
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

        // Feature Vector (18-dim): [velocity, log_variance, burst, ip_ratio, device_ratio, vpn_ratio, density,
        //   burst_window, sync_activity, funnel, circular, pass_thru, automation, physical,
        //   biometric, session, amount_normalized, tx_count_normalized]

        if (isFraud) {
            // FRAUD PATTERNS
            X.push([
                0.5 + Math.random() * 0.5,   // velocity — high
                Math.random(),                 // variance — random
                0.4 + Math.random() * 0.6,    // burst — high
                0.1 + Math.random() * 0.4,    // ip_ratio — low (recycling)
                0.1 + Math.random() * 0.3,    // device_ratio — low (reuse)
                0.5 + Math.random() * 0.5,    // vpn_ratio — high
                0.5 + Math.random() * 0.5,    // density — high
                0.3 + Math.random() * 0.7,    // burst_window — moderate to high
                0.2 + Math.random() * 0.8,    // sync_activity — moderate to high
                0.3 + Math.random() * 0.7,    // funnel — moderate to high
                0.2 + Math.random() * 0.8,    // circular — moderate to high
                0.3 + Math.random() * 0.7,    // pass_thru — moderate to high
                0.4 + Math.random() * 0.6,    // automation — high
                0.2 + Math.random() * 0.8,    // physical — moderate to high
                0.3 + Math.random() * 0.7,    // biometric — moderate to high
                0.3 + Math.random() * 0.7,    // session — moderate to high
                Math.random(),                 // amount — random
                0.3 + Math.random() * 0.7,    // tx_count — moderate to high
            ]);
        } else {
            // NORMAL PATTERNS
            X.push([
                Math.random() * 0.2,          // velocity — low
                Math.random(),                 // variance — random
                Math.random() * 0.2,          // burst — low
                0.8 + Math.random() * 0.2,    // ip_ratio — high (unique)
                0.8 + Math.random() * 0.2,    // device_ratio — high
                Math.random() * 0.1,          // vpn_ratio — low
                Math.random() * 0.3,          // density — low
                Math.random() * 0.15,         // burst_window — very low
                Math.random() * 0.1,          // sync_activity — very low
                Math.random() * 0.1,          // funnel — very low
                Math.random() * 0.05,         // circular — near zero
                Math.random() * 0.1,          // pass_thru — very low
                Math.random() * 0.1,          // automation — very low
                Math.random() * 0.1,          // physical — very low
                Math.random() * 0.15,         // biometric — low
                Math.random() * 0.15,         // session — low
                Math.random(),                 // amount — random
                Math.random() * 0.3,          // tx_count — low
            ]);
        }
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

    // Feature contributions (expanded 18-dim)
    const [vel, , burst, ipR, devR, vpn, dens,
        burstW, syncAct, funnel, circular, passThru, auto, physical,
        bio, sess] = vector;
    if (vel > 0.4) explanations.push("High Transaction Velocity");
    if (burst > 0.4) explanations.push("Abnormal Burst Rate");
    if (devR < 0.3) explanations.push("High Device Reuse");
    if (vpn > 0.5) explanations.push("Suspicious VPN Usage");
    // New category signals
    if (burstW > 0.3) explanations.push("Temporal Burst Window Detected");
    if (syncAct > 0.3) explanations.push("Synchronized Cross-Account Activity");
    if (funnel > 0.3) explanations.push("Money Funnel Pattern");
    if (circular > 0.3) explanations.push("Circular Fund Flow");
    if (passThru > 0.3) explanations.push("Rapid Pass-Through Account");
    if (auto > 0.3) explanations.push("Automation/Script Indicators");
    if (physical > 0.3) explanations.push("Physical Location Conflict");
    if (bio > 0.3) explanations.push("Behavioral Biometric Anomaly");
    if (sess > 0.3) explanations.push("Unusual Session Pattern");

    return {
        supervisedRisk: rfScore,
        anomalyScore: anomalyScore,
        explanation: explanations
    };
}
