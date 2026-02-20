'use server';

// ============================================
// DEVICE RISK SCORING ENGINE
// ============================================
// Evaluates device-level fraud risk based on behavioral patterns.

import { supabase } from '@/lib/supabase';

// ============================================
// RISK CHECK: Multi-Account Device Usage
// ============================================
/**
 * Check if the same device_hash is associated with multiple user accounts.
 * This is a strong indicator of fraud (one device controlling multiple accounts).
 */
export async function checkMultiAccountDevice(deviceHash: string, currentUserId: string): Promise<{
    flagged: boolean;
    userCount: number;
    details: string;
}> {
    const { data, error } = await supabase
        .from('trusted_devices')
        .select('user_id')
        .eq('device_hash', deviceHash);

    if (error || !data) return { flagged: false, userCount: 0, details: 'Check failed' };

    const uniqueUsers = new Set(data.map(d => d.user_id));
    uniqueUsers.delete(currentUserId); // Don't count the current user

    if (uniqueUsers.size > 0) {
        return {
            flagged: true,
            userCount: uniqueUsers.size + 1,
            details: `Device used by ${uniqueUsers.size + 1} different accounts`,
        };
    }

    return { flagged: false, userCount: 1, details: 'Device is unique to this user' };
}

// ============================================
// RISK CHECK: Rapid Device Switching
// ============================================
/**
 * Check if a user is logging in from many different devices in a short time window.
 * Pattern: >3 different devices within 1 hour suggests account compromise.
 */
export async function checkRapidDeviceSwitching(userId: string): Promise<{
    flagged: boolean;
    deviceCount: number;
    details: string;
}> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('device_security_events')
        .select('device_hash')
        .eq('user_id', userId)
        .eq('event_type', 'device_login')
        .gte('created_at', oneHourAgo);

    if (error || !data) return { flagged: false, deviceCount: 0, details: 'Check failed' };

    const uniqueDevices = new Set(data.map(d => d.device_hash));

    if (uniqueDevices.size > 3) {
        return {
            flagged: true,
            deviceCount: uniqueDevices.size,
            details: `${uniqueDevices.size} different devices used in the last hour`,
        };
    }

    return { flagged: false, deviceCount: uniqueDevices.size, details: 'Normal device usage' };
}

// ============================================
// RISK CHECK: OTP Failure Rate
// ============================================
/**
 * Check for excessive OTP verification failures.
 * Pattern: >10 failed OTP attempts in 24 hours suggests brute force.
 */
export async function checkOTPFailures(userId: string): Promise<{
    flagged: boolean;
    failureCount: number;
    details: string;
}> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('device_security_events')
        .select('id')
        .eq('user_id', userId)
        .eq('event_type', 'otp_failed')
        .gte('created_at', oneDayAgo);

    if (error || !data) return { flagged: false, failureCount: 0, details: 'Check failed' };

    if (data.length > 10) {
        return {
            flagged: true,
            failureCount: data.length,
            details: `${data.length} OTP failures in the last 24 hours`,
        };
    }

    return { flagged: false, failureCount: data.length, details: 'Normal OTP activity' };
}

// ============================================
// RISK CHECK: Frequent New Device Registrations
// ============================================
/**
 * Check if user is registering too many new devices.
 * Pattern: >5 new devices in 7 days suggests account sharing or compromise.
 */
export async function checkNewDeviceRate(userId: string): Promise<{
    flagged: boolean;
    newDeviceCount: number;
    details: string;
}> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('trusted_devices')
        .select('id')
        .eq('user_id', userId)
        .gte('first_seen', sevenDaysAgo);

    if (error || !data) return { flagged: false, newDeviceCount: 0, details: 'Check failed' };

    if (data.length > 5) {
        return {
            flagged: true,
            newDeviceCount: data.length,
            details: `${data.length} new devices registered in the last 7 days`,
        };
    }

    return { flagged: false, newDeviceCount: data.length, details: 'Normal device registration' };
}

// ============================================
// COMPOSITE RISK EVALUATION
// ============================================
/**
 * Run all device risk checks and return a composite assessment.
 * If any check is flagged, the device gets risk_flag = true.
 */
export async function evaluateDeviceRisk(userId: string, deviceHash: string): Promise<{
    riskScore: number;
    riskFlag: boolean;
    checks: {
        multiAccount: { flagged: boolean; details: string };
        rapidSwitching: { flagged: boolean; details: string };
        otpFailures: { flagged: boolean; details: string };
        newDeviceRate: { flagged: boolean; details: string };
    };
}> {
    const [multiAccount, rapidSwitching, otpFailures, newDeviceRate] = await Promise.all([
        checkMultiAccountDevice(deviceHash, userId),
        checkRapidDeviceSwitching(userId),
        checkOTPFailures(userId),
        checkNewDeviceRate(userId),
    ]);

    let riskScore = 0;
    if (multiAccount.flagged) riskScore += 0.4;  // Strongest signal
    if (rapidSwitching.flagged) riskScore += 0.25;
    if (otpFailures.flagged) riskScore += 0.2;
    if (newDeviceRate.flagged) riskScore += 0.15;

    const riskFlag = riskScore >= 0.25;

    // Update risk_flag on the device if it exists
    if (riskFlag) {
        await supabase
            .from('trusted_devices')
            .update({ risk_flag: true })
            .eq('user_id', userId)
            .eq('device_hash', deviceHash);
    }

    return {
        riskScore: Math.min(1, riskScore),
        riskFlag,
        checks: {
            multiAccount: { flagged: multiAccount.flagged, details: multiAccount.details },
            rapidSwitching: { flagged: rapidSwitching.flagged, details: rapidSwitching.details },
            otpFailures: { flagged: otpFailures.flagged, details: otpFailures.details },
            newDeviceRate: { flagged: newDeviceRate.flagged, details: newDeviceRate.details },
        },
    };
}

// ============================================
// SECURITY EVENT LOGGING
// ============================================
/**
 * Log a device security event for audit trail.
 */
export async function logDeviceSecurityEvent(
    userId: string,
    eventType: string,
    deviceHash: string | null,
    ipAddress: string | null,
    metadata: Record<string, any> = {}
): Promise<void> {
    await supabase.from('device_security_events').insert({
        user_id: userId,
        event_type: eventType,
        device_hash: deviceHash,
        ip_address: ipAddress,
        metadata,
    });
}
