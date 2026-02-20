'use server';

import { Resend } from 'resend';
import nodemailer from 'nodemailer';

const resend = new Resend(process.env.RESEND_API_KEY);

// ============================================
// EMAIL TRANSPORTER CONFIG
// ============================================

export async function sendEmail({ to, subject, html }: { to: string, subject: string, html: string }): Promise<{ success: boolean; messageId?: string; provider: string; error?: string }> {
    console.log('📬 [EMAIL DEBUG] Entering sendEmail for:', to);
    // 1. GMAIL (Preferred for Demo - Unrestricted)
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        try {
            const transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 465,
                secure: true,
                auth: {
                    user: process.env.GMAIL_USER,
                    pass: process.env.GMAIL_APP_PASSWORD,
                },
            });

            const info = await transporter.sendMail({
                from: `"Salaar Bank Security" <${process.env.GMAIL_USER}>`,
                to,
                subject,
                html,
            });

            return { success: true, messageId: info.messageId, provider: 'GMAIL' };
        } catch (error: any) {
            console.error('❌ Gmail Send Failed:', error);
            // Don't return here, try fallback
        }
    }

    // 2. RESEND (Reliable but Restricted on Free Tier)
    try {
        if (process.env.RESEND_API_KEY?.startsWith('re_')) {
            console.log('📬 [EMAIL DEBUG] Attempting Resend for:', to);
            const result = await resend.emails.send({
                from: 'Salaar Bank <onboarding@resend.dev>',
                to,
                subject,
                html,
            });

            if (result.error) {
                console.error('❌ Resend Error:', result.error);
                return {
                    success: false,
                    provider: 'RESEND',
                    error: `Resend: ${result.error.message}. (Note: Free tier only allows sending to your own registered email)`
                };
            }

            return { success: true, messageId: result.data?.id, provider: 'RESEND' };
        }
    } catch (error: any) {
        console.error('❌ Resend Exception:', error);
        return { success: false, provider: 'RESEND', error: error.message || String(error) };
    }

    // 3. SIMULATION (Console Only)
    console.warn('⚠️ [EMAIL DEBUG] No SMTP/API configured. Falling back to Simulation.');
    return { success: true, messageId: 'simulated-id', provider: 'SIMULATION', error: 'System in Simulation Mode (No Env Vars Found)' };
}

// ============================================
// FRAUD ALERT EMAIL TEMPLATES
// ============================================

interface FraudAlertEmailData {
    recipientEmail: string;
    recipientName: string;
    alertType: 'CRITICAL' | 'MODERATE' | 'LOW';
    suspectAccount: string;
    incomingSources: number;
    totalAmount: number;
    caseId: string;
    timestamp: Date;
}

interface AccountFrozenEmailData {
    recipientEmail: string;
    recipientName: string;
    frozenAccount: string;
    reason: string;
    frozenBy: string;
    caseId: string;
}

