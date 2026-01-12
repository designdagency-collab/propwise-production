// Admin API - Anonymous Visitor Analytics
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  // CORS
  const allowedOrigins = ['https://upblock.ai', 'https://www.upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Verify JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  // Check admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single();

  const ADMIN_EMAILS = ['designd.agency@gmail.com'];
  if (!ADMIN_EMAILS.includes(profile?.email?.toLowerCase())) {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }

  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get visitor counts
    const [totalVisitors, visitorsToday, visitorsWeek, visitorsMonth, totalSearches] = await Promise.all([
      // Total unique visitors (all-time)
      supabase.from('device_fingerprints').select('id', { count: 'exact', head: true }),
      // Visitors today (first seen today)
      supabase.from('device_fingerprints')
        .select('id', { count: 'exact', head: true })
        .gte('first_seen', startOfDay.toISOString()),
      // Visitors this week
      supabase.from('device_fingerprints')
        .select('id', { count: 'exact', head: true })
        .gte('first_seen', startOfWeek.toISOString()),
      // Visitors this month
      supabase.from('device_fingerprints')
        .select('id', { count: 'exact', head: true })
        .gte('first_seen', startOfMonth.toISOString()),
      // Total anonymous searches (sum of searches_used)
      supabase.from('device_fingerprints').select('searches_used')
    ]);

    // Calculate total searches by anonymous users
    const anonymousSearches = totalSearches.data?.reduce((sum, d) => sum + (d.searches_used || 0), 0) || 0;

    // Get total registered users for conversion rate
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    // Conversion rate = registered users / unique visitors
    const conversionRate = (totalVisitors.count || 0) > 0 
      ? Math.round(((totalUsers || 0) / (totalVisitors.count || 1)) * 1000) / 10
      : 0;

    // Get active visitors (seen in last 24h)
    const { count: activeToday } = await supabase
      .from('device_fingerprints')
      .select('id', { count: 'exact', head: true })
      .gte('last_seen', startOfDay.toISOString());

    console.log('[AdminVisitors] Stats:', {
      total: totalVisitors.count,
      today: visitorsToday.count,
      anonymousSearches,
      conversionRate
    });

    return res.status(200).json({
      total: totalVisitors.count || 0,
      today: visitorsToday.count || 0,
      thisWeek: visitorsWeek.count || 0,
      thisMonth: visitorsMonth.count || 0,
      activeToday: activeToday || 0,
      anonymousSearches,
      registeredUsers: totalUsers || 0,
      conversionRate,
      generatedAt: now.toISOString()
    });

  } catch (error) {
    console.error('[AdminVisitors] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch visitor data' });
  }
}
