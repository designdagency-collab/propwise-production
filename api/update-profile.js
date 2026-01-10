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
      console.error('[UpdateProfile] User ID mismatch:', { tokenUserId: user.id, requestedUserId: userId });
      return { valid: false, error: 'User ID mismatch' };
    }
    
    return { valid: true, user };
  } catch (err) {
    console.error('[UpdateProfile] Token verification error:', err);
    return { valid: false, error: 'Token verification failed' };
  }
}

export default async function handler(req, res) {
  // CORS - restrict to our domain only
  const allowedOrigins = ['https://upblock.ai', 'https://www.upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
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

  const { userId, updates } = req.body;

  if (!userId || !updates) {
    return res.status(400).json({ error: 'Missing userId or updates' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[UpdateProfile] Missing Supabase config');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  // SECURITY: Verify the caller owns this userId
  const authHeader = req.headers.authorization;
  const verification = await verifyUserOwnership(supabase, authHeader, userId);
  
  if (!verification.valid) {
    console.error('[UpdateProfile] Auth failed:', verification.error);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // SECURITY: Only allow specific fields to be updated (whitelist)
  // NEVER include: plan_type, credit_topups, search_count, pro_used (these are payment-controlled)
  const allowedFields = [
    'phone_recovery_prompted',
    'phone',
    'phone_verified',
    'full_name',
    'enterprise_waitlist',
    'enterprise_waitlist_date'
  ];

  const sanitizedUpdates = {};
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      sanitizedUpdates[key] = value;
    } else {
      console.warn('[UpdateProfile] Blocked disallowed field:', key);
    }
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  try {
    sanitizedUpdates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('profiles')
      .update(sanitizedUpdates)
      .eq('id', userId);

    if (error) {
      console.error('[UpdateProfile] Error:', error);
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    console.log('[UpdateProfile] Updated for user:', userId, Object.keys(sanitizedUpdates));
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[UpdateProfile] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
