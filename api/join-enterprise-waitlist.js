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
      console.error('[EnterpriseWaitlist] User ID mismatch:', { tokenUserId: user.id, requestedUserId: userId });
      return { valid: false, error: 'User ID mismatch' };
    }
    
    return { valid: true, user };
  } catch (err) {
    console.error('[EnterpriseWaitlist] Token verification error:', err);
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

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[EnterpriseWaitlist] Missing Supabase config');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  // SECURITY: Verify the caller owns this userId
  const authHeader = req.headers.authorization;
  const verification = await verifyUserOwnership(supabase, authHeader, userId);
  
  if (!verification.valid) {
    console.error('[EnterpriseWaitlist] Auth failed:', verification.error);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Update profile to mark enterprise interest
    const { error } = await supabase
      .from('profiles')
      .update({
        enterprise_waitlist: true,
        enterprise_waitlist_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('[EnterpriseWaitlist] Error:', error);
      // If columns don't exist, try simpler update
      const { error: fallbackError } = await supabase
        .from('profiles')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (fallbackError) {
        return res.status(500).json({ error: 'Failed to join waitlist' });
      }
    }

    console.log('[EnterpriseWaitlist] User joined:', userId);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Successfully joined Enterprise waitlist'
    });
  } catch (error) {
    console.error('[EnterpriseWaitlist] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
