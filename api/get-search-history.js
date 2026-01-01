// Vercel serverless function to fetch search history - bypasses RLS
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only allow POST
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

  // Create service role client (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

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

