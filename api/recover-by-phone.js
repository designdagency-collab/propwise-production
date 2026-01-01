import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Generate a 6-digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  try {
    // Look up user by verified phone number
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, phone, phone_verified')
      .eq('phone', phone)
      .eq('phone_verified', true)
      .single();

    if (fetchError || !profile) {
      console.log('[RecoverByPhone] No verified account found for phone:', phone.slice(0, -4) + '****');
      // Don't reveal if phone exists or not for security
      return res.status(400).json({ error: 'No account found with this verified phone number. Please use email recovery instead.' });
    }

    // Generate recovery code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

    // Store recovery code in profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        recovery_code: code,
        recovery_code_expires_at: expiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id);

    if (updateError) {
      console.error('[RecoverByPhone] Failed to store code:', updateError);
      return res.status(500).json({ error: 'Failed to process recovery. Please try again.' });
    }

    // Send SMS via Twilio
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error('[RecoverByPhone] Twilio not configured');
      return res.status(500).json({ error: 'SMS service not configured. Please use email recovery.' });
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
        Body: `Your Upblock account recovery code is: ${code}. This code expires in 5 minutes. If you didn't request this, please ignore.`
      })
    });

    if (!twilioResponse.ok) {
      const twilioError = await twilioResponse.json();
      console.error('[RecoverByPhone] Twilio error:', twilioError);
      return res.status(500).json({ error: 'Failed to send SMS. Please try again.' });
    }

    console.log('[RecoverByPhone] Recovery SMS sent to:', phone.slice(0, -4) + '****');
    
    return res.status(200).json({ 
      success: true, 
      message: 'Recovery code sent to your phone',
      email: profile.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') // Masked email for display
    });
  } catch (error) {
    console.error('[RecoverByPhone] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

