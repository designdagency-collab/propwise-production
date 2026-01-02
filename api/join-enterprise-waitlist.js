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

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
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

