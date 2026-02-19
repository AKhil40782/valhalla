# 📱 Twilio WhatsApp Setup Guide

Follow these steps to enable real WhatsApp notifications for the Salaar Bank Fraud System.

## 1. Create a Twilio Account
1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio) and sign up for a free account.
2. Verify your email and phone number.

## 2. Get Your Credentials
1. Log in to the [Twilio Console](https://console.twilio.com/).
2. On the main Dashboard, scroll down to **Account Info**.
3. You will see:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click "show" to reveal)

## 3. Set Up WhatsApp Sandbox (Crucial for Free Tier)
1. In the left sidebar, navigate to **Messaging** > **Try it out** > **Send a WhatsApp message**.
2. You will see a strict instruction to **Join the Sandbox**.
   - It will ask you to send a specific code (e.g., `join something-random`) to a specific Twilio number (e.g., `+1 415 523 8886`) from *your personal WhatsApp*.
3. **DO THIS IMMEDIATELY.** You cannot send messages to your phone until you join the sandbox.
4. Once you send the message from your phone, Twilio will reply confirming you are joined.

## 4. Configure the Project
1. Open the `.env.local` file in this project.
2. Update the Twilio section with your credentials:

```env
# Twilio WhatsApp API
TWILIO_ACCOUNT_SID=AC... (Paste your SID here)
TWILIO_AUTH_TOKEN=... (Paste your Auth Token here)
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886 (This is usually the default Sandbox number)
```

## 5. Testing
1. Restart the development server: `npm run dev`.
2. Go to the dashboard.
3. Click the **WhatsApp Icon** in the header.
4. Enter **YOUR** phone number (the one you used to join the sandbox).
5. Click **Send**.
6. You should receive a real WhatsApp message on your phone!

## ⚠️ Important Limitations (Free Tier)
- You can **ONLY** send messages to numbers that have "Joined the Sandbox" (step 3).
- If you try to send to an unverified number, it will fail silently or throw an error in the logs.
