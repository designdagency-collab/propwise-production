import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

  const { userId, phone, code } = req.body;

  if (!userId || !phone || !code) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Get the stored code from profile
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('phone_verification_code, phone_code_expires_at, phone_pending')
      .eq('id', userId)
      .single();

    if (fetchError || !profile) {
      console.error('[VerifyPhoneCode] Profile not found:', fetchError);
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Check if code matches
    if (profile.phone_verification_code !== code) {
      console.log('[VerifyPhoneCode] Invalid code for user:', userId);
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Check if code is expired
    if (new Date(profile.phone_code_expires_at) < new Date()) {
      console.log('[VerifyPhoneCode] Expired code for user:', userId);
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    // Check if phone matches the pending phone
    if (profile.phone_pending !== phone) {
      console.log('[VerifyPhoneCode] Phone mismatch');
      return res.status(400).json({ error: 'Phone number mismatch' });
    }

    // Success! Update profile with verified phone
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        phone: phone,
        phone_verified: true,
        phone_recovery_prompted: true,
        phone_verification_code: null,
        phone_code_expires_at: null,
        phone_pending: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('[VerifyPhoneCode] Failed to update profile:', updateError);
      return res.status(500).json({ error: 'Failed to verify phone' });
    }

    console.log('[VerifyPhoneCode] Phone verified for user:', userId);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Phone verified successfully',
      phone: phone
    });
  } catch (error) {
    console.error('[VerifyPhoneCode] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

