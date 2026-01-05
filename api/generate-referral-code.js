// Generate unique referral code for user
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Generate a short, memorable referral code
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 for clarity
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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

  // Verify JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify the token and get user
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    // Check if user already has a referral code
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('referral_code, plan_type')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[ReferralCode] Profile fetch error:', profileError);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }

    // Only Trial and Starter Pack can use referrals
    const eligiblePlans = ['FREE_TRIAL', 'STARTER_PACK'];
    if (!eligiblePlans.includes(profile.plan_type)) {
      return res.status(403).json({ 
        error: 'Referral program is available for Trial and Starter Pack members',
        planType: profile.plan_type
      });
    }

    // If user already has a code, return it
    if (profile.referral_code) {
      return res.status(200).json({ 
        referralCode: profile.referral_code,
        referralLink: `https://upblock.ai/?ref=${profile.referral_code}`
      });
    }

    // Generate a unique code
    let code = generateCode();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('referral_code', code)
        .maybeSingle();

      if (!existing) break;
      code = generateCode();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return res.status(500).json({ error: 'Failed to generate unique code' });
    }

    // Save the code to user's profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ referral_code: code })
      .eq('id', user.id);

    if (updateError) {
      console.error('[ReferralCode] Update error:', updateError);
      return res.status(500).json({ error: 'Failed to save referral code' });
    }

    console.log('[ReferralCode] Generated code for user:', user.id, code);

    return res.status(200).json({ 
      referralCode: code,
      referralLink: `https://upblock.ai/?ref=${code}`
    });

  } catch (error) {
    console.error('[ReferralCode] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

