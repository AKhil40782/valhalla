'use server';

// ============================================
// ANONYMITY RISK SCORING ENGINE
// ============================================
// Combines all detection signals into a unified risk score and determines response actions.

import { supabase } from '@/lib/supabase';
import { isTorExitNode } from './tor-detector';
import { checkIPIntelligence, checkGeoAnomaly } from './ip-intelligence';
import { logDeviceSecurityEvent } from './device-risk';

// ============================================
// TYPES
// ============================================

export interface AnonymitySignals {
    // Server-side signals
    ip: string;
    userId: string;
    // Client-side signals (from browser-privacy-detector.ts)
    isTorBrowser: boolean;
    canvasBlocked: boolean;
    webglBlocked: boolean;
    webrtcDisabled: boolean;
    audioBlocked: boolean;
    entropyScore: number;
    privacyFlags: string[];
}

export interface AnonymityRiskResult {
    score: number;          // 0-1
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    requiresOTP: boolean;
    signals: {
        tor_exit_match: boolean;
        tor_browser: boolean;
        proxy_flag: boolean;
        vpn_detected: boolean;
        hosting_detected: boolean;
        geo_anomaly: boolean;
        fingerprint_hardened: boolean;
        repeated_tor_usage: boolean;
    };
    details: string[];
    actionTaken: string;
}

// ============================================
// RISK WEIGHTS
// ============================================

const RISK_WEIGHTS = {
    tor_exit_match: 0.30,
    proxy_flag: 0.15,
    vpn_hosting: 0.15,
    geo_jump: 0.15,
    fingerprint_hardened: 0.15,
    repeated_tor_usage: 0.10,
};

// ============================================
// MAIN RISK COMPUTATION
// ============================================

/**
 * Full anonymity check: runs all detectors and computes risk score.
 * This is the main entry point called from the login flow.
 */
export async function checkAnonymityRisk(signals: AnonymitySignals): Promise<AnonymityRiskResult> {
    const details: string[] = [];
    let rawScore = 0;

    // 1. Tor Exit Node Check (server-side IP lookup)
    const torResult = await isTorExitNode(signals.ip);
    const torExitMatch = torResult.isTor;
    if (torExitMatch) {
        rawScore += RISK_WEIGHTS.tor_exit_match;
        details.push(`🧅 IP ${signals.ip} is a known Tor exit node (confidence: ${torResult.confidence})`);
    }

    // Factor in client-side Tor Browser detection
    const torBrowser = signals.isTorBrowser;
    if (torBrowser && !torExitMatch) {
        // Tor Browser detected but IP not in exit list — might be using a bridge
        rawScore += RISK_WEIGHTS.tor_exit_match * 0.7;
        details.push('🧅 Tor Browser signature detected (possible bridge relay)');
    }

    // 2. IP Intelligence Check
    const ipIntel = await checkIPIntelligence(signals.ip);
    const proxyFlag = ipIntel.isProxy;
    const vpnDetected = ipIntel.isVPN;
    const hostingDetected = ipIntel.isHosting;

    if (proxyFlag) {
        rawScore += RISK_WEIGHTS.proxy_flag;
        details.push(`🔀 Proxy detected: ${ipIntel.isp}`);
    }
    if (vpnDetected || hostingDetected) {
        rawScore += RISK_WEIGHTS.vpn_hosting;
        if (vpnDetected) details.push(`🛡️ VPN provider: ${ipIntel.isp}`);
        if (hostingDetected && !vpnDetected) details.push(`🏢 Hosting/datacenter: ${ipIntel.org}`);
    }
    details.push(...ipIntel.details.filter(d => !details.some(existing => existing.includes(d))));

    // 3. Geo Anomaly Check
    const geoResult = await checkGeoAnomaly(
        signals.userId,
        ipIntel.country,
        ipIntel.lat,
        ipIntel.lon
    );
    const geoAnomaly = geoResult.geoAnomaly;
    if (geoAnomaly) {
        rawScore += RISK_WEIGHTS.geo_jump;
        details.push(geoResult.details);
    }

    // 4. Fingerprint Hardening (from client-side signals)
    const hardened = signals.canvasBlocked || signals.webglBlocked ||
        signals.webrtcDisabled || signals.audioBlocked ||
        signals.entropyScore < 30;
    if (hardened) {
        rawScore += RISK_WEIGHTS.fingerprint_hardened;
        details.push(`🔒 Fingerprint hardening: ${signals.privacyFlags.join(', ')}`);
    }

    // 5. Repeated Tor Usage Check
    const repeatedTor = await checkRepeatedTorUsage(signals.userId);
    if (repeatedTor) {
        rawScore += RISK_WEIGHTS.repeated_tor_usage;
        details.push('⚠️ Repeated Tor/anonymity network usage detected (≥3 in 7 days)');
    }

    // Compute final score and level
    const score = Math.min(1, rawScore);
    const level: 'LOW' | 'MEDIUM' | 'HIGH' =
        score >= 0.6 ? 'HIGH' :
            score >= 0.3 ? 'MEDIUM' : 'LOW';

    const requiresOTP = level === 'HIGH';

    // Determine action
    let actionTaken = 'none';
    if (level === 'HIGH') {
        actionTaken = 'force_otp';
        if (repeatedTor) actionTaken = 'force_otp_high_monitoring';
    } else if (level === 'MEDIUM') {
        actionTaken = 'warn';
    }

    // Log to anonymous_access_logs
    await supabase.from('anonymous_access_logs').insert({
        user_id: signals.userId,
        ip_address: signals.ip,
        tor_detected: torExitMatch || torBrowser,
        proxy_detected: proxyFlag,
        vpn_detected: vpnDetected,
        hosting_detected: hostingDetected,
        geo_anomaly: geoAnomaly,
        fingerprint_hardened: hardened,
        risk_score: score,
        risk_level: level,
        action_taken: actionTaken,
        metadata: {
            country: ipIntel.country,
            city: ipIntel.city,
            lat: ipIntel.lat,
            lon: ipIntel.lon,
            isp: ipIntel.isp,
            org: ipIntel.org,
            entropyScore: signals.entropyScore,
            privacyFlags: signals.privacyFlags,
            details,
        },
    });

    // Log security event for HIGH risk
    if (level === 'HIGH') {
        await logDeviceSecurityEvent(
            signals.userId,
            'anonymity_high_risk',
            null,
            signals.ip,
            { score, level, details, actionTaken }
        );
    }

    // Mark account for high monitoring if repeated Tor usage
    if (repeatedTor) {
        await supabase
            .from('profiles')
            .update({ monitoring_level: 'HIGH' })
            .eq('id', signals.userId);
    }

    console.log(`🕵️ [ANONYMITY] User ${signals.userId} — Score: ${(score * 100).toFixed(0)}% (${level}) | Action: ${actionTaken}`);

    return {
        score,
        level,
        requiresOTP,
        signals: {
            tor_exit_match: torExitMatch,
            tor_browser: torBrowser,
            proxy_flag: proxyFlag,
            vpn_detected: vpnDetected,
            hosting_detected: hostingDetected,
            geo_anomaly: geoAnomaly,
            fingerprint_hardened: hardened,
            repeated_tor_usage: repeatedTor,
        },
        details,
        actionTaken,
    };
}

/**
 * Check if user has ≥3 Tor/anonymity logins in the last 7 days.
 */
async function checkRepeatedTorUsage(userId: string): Promise<boolean> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { count } = await supabase
        .from('anonymous_access_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('tor_detected', true)
        .gte('created_at', sevenDaysAgo);

    return (count || 0) >= 3;
}
