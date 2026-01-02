import { createClient } from '@supabase/supabase-js';

// Generate a 6-digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Verify the user's JWT token matches the userId
 */
async function verifyUserOwnership(supabase, authHeader, userId) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing authorization header' };
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return { valid: false, error: 'Invalid token' };
    }
    
    if (user.id !== userId) {
      console.error('[SendPhoneCode] User ID mismatch:', { tokenUserId: user.id, requestedUserId: userId });
      return { valid: false, error: 'User ID mismatch' };
    }
    
    return { valid: true, user };
  } catch (err) {
    console.error('[SendPhoneCode] Token verification error:', err);
    return { valid: false, error: 'Token verification failed' };
  }
}

export default async function handler(req, res) {
  // CORS - restrict to our domain only
  const allowedOrigins = ['https://upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, phone } = req.body;

  if (!userId || !phone) {
    return res.status(400).json({ error: 'Missing userId or phone' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[SendPhoneCode] Missing Supabase config');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  // SECURITY: Verify the caller owns this userId
  const authHeader = req.headers.authorization;
  const verification = await verifyUserOwnership(supabase, authHeader, userId);
  
  if (!verification.valid) {
    console.error('[SendPhoneCode] Auth failed:', verification.error);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Generate verification code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

    // Store code in profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        phone_verification_code: code,
        phone_code_expires_at: expiresAt,
        phone_pending: phone,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('[SendPhoneCode] Failed to store code:', updateError);
      if (updateError.code === '42703' || updateError.message?.includes('column')) {
        // SECURITY: Never expose codes in response - log to server only
        console.log('[SendPhoneCode] DB columns may not exist. Code (server log only):', code);
        return res.status(500).json({ error: 'Phone verification not available. Please contact support.' });
      }
      return res.status(500).json({ error: 'Failed to generate code. Please try again.' });
    }

    // Send SMS via Twilio
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      // SECURITY: Never expose codes in response - log to server only
      console.log('[SendPhoneCode] Twilio not configured. Code (server log only):', code);
      return res.status(500).json({ error: 'SMS service not configured. Please contact support.' });
    }

    // Send SMS via Twilio REST API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        To: phone,
        From: twilioPhoneNumber,
        Body: `Your Upblock verification code is: ${code}. This code expires in 5 minutes.`
      })
    });

    if (!twilioResponse.ok) {
      const twilioError = await twilioResponse.json();
      console.error('[SendPhoneCode] Twilio error:', twilioError);
      return res.status(500).json({ error: 'Failed to send SMS' });
    }

    console.log('[SendPhoneCode] SMS sent to:', phone.slice(0, -4) + '****');
    
    return res.status(200).json({ success: true, message: 'Code sent' });
  } catch (error) {
    console.error('[SendPhoneCode] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