// Template generator for fraud alert
// Template generator for fraud alert
// Template generator for fraud alert
// Template generator for fraud alert
function generateFraudAlertHtml(data: FraudAlertEmailData): string {
    const severityColor = data.alertType === 'CRITICAL' ? '#dc2626' : data.alertType === 'MODERATE' ? '#f59e0b' : '#22c55e';
    const severityBg = data.alertType === 'CRITICAL' ? '#fef2f2' : data.alertType === 'MODERATE' ? '#fffbeb' : '#f0fdf4';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SALAAR BANK | SECURITY ALERT</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td style="background-color: #0f172a; padding: 24px 40px; text-align: left;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 2px;">SALAAR BANK</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: ${severityBg}; padding: 20px 40px; border-bottom: 2px solid ${severityColor};">
                            <h2 style="margin: 0; color: #0f172a; font-size: 20px;">🚨 Suspicious Activity Detected</h2>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <p style="color: #334155; font-size: 16px; margin: 0 0 20px;">Dear <strong>${data.recipientName}</strong>,</p>
                            <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 25px;">
                                We've detected a high-risk transaction on your account. To protect your funds, we've flagged this activity for your immediate review.
                            </p>
                            
                            <table width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                                <tr>
                                    <td style="padding: 5px 0; color: #64748b; font-size: 13px;">Case ID</td>
                                    <td style="padding: 5px 0; color: #0f172a; font-size: 13px; font-weight: 600; text-align: right;">#${data.caseId}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 5px 0; color: #64748b; font-size: 13px;">Risk Level</td>
                                    <td style="padding: 5px 0; color: ${severityColor}; font-size: 13px; font-weight: 700; text-align: right;">${data.alertType}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 5px 0; color: #64748b; font-size: 13px;">Amount</td>
                                    <td style="padding: 5px 0; color: #0f172a; font-size: 16px; font-weight: 700; text-align: right;">₹${data.totalAmount.toLocaleString('en-IN')}</td>
                                </tr>
                            </table>

                            <p style="color: #475569; font-size: 14px; margin: 0 0 30px;">
                                If you did not authorize this, please log in to your dashboard immediately to secure your account.
                            </p>

                            <div style="text-align: center;">
                                <a href="http://localhost:3000/network" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: 700;">
                                    Verify Activity Now
                                </a>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
                            Salaar Bank Fraud Intelligence Unit
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

// ============================================
// EMAIL SENDING FUNCTIONS
// ============================================

export async function sendFraudAlertEmailReal(data: FraudAlertEmailData) {
    console.log(`📧 [ALERT FLOW] Sending to: ${data.recipientEmail}, Type: ${data.alertType}`);

    const result = await sendEmail({
        to: data.recipientEmail,
        subject: `🚨 ${data.alertType} FRAUD ALERT - Case ${data.caseId}`,
        html: generateFraudAlertHtml(data)
    });

    console.log(`✅ [ALERT FLOW] Result for ${data.recipientEmail}:`, result);
    return result;
}

export async function sendAccountFrozenEmail(data: AccountFrozenEmailData) {
    console.log(`📧 [FREEZE FLOW] Sending to: ${data.recipientEmail}`);

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Urgent: Account Restriction Notice</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, system-ui, sans-serif; background-color: #f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background-color: #991b1b; padding: 32px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 1px;">ACCOUNT RESTRICTED</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <p style="color: #1e293b; font-size: 16px; margin: 0 0 20px;">Dear <strong style="color: #0f172a;">${data.recipientName}</strong>,</p>
                            <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 30px;">
                                We have observed irregular activity that may put your funds at risk. To ensure the security of your assets, we have placed a <strong>temporary restriction</strong> on the following account:
                            </p>
                            
                            <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
                                <p style="margin: 0 0 8px; color: #b91c1c; font-size: 12px; font-weight: 700; text-transform: uppercase;">Restricted Account Number</p>
                                <p style="margin: 0; color: #1e293b; font-size: 22px; font-weight: 700; font-family: monospace;">${data.frozenAccount}</p>
                            </div>

                            <table width="100%" style="margin-bottom: 30px;">
                                <tr>
                                    <td style="color: #64748b; font-size: 14px; padding: 12px 0; border-bottom: 1px solid #f1f5f9;">Investigation Case</td>
                                    <td align="right" style="color: #1e293b; font-size: 14px; font-weight: 600; padding: 12px 0; border-bottom: 1px solid #f1f5f9;">#${data.caseId}</td>
                                </tr>
                                <tr>
                                    <td style="color: #64748b; font-size: 14px; padding: 12px 0; border-bottom: 1px solid #f1f5f9;">Primary Reason</td>
                                    <td align="right" style="color: #1e293b; font-size: 14px; font-weight: 600; padding: 12px 0; border-bottom: 1px solid #f1f5f9;">${data.reason}</td>
                                </tr>
                                <tr>
                                    <td style="color: #64748b; font-size: 14px; padding: 12px 0;">Authorizing Agent</td>
                                    <td align="right" style="color: #1e293b; font-size: 14px; font-weight: 600; padding: 12px 0;">${data.frozenBy}</td>
                                </tr>
                            </table>

                            <p style="color: #64748b; font-size: 13px; line-height: 1.6; padding-top: 24px; border-top: 1px solid #f1f5f9; text-align: center;">
                                If you believe this is an error, please contact the <strong>Salaar Bank Fraud Investigation Unit</strong> immediately.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 24px 40px; background-color: #f8fafc; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0;">
                            SALAAR BANK • Security & Risk Management Division
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;

    const result = await sendEmail({
        to: data.recipientEmail,
        subject: `⚠️ URGENT: Account Restricted - Case ${data.caseId}`,
        html
    });

    console.log(`✅ Freeze Email Result:`, result);
    return result;
}

// ============================================
// QUICK TEST FUNCTION
// ============================================

export async function sendTestEmail(toEmail: string) {
    console.log('🧪 Sending system diagnostic email to:', toEmail);

    const result = await sendEmail({
        to: toEmail,
        subject: '🏦 Salaar Bank Security Verification',
        html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px;">
                <h2 style="color: #0f172a;">System Integration Success</h2>
                <p>This is a verified security test notification from the <strong>Salaar Bank Fraud Detection System</strong>.</p>
                <p>Your SMTP integration using <strong>Nodemailer</strong> is now fully operational and ready to send real-time fraud alerts.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 11px; color: #64748b;">
                    <strong>Technical Diagnostics:</strong><br />
                    Secure Provider: ${process.env.GMAIL_USER ? 'Gmail via Nodemailer' : 'Resend Gateway'}<br />
                    Verification Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)
                </p>
            </div>
        `
    });

    return result;
}



