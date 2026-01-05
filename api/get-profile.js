// Vercel serverless function to fetch profile - with JWT verification
import { createClient } from '@supabase/supabase-js';

/**
 * Verify the user's JWT token matches the userId
 */
async function verifyUserOwnership(supabase, authHeader, userId) {
  console.log('[GetProfile] Verifying auth - hasHeader:', !!authHeader, 'userId:', userId);
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[GetProfile] No auth header or wrong format');
    return { valid: false, error: 'Missing authorization header' };
  }
  
  const token = authHeader.replace('Bearer ', '');
  console.log('[GetProfile] Token length:', token?.length);
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    console.log('[GetProfile] getUser result:', { 
      hasUser: !!user, 
      userId: user?.id?.substring(0, 8), 
      error: error?.message 
    });
    
    if (error || !user) {
      return { valid: false, error: error?.message || 'Invalid token' };
    }
    
    if (user.id !== userId) {
      console.error('[GetProfile] User ID mismatch:', { tokenUserId: user.id, requestedUserId: userId });
      return { valid: false, error: 'User ID mismatch' };
    }
    
    return { valid: true, user };
  } catch (err) {
    console.error('[GetProfile] Token verification error:', err.message);
    return { valid: false, error: 'Token verification failed: ' + err.message };
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

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase config');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  // SECURITY: Verify the caller owns this userId
  const authHeader = req.headers.authorization;
  const verification = await verifyUserOwnership(supabase, authHeader, userId);
  
  if (!verification.valid) {
    console.error('[GetProfile] Auth failed:', verification.error);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // SECURITY: Only select safe fields - never expose verification codes or recovery codes
    // NOTE: Only include columns that actually exist in the profiles table
    const safeFields = [
      'id',
      'email', 
      'full_name',
      'plan_type',
      'search_count',
      'credit_topups',
      'pro_used',
      'pro_month',
      'phone',
      'phone_verified',
      'phone_recovery_prompted',
      'referral_code',
      'referral_count',
      'referral_credits_earned',
      'created_at',
      'updated_at'
      // enterprise_waitlist and enterprise_waitlist_date - add after running migration
    ].join(', ');
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(safeFields)
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return res.status(500).json({ error: profileError.message });
    }

    console.log('Profile fetched for user:', userId, profile ? 'found' : 'not found');
    
    return res.status(200).json({ profile });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
