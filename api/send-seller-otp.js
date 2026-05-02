// POST /api/send-seller-otp
// Body: { phone: string }
// Generates a 6-digit code, stores it in phone_verifications, sends via Twilio.
// Anonymous — no auth required. Rate-limited to 1 SMS per phone per 60s.
import { createClient } from '@supabase/supabase-js';

const RATE_LIMIT_SECONDS = 60;
const CODE_TTL_MINUTES = 5;

// AU mobile format: 04XX XXX XXX or +61 4XX XXX XXX (with or without spaces).
// Normalises to E.164 (+614XXXXXXXX). Returns null if invalid.
function normaliseAuMobile(input) {
  if (!input) return null;
  const digits = String(input).replace(/[^0-9+]/g, '');
  // Already E.164: +614XXXXXXXX (12 chars)
  if (/^\+614\d{8}$/.test(digits)) return digits;
  // National with leading 04: 04XXXXXXXX (10 chars) → +614XXXXXXXX
  if (/^04\d{8}$/.test(digits)) return '+61' + digits.slice(1);
  // Without country code or leading zero: 4XXXXXXXX (9 chars) → +614XXXXXXXX
  if (/^4\d{8}$/.test(digits)) return '+61' + digits;
  return null;
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default async function handler(req, res) {
  const allowedOrigins = ['https://upblock.ai', 'https://www.upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const phone = normaliseAuMobile(req.body?.phone);
  if (!phone) {
    return res.status(400).json({ error: 'Please enter a valid Australian mobile (04XX XXX XXX).' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  // Rate limit: at most one SMS per phone per RATE_LIMIT_SECONDS
  const { data: existing } = await supabase
    .from('phone_verifications')
    .select('last_sent_at')
    .eq('phone', phone)
    .maybeSingle();

  if (existing?.last_sent_at) {
    const secondsSince = (Date.now() - new Date(existing.last_sent_at).getTime()) / 1000;
    if (secondsSince < RATE_LIMIT_SECONDS) {
      const waitFor = Math.ceil(RATE_LIMIT_SECONDS - secondsSince);
      return res.status(429).json({ error: `Please wait ${waitFor}s before requesting another code.`, waitFor });
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { error: upsertError } = await supabase
    .from('phone_verifications')
    .upsert({
      phone,
      code,
      expires_at: expiresAt,
      verified_at: null,
      attempts: 0,
      last_sent_at: now,
    }, { onConflict: 'phone' });

  if (upsertError) {
    console.error('[SendSellerOtp] DB upsert error:', upsertError);
    return res.status(500).json({ error: 'Failed to generate code. Please try again.' });
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !auth || !from) {
    console.warn('[SendSellerOtp] Twilio not configured — code stored but not sent. Code (server log only):', code, 'phone:', phone);
    return res.status(500).json({ error: 'SMS service not configured. Please contact support.' });
  }

  try {
    const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: phone,
        From: from,
        Body: `Your upblock.ai verification code is ${code}. Expires in ${CODE_TTL_MINUTES} minutes.`,
      }),
    });

    if (!twilioRes.ok) {
      const errBody = await twilioRes.json().catch(() => ({}));
      console.error('[SendSellerOtp] Twilio error:', twilioRes.status, errBody);
      return res.status(502).json({ error: 'Could not send SMS. Please try again.' });
    }

    return res.status(200).json({ success: true, expiresInSeconds: CODE_TTL_MINUTES * 60 });
  } catch (e) {
    console.error('[SendSellerOtp] Twilio fetch error:', e);
    return res.status(502).json({ error: 'Could not send SMS. Please try again.' });
  }
}
