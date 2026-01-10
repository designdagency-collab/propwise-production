// Vercel serverless function to fetch search history - with JWT verification
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
      console.error('[GetSearchHistory] User ID mismatch:', { tokenUserId: user.id, requestedUserId: userId });
      return { valid: false, error: 'User ID mismatch' };
    }
    
    return { valid: true, user };
  } catch (err) {
    console.error('[GetSearchHistory] Token verification error:', err);
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

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
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
    console.error('[GetSearchHistory] Auth failed:', verification.error);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data, error } = await supabase
      .from('search_history')
      .select('address, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Failed to fetch search history:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('Search history fetched for user:', userId, 'count:', data?.length || 0);
    return res.status(200).json({ history: data || [] });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
