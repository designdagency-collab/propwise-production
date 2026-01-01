// Vercel serverless function to save search history - bypasses RLS using service role
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, address } = req.body;

  if (!userId || !address) {
    return res.status(400).json({ error: 'userId and address are required' });
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
    // Update search count in profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('search_count')
      .eq('id', userId)
      .single();

    const currentCount = profile?.search_count || 0;
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        search_count: currentCount + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to update search count:', updateError);
    }

    // Insert search history
    const { error: historyError } = await supabase
      .from('search_history')
      .insert({ user_id: userId, address });

    if (historyError) {
      console.error('Failed to save search history:', historyError);
      return res.status(500).json({ error: historyError.message });
    }

    console.log('Search saved for user:', userId, 'address:', address);
    return res.status(200).json({ success: true, searchCount: currentCount + 1 });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

