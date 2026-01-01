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

  const { userId, phone } = req.body;

  if (!userId || !phone) {
    return res.status(400).json({ error: 'Missing userId or phone' });
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
      console.error('[SendPhoneCode] Error details:', JSON.stringify(updateError));
      // If columns don't exist, still allow testing
      if (updateError.code === '42703' || updateError.message?.includes('column')) {
        console.log('[SendPhoneCode] Columns may not exist - returning code for testing');
        return res.status(200).json({ 
          success: true, 
          message: 'Code generated (database columns pending)',
          testCode: code // Return code for testing until DB is set up
        });
      }
      return res.status(500).json({ error: 'Failed to generate code. Please try again.' });
    }

    // Send SMS via Twilio
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.log('[SendPhoneCode] Twilio not configured - returning code for testing');
      console.log('[SendPhoneCode] Code:', code, 'Phone:', phone);
      // Return the code so you can test the flow without Twilio
      return res.status(200).json({ 
        success: true, 
        message: 'Code generated (SMS not configured)',
        testCode: code // Remove this line once Twilio is set up!
      });
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

