// Track referral when new user signs up via referral link
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_REFERRALS_PER_USER = 10;

export default async function handler(req, res) {
  // CORS
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

  const { referralCode, newUserId } = req.body;

  if (!referralCode || !newUserId) {
    return res.status(400).json({ error: 'Missing referralCode or newUserId' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Find the referrer by their code
    const { data: referrer, error: referrerError } = await supabase
      .from('profiles')
      .select('id, referral_count, plan_type')
      .eq('referral_code', referralCode.toUpperCase())
      .single();

    if (referrerError || !referrer) {
      console.log('[TrackReferral] Invalid referral code:', referralCode);
      return res.status(404).json({ error: 'Invalid referral code' });
    }

    // Check if referrer has hit max referrals
    if (referrer.referral_count >= MAX_REFERRALS_PER_USER) {
      console.log('[TrackReferral] Referrer has maxed out referrals:', referrer.id);
      return res.status(400).json({ error: 'Referrer has reached maximum referrals' });
    }

    // Prevent self-referral
    if (referrer.id === newUserId) {
      console.log('[TrackReferral] Self-referral attempted:', newUserId);
      return res.status(400).json({ error: 'Cannot refer yourself' });
    }

    // Check if this user was already referred
    const { data: existingReferral } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_id', newUserId)
      .maybeSingle();

    if (existingReferral) {
      console.log('[TrackReferral] User already referred:', newUserId);
      return res.status(400).json({ error: 'User already has a referrer' });
    }

    // Create the referral record
    const { error: insertError } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrer.id,
        referred_id: newUserId,
        status: 'pending'
      });

    if (insertError) {
      console.error('[TrackReferral] Insert error:', insertError);
      return res.status(500).json({ error: 'Failed to track referral' });
    }

    // Update the new user's referred_by field
    await supabase
      .from('profiles')
      .update({ referred_by: referrer.id })
      .eq('id', newUserId);

    // Get the new user's name for the notification
    const { data: newUserProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', newUserId)
      .single();

    const newUserName = newUserProfile?.full_name?.split(' ')[0] || 'Someone';

    // Create notification for referrer (pending verification)
    await supabase
      .from('notifications')
      .insert({
        user_id: referrer.id,
        type: 'referral_signup',
        title: 'New referral signup!',
        message: `${newUserName} signed up with your link. Credits will be awarded once they verify their phone.`,
        data: { referred_id: newUserId, referred_name: newUserName }
      });

    console.log('[TrackReferral] Referral tracked:', { referrer: referrer.id, referred: newUserId, referredName: newUserName });

    return res.status(200).json({ 
      success: true,
      message: 'Referral tracked successfully'
    });

  } catch (error) {
    console.error('[TrackReferral] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

