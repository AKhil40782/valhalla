'use server';

import twilio from 'twilio';

// Initialize Twilio Client
// We use a factory function or check for keys to avoid init errors if keys are missing
const getTwilioClient = () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        console.warn('⚠️ Twilio credentials missing. WhatsApp messages will be simulated.');
        return null;
    }

    return twilio(accountSid, authToken);
};

const FROM_NUMBER = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; // Twilio Sandbox Number

// ============================================
// WHATSAPP TEMPLATES
// ============================================

interface WhatsappAlertData {
    recipientPhone: string;
    recipientName: string;
    alertType: 'CRITICAL' | 'MODERATE' | 'LOW';
    caseId: string;
    amount: number;
}

function generateWhatsappMessage(data: WhatsappAlertData): string {
    const emoji = data.alertType === 'CRITICAL' ? '🚨' : data.alertType === 'MODERATE' ? '⚠️' : 'ℹ️';

    return `
${emoji} *SALAAR BANK FRAUD ALERT* ${emoji}

Hello ${data.recipientName},

We detected suspicious activity on your account.

*Case ID:* ${data.caseId}
*Severity:* ${data.alertType}
*Amount at Risk:* ₹${data.amount.toLocaleString('en-IN')}

Please check your email for full details or log in to the secure portal immediately.

_This is an automated message._
    `.trim();
}

// ============================================
// SENDING FUNCTIONS
// ============================================

export async function sendFraudAlertWhatsapp(data: WhatsappAlertData) {
    console.log('📱 Sending WhatsApp Alert to:', data.recipientPhone);

    const client = getTwilioClient();

    if (!client) {
        // SIMULATION MODE
        console.log(`[SIMULATION] WhatsApp sent to ${data.recipientPhone}: \n${generateWhatsappMessage(data)}`);
        return { success: true, simulated: true };
    }

    try {
        const message = await client.messages.create({
            body: generateWhatsappMessage(data),
            from: FROM_NUMBER,
            to: `whatsapp:${data.recipientPhone}`
        });

        console.log('✅ WhatsApp sent successfully:', message.sid);
        return { success: true, messageId: message.sid };
    } catch (error) {
        console.error('❌ WhatsApp sending failed:', error);
        return { success: false, error: String(error) };
    }
}

export async function sendTestWhatsapp(toPhone: string) {
    console.log('🧪 Sending test WhatsApp to:', toPhone);

    const client = getTwilioClient();

    if (!client) {
        console.log(`[SIMULATION] Test WhatsApp to ${toPhone}: "✅ Salaar Bank: WhatsApp integration test successful."`);
        return { success: true, simulated: true, message: "Simulated (Missing Credentials)" };
    }

    try {
        const message = await client.messages.create({
            body: '✅ *Salaar Bank Integration Test*\n\nYour fraud detection system is now connected to WhatsApp.\n\n_Secure. Reliable. Fast._',
            from: FROM_NUMBER,
            to: `whatsapp:${toPhone}`
        });

        console.log('✅ Test WhatsApp sent:', message.sid);
        return { success: true, messageId: message.sid };
    } catch (error) {
        console.error('❌ Test WhatsApp failed:', error);
        return { success: false, error: String(error) };
    }
}
