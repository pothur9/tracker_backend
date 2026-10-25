const express = require('express');
const router = express.Router();

// In-memory OTP store: phone → { otp, expiresAt }
// Replace with Redis/MongoDB for multi-instance deployments
const otpStore = new Map();

const WHATSAPP_TOKEN = process.env.NEXT_PUBLIC_OTP;
const PHONE_NUMBER_ID = process.env.NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER_ID;
const GRAPH_API_URL = `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`;
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * POST /api/whatsapp-otp
 * body: { action: "send",   phone: "XXXXXXXXXX" }   → sends OTP via WhatsApp
 * body: { action: "verify", phone: "XXXXXXXXXX", otp: "XXXXXX" }  → verifies OTP
 */
router.post('/', async (req, res) => {
  try {
    const { action, phone, otp: userOtp } = req.body;

    if (!action || !phone) {
      return res.status(400).json({ message: 'action and phone are required' });
    }

    // Normalize to 91XXXXXXXXXX format
    const toNumber = String(phone).length === 10 ? `91${phone}` : String(phone);

    // ── SEND ──────────────────────────────────────────────────────────────────
    if (action === 'send') {
      const otp = generateOtp();
      otpStore.set(toNumber, { otp, expiresAt: Date.now() + OTP_TTL_MS });

      if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
        console.warn('[WhatsApp OTP] Missing NEXT_PUBLIC_OTP or NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER_ID env vars');
        // Dev fallback: just log the OTP
        console.log(`[DEV OTP] Phone ${toNumber} → OTP: ${otp}`);
        return res.json({ Status: 'Success', Details: toNumber, dev: true });
      }

      const waPayload = {
        messaging_product: 'whatsapp',
        to: toNumber,
        type: 'template',
        template: {
          name: 'otp',
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: otp }],
            },
            {
              type: 'button',
              sub_type: 'url',
              index: '0',
              parameters: [{ type: 'text', text: otp }],
            },
          ],
        },
      };

      const waResponse = await fetch(GRAPH_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(waPayload),
      });

      const waData = await waResponse.json();

      if (waResponse.ok && waData.messages?.[0]?.id) {
        return res.json({ Status: 'Success', Details: toNumber });
      }

      console.error('[WhatsApp OTP] Send failed:', waData);
      return res.status(500).json({ message: 'Failed to send WhatsApp OTP', error: waData });
    }

    // ── VERIFY ────────────────────────────────────────────────────────────────
    if (action === 'verify') {
      if (!userOtp) {
        return res.status(400).json({ message: 'otp is required' });
      }

      const stored = otpStore.get(toNumber);

      if (!stored) {
        return res.status(400).json({ Status: 'Failed', message: 'OTP not found. Please request a new one.' });
      }

      if (Date.now() > stored.expiresAt) {
        otpStore.delete(toNumber);
        return res.status(400).json({ Status: 'Failed', message: 'OTP has expired. Please request a new one.' });
      }

      if (stored.otp !== String(userOtp)) {
        return res.status(400).json({ Status: 'Failed', message: 'Invalid OTP. Please try again.' });
      }

      // Correct OTP — delete for one-time use
      otpStore.delete(toNumber);
      return res.json({ Status: 'Success', verified: true });
    }

    return res.status(400).json({ message: 'Invalid action. Use "send" or "verify".' });
  } catch (error) {
    console.error('[WhatsApp OTP] Error:', error);
    return res.status(500).json({ message: 'OTP operation failed' });
  }
});

module.exports = router;
