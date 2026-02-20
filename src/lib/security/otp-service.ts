'use server';

// ============================================
// OTP SERVICE — Generation, Delivery, Verification
// ============================================

import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/notifications/email';

/**
 * Generate a cryptographically random 6-digit OTP.
 */
function generateOTPCode(): string {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return String(array[0] % 1000000).padStart(6, '0');
}

/**
 * Hash an OTP code using SHA-256 for secure storage.
 */
async function hashOTP(code: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(code);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Send a device verification OTP to the user's email.
 * Returns the OTP record ID for tracking.
 */
export async function sendDeviceOTP(userId: string, email: string, userName: string): Promise<{ success: boolean; error?: string; code?: string }> {
    // Invalidate any existing unexpired OTPs for this user
    await supabase
        .from('otp_codes')
        .update({ verified: true })
        .eq('user_id', userId)
        .eq('verified', false)
        .eq('purpose', 'device_verification');

    // Generate new OTP
    const code = generateOTPCode();
    const otpHash = await hashOTP(code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store hashed OTP
    const { error: insertError } = await supabase
        .from('otp_codes')
        .insert({
            user_id: userId,
            otp_hash: otpHash,
            expires_at: expiresAt.toISOString(),
            attempt_count: 0,
            verified: false,
            purpose: 'device_verification',
        });

    if (insertError) {
        console.error('❌ Failed to store OTP:', insertError);
        return { success: false, error: 'Failed to generate verification code' };
    }

    // Send OTP via email
    const emailResult = await sendEmail({
        to: email,
        subject: '🔐 Salaar Bank — Device Verification Code',
        html: generateOTPEmailHtml(userName, code),
    });

    if (!emailResult.success) {
        console.error('❌ Failed to send OTP email:', emailResult.error);
    }

    console.log(`📱 OTP sent to ${email} via ${emailResult.provider} (code: ${code})`);

    // Return code for demo/dev display (in production, remove this)
    return { success: true, code };
}

/**
 * Verify an OTP code submitted by the user.
 * Checks: hash match, expiry (5min), attempt limit (5).
 */
export async function verifyOTP(userId: string, submittedCode: string): Promise<{
    valid: boolean;
    error?: string;
    attemptsRemaining?: number;
}> {
    // Find the latest unverified OTP for this user
    const { data: otpRecord, error: fetchError } = await supabase
        .from('otp_codes')
        .select('*')
        .eq('user_id', userId)
        .eq('verified', false)
        .eq('purpose', 'device_verification')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (fetchError || !otpRecord) {
        return { valid: false, error: 'No pending verification found. Please request a new code.' };
    }

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
        await supabase.from('otp_codes').update({ verified: true }).eq('id', otpRecord.id);
        return { valid: false, error: 'Verification code has expired. Please request a new code.' };
    }

    // Check attempt limit
    if (otpRecord.attempt_count >= 5) {
        await supabase.from('otp_codes').update({ verified: true }).eq('id', otpRecord.id);
        return { valid: false, error: 'Too many failed attempts. Please request a new code.' };
    }

    // Increment attempt count
    await supabase
        .from('otp_codes')
        .update({ attempt_count: otpRecord.attempt_count + 1 })
        .eq('id', otpRecord.id);

    // Verify hash
    const submittedHash = await hashOTP(submittedCode);
    if (submittedHash !== otpRecord.otp_hash) {
        const remaining = 4 - otpRecord.attempt_count;
        return {
            valid: false,
            error: `Invalid code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
            attemptsRemaining: remaining,
        };
    }

    // Mark as verified
    await supabase.from('otp_codes').update({ verified: true }).eq('id', otpRecord.id);

    return { valid: true };
}

/**
 * Clean up expired OTP records (maintenance function).
 */
export async function cleanupExpiredOTPs(): Promise<void> {
    await supabase
        .from('otp_codes')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .eq('verified', true);
}

/**
 * Generate a beautiful HTML email template for the OTP code.
 */
function generateOTPEmailHtml(userName: string, otpCode: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Device Verification — Salaar Bank</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="500" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #22d3ee; font-size: 22px; font-weight: 800; letter-spacing: 2px;">🔐 SALAAR BANK</h1>
                            <p style="margin: 8px 0 0; color: #94a3b8; font-size: 13px;">Device Verification Required</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <p style="color: #334155; font-size: 16px; margin: 0 0 20px;">Hello <strong>${userName}</strong>,</p>
                            <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 30px;">
                                We detected a login from an unrecognized device. Please enter the verification code below to confirm your identity:
                            </p>

                            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px solid #0ea5e9; border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 30px;">
                                <p style="margin: 0 0 8px; color: #0369a1; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">Verification Code</p>
                                <p style="margin: 0; color: #0f172a; font-size: 36px; font-weight: 800; letter-spacing: 8px; font-family: monospace;">${otpCode}</p>
                            </div>

                            <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 15px; margin-bottom: 25px;">
                                <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
                                    ⏱️ This code expires in <strong>5 minutes</strong>.<br>
                                    🚫 Maximum <strong>5 attempts</strong> allowed.<br>
                                    ⚠️ If you didn't request this, please ignore this email.
                                </p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8fafc; padding: 20px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; color: #94a3b8; font-size: 11px;">Salaar Bank Security • Never share this code with anyone</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
}
