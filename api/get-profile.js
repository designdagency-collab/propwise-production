// Vercel serverless function to fetch profile - bypasses RLS using service role
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, accessToken } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Verify the access token is valid (optional security check)
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
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
    // If access token provided, verify it first
    if (accessToken) {
      const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
      if (userError || !userData.user || userData.user.id !== userId) {
        return res.status(401).json({ error: 'Invalid token or user mismatch' });
      }
    }

    // Fetch profile using service role (bypasses RLS)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
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

