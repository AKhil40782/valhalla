
export function generateFraudAlertEmail(customerName: string, transactionDetails: any, caseId: string) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; }
            .header { background-color: #d32f2f; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 20px; }
            .alert-box { background-color: #ffebee; border-left: 4px solid #d32f2f; padding: 15px; margin: 20px 0; }
            .details { background-color: #f5f5f5; padding: 15px; border-radius: 4px; }
            .btn { display: inline-block; padding: 12px 24px; background-color: #d32f2f; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 20px; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>⚠️ Important Security Alert</h2>
            </div>
            <div class="content">
                <p>Dear <strong>${customerName}</strong>,</p>
                
                <p>We have detected unusual activity on your account that requires your immediate attention. As a precaution, we have temporarily restricted access to prevent potential unauthorized transactions.</p>
                
                <div class="alert-box">
                    <strong>Reason for Alert:</strong> Suspicious Pattern Detected (Case #${caseId})
                </div>

                <div class="details">
                    <h3>Transaction Details:</h3>
                    <p><strong>Amount:</strong> ₹${transactionDetails.amount}</p>
                    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                    <p><strong>Merchant/Recipient:</strong> ${transactionDetails.recipient}</p>
                    <p><strong>Location:</strong> ${transactionDetails.location}</p>
                </div>

                <p>If you did not authorize this activity, please click the button below immediately to secure your account.</p>

                <div style="text-align: center;">
                    <a href="https://salaarbank.com/verify/${caseId}" class="btn">Review & Secure Account</a>
                </div>

                <p>If this was you, you can verify this transaction by replying to this email or calling our support line.</p>
            </div>
            <div class="footer">
                <p>Salaar Bank Security Team • 24/7 Fraud Monitoring</p>
                <p>This is an automated message. Please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    `;
}
