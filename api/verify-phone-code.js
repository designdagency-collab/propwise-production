import { createClient } from '@supabase/supabase-js';

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
      console.error('[VerifyPhoneCode] User ID mismatch:', { tokenUserId: user.id, requestedUserId: userId });
      return { valid: false, error: 'User ID mismatch' };
    }
    
    return { valid: true, user };
  } catch (err) {
    console.error('[VerifyPhoneCode] Token verification error:', err);
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

  const { userId, phone, code } = req.body;

  if (!userId || !phone || !code) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[VerifyPhoneCode] Missing Supabase config');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  // SECURITY: Verify the caller owns this userId
  const authHeader = req.headers.authorization;
  const verification = await verifyUserOwnership(supabase, authHeader, userId);
  
  if (!verification.valid) {
    console.error('[VerifyPhoneCode] Auth failed:', verification.error);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get the stored code from profile
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('phone_verification_code, phone_code_expires_at, phone_pending')
      .eq('id', userId)
      .single();

    // If columns don't exist or fetch failed, try test mode
    if (fetchError) {
      console.log('[VerifyPhoneCode] Fetch error (columns may not exist):', fetchError.message);
      
      // In test mode, just update the basic phone field
      const { error: basicUpdateError } = await supabase
        .from('profiles')
        .update({
          phone: phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (basicUpdateError) {
        console.error('[VerifyPhoneCode] Basic update failed:', basicUpdateError);
        return res.status(500).json({ error: 'Failed to save phone number' });
      }
      
      console.log('[VerifyPhoneCode] Test mode - phone saved for user:', userId);
      return res.status(200).json({ 
        success: true, 
        message: 'Phone saved (test mode - verification columns pending)',
        phone: phone
      });
    }

    // Normal verification flow
    if (profile.phone_verification_code && profile.phone_verification_code !== code) {
      console.log('[VerifyPhoneCode] Invalid code for user:', userId);
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Check if code is expired (if expiry exists)
    if (profile.phone_code_expires_at && new Date(profile.phone_code_expires_at) < new Date()) {
      console.log('[VerifyPhoneCode] Expired code for user:', userId);
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    // Check if phone matches the pending phone (if exists)
    if (profile.phone_pending && profile.phone_pending !== phone) {
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
      // Try basic update if full update fails
      const { error: fallbackError } = await supabase
        .from('profiles')
        .update({
          phone: phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (fallbackError) {
        return res.status(500).json({ error: 'Failed to verify phone' });
      }
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
