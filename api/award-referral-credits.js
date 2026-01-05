// Award referral credits after phone verification
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const REFERRAL_CREDITS = 3;
const SMS_REMINDER_DELAY_HOURS = 48; // 2 days

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

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Find pending referral for this user (they were referred by someone)
    const { data: referral, error: referralError } = await supabase
      .from('referrals')
      .select('*, referrer:referrer_id(id, phone, credit_topups, referral_credits_earned, referral_count, last_login_at)')
      .eq('referred_id', userId)
      .eq('status', 'pending')
      .maybeSingle();

    if (referralError) {
      console.error('[AwardReferral] Referral fetch error:', referralError);
      return res.status(500).json({ error: 'Failed to fetch referral' });
    }

    if (!referral) {
      console.log('[AwardReferral] No pending referral for user:', userId);
      return res.status(200).json({ success: true, message: 'No pending referral' });
    }

    // Get the referred user's profile
    const { data: referredUser, error: referredError } = await supabase
      .from('profiles')
      .select('credit_topups')
      .eq('id', userId)
      .single();

    if (referredError) {
      console.error('[AwardReferral] Referred user fetch error:', referredError);
      return res.status(500).json({ error: 'Failed to fetch referred user' });
    }

    const referrer = referral.referrer;
    const now = new Date().toISOString();

    // Award credits to REFERRED user (the new signup)
    await supabase
      .from('profiles')
      .update({ 
        credit_topups: (referredUser.credit_topups || 0) + REFERRAL_CREDITS 
      })
      .eq('id', userId);

    // Award credits to REFERRER
    await supabase
      .from('profiles')
      .update({ 
        credit_topups: (referrer.credit_topups || 0) + REFERRAL_CREDITS,
        referral_credits_earned: (referrer.referral_credits_earned || 0) + REFERRAL_CREDITS,
        referral_count: (referrer.referral_count || 0) + 1
      })
      .eq('id', referrer.id);

    // Update referral status
    await supabase
      .from('referrals')
      .update({ 
        status: 'credited',
        referrer_credited: true,
        referred_credited: true,
        verified_at: now,
        credited_at: now
      })
      .eq('id', referral.id);

    // Create notification for REFERRER
    await supabase
      .from('notifications')
      .insert({
        user_id: referrer.id,
        type: 'referral_credited',
        title: '🎉 +3 credits earned!',
        message: 'Your friend verified their account. You both earned 3 free property audits!',
        data: { credits: REFERRAL_CREDITS, referred_id: userId }
      });

    // Create welcome notification for REFERRED user
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'welcome_bonus',
        title: '🎁 Welcome bonus!',
        message: 'You got 3 bonus credits for joining via a friend\'s referral!',
        data: { credits: REFERRAL_CREDITS, referrer_id: referrer.id }
      });

    // Schedule SMS reminder if referrer hasn't logged in recently
    // (will be sent after 48 hours if they don't log in)
    if (referrer.phone) {
      const sendAfter = new Date(Date.now() + SMS_REMINDER_DELAY_HOURS * 60 * 60 * 1000);
      
      await supabase
        .from('sms_reminder_queue')
        .insert({
          user_id: referrer.id,
          phone: referrer.phone,
          message: `🎉 Great news! Your friend joined upblock.ai and you've earned 3 free property audits. Log in to use them: https://upblock.ai`,
          send_after: sendAfter.toISOString()
        });
    }

    // Check for milestone (5 referrals, 10 referrals)
    const newReferralCount = (referrer.referral_count || 0) + 1;
    if (newReferralCount === 5 || newReferralCount === 10) {
      await supabase
        .from('notifications')
        .insert({
          user_id: referrer.id,
          type: 'referral_milestone',
          title: `🏆 ${newReferralCount} referrals!`,
          message: `Amazing! You've referred ${newReferralCount} friends to upblock.ai!`,
          data: { milestone: newReferralCount }
        });
    }

    console.log('[AwardReferral] Credits awarded:', { 
      referrer: referrer.id, 
      referred: userId, 
      credits: REFERRAL_CREDITS 
    });

    return res.status(200).json({ 
      success: true,
      creditsAwarded: REFERRAL_CREDITS,
      message: 'Referral credits awarded to both users'
    });

  } catch (error) {
    console.error('[AwardReferral] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

