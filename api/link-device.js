// Link device fingerprint to user account for abuse tracking
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS
  const allowedOrigins = ['https://upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, fingerprint } = req.body;

  if (!userId || !fingerprint) {
    return res.status(400).json({ error: 'userId and fingerprint are required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[LinkDevice] Missing Supabase config');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  try {
    // Update the profile with the signup fingerprint
    const { error } = await supabase
      .from('profiles')
      .update({ 
        signup_fingerprint: fingerprint,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      // If column doesn't exist, log but don't fail
      if (error.code === '42703' || error.message?.includes('column')) {
        console.log('[LinkDevice] signup_fingerprint column may not exist yet');
        return res.status(200).json({ success: true, note: 'Column pending migration' });
      }
      console.error('[LinkDevice] Error:', error);
      return res.status(500).json({ error: 'Failed to link device' });
    }

    console.log('[LinkDevice] Linked fingerprint to user:', userId.substring(0, 8) + '...');
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[LinkDevice] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

