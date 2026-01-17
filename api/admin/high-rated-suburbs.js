// Admin endpoint to log and retrieve high-rated suburb discoveries
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (req.method === 'POST') {
    // Log a new high-rated suburb discovery
    const { suburbName, state, averageStars, propertyCount } = req.body;

    if (!suburbName || !averageStars) {
      return res.status(400).json({ error: 'suburbName and averageStars are required' });
    }

    try {
      // Check if this suburb was already logged recently by this user (prevent duplicates)
      const { data: existing } = await supabase
        .from('high_rated_suburbs')
        .select('id')
        .eq('user_id', user.id)
        .eq('suburb_name', suburbName)
        .eq('state', state || null)
        .gte('discovered_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .single();

      if (existing) {
        // Already logged this suburb today
        return res.status(200).json({ success: true, message: 'Already logged' });
      }

      // Insert new discovery
      const { error: insertError } = await supabase
        .from('high_rated_suburbs')
        .insert({
          user_id: user.id,
          suburb_name: suburbName,
          state: state || null,
          average_stars: averageStars,
          property_count: propertyCount || null,
          discovered_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('[HighRatedSuburbs] Insert error:', insertError);
        return res.status(500).json({ error: 'Failed to log suburb' });
      }

      console.log('[HighRatedSuburbs] Logged:', suburbName, state, '- Avg:', averageStars);
      return res.status(200).json({ success: true });

    } catch (error) {
      console.error('[HighRatedSuburbs] Error:', error);
      return res.status(500).json({ error: 'Server error' });
    }

  } else if (req.method === 'GET') {
    // Fetch high-rated suburb discoveries for admin dashboard
    try {
      // Verify admin status
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!profile?.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Fetch recent discoveries
      const { data: suburbs, error } = await supabase
        .from('high_rated_suburbs')
        .select(`
          id,
          suburb_name,
          state,
          average_stars,
          property_count,
          discovered_at,
          user_id,
          profiles!inner(email)
        `)
        .order('discovered_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('[HighRatedSuburbs] Fetch error:', error);
        return res.status(500).json({ error: 'Failed to fetch suburbs' });
      }

      return res.status(200).json({ suburbs: suburbs || [] });

    } catch (error) {
      console.error('[HighRatedSuburbs] Error:', error);
      return res.status(500).json({ error: 'Server error' });
    }

  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
