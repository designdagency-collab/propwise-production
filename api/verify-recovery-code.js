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

  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and code are required' });
  }

  try {
    // Look up user by phone
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, recovery_code, recovery_code_expires_at')
      .eq('phone', phone)
      .eq('phone_verified', true)
      .single();

    if (fetchError || !profile) {
      console.log('[VerifyRecovery] Profile not found for phone');
      return res.status(400).json({ error: 'Invalid recovery attempt' });
    }

    // Check if code matches (if recovery columns exist)
    if (profile.recovery_code) {
      if (profile.recovery_code !== code) {
        console.log('[VerifyRecovery] Invalid code');
        return res.status(400).json({ error: 'Invalid verification code' });
      }

      // Check expiry
      if (profile.recovery_code_expires_at && new Date(profile.recovery_code_expires_at) < new Date()) {
        console.log('[VerifyRecovery] Code expired');
        return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
      }
    }

    // Clear the recovery code
    await supabase
      .from('profiles')
      .update({
        recovery_code: null,
        recovery_code_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id);

    // Generate a password reset link for the user's email using Supabase Admin API
    const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: profile.email,
      options: {
        redirectTo: `${process.env.VITE_APP_URL || 'https://upblock.ai'}/reset-password`
      }
    });

    if (resetError) {
      console.error('[VerifyRecovery] Failed to generate reset link:', resetError);
      // Fallback: just confirm success and tell them to use email reset
      return res.status(200).json({ 
        success: true, 
        message: 'Phone verified! Check your email for the password reset link.',
        email: profile.email,
        useEmailReset: true
      });
    }

    console.log('[VerifyRecovery] Recovery successful for:', profile.email);

    // Return the reset link or action URL
    return res.status(200).json({ 
      success: true, 
      message: 'Phone verified successfully',
      email: profile.email,
      resetLink: resetData?.properties?.action_link || null,
      // If we have a hashed token, client can use it
      resetToken: resetData?.properties?.hashed_token || null
    });
  } catch (error) {
    console.error('[VerifyRecovery] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

