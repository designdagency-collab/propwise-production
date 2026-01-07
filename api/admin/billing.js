// Admin API - Estimate API costs based on search volume
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Cost per search estimate (Gemini 1.5 Pro pricing)
// Input: ~500 tokens × $0.00125/1K = $0.000625
// Output: ~2000 tokens × $0.00375/1K = $0.0075
// Total: ~$0.0085 per search
const COST_PER_SEARCH = 0.0085;

export default async function handler(req, res) {
  // CORS
  const allowedOrigins = ['https://upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify the token and get user
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Check if user is an authorized admin email
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single();

  const ADMIN_EMAILS = ['designd.agency@gmail.com'];
  const isAuthorizedAdmin = ADMIN_EMAILS.includes(profile?.email?.toLowerCase());
  
  if (profileError || !isAuthorizedAdmin) {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Fetch search counts from database
    const [currentMonthSearches, lastMonthSearches, totalSearches] = await Promise.all([
      // Searches this month
      supabase
        .from('search_history')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString()),
      
      // Searches last month
      supabase
        .from('search_history')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfLastMonth.toISOString())
        .lt('created_at', startOfMonth.toISOString()),
      
      // Total searches all time
      supabase
        .from('search_history')
        .select('id', { count: 'exact', head: true })
    ]);

    const currentMonthCount = currentMonthSearches.count || 0;
    const lastMonthCount = lastMonthSearches.count || 0;
    const totalCount = totalSearches.count || 0;

    // Calculate costs based on search counts
    const currentMonthCost = Math.round(currentMonthCount * COST_PER_SEARCH * 100) / 100;
    const lastMonthCost = Math.round(lastMonthCount * COST_PER_SEARCH * 100) / 100;
    const totalCost = Math.round(totalCount * COST_PER_SEARCH * 100) / 100;

    // Calculate daily average and projected monthly cost
    const daysElapsed = Math.max(1, now.getDate());
    const dailyAverage = currentMonthCost / daysElapsed;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedMonthly = dailyAverage * daysInMonth;

    const billing = {
      configured: true,
      currentMonth: {
        total: currentMonthCost,
        searches: currentMonthCount,
        period: `${startOfMonth.toLocaleDateString()} - ${now.toLocaleDateString()}`
      },
      lastMonth: {
        total: lastMonthCost,
        searches: lastMonthCount
      },
      allTime: {
        total: totalCost,
        searches: totalCount
      },
      projectedMonthly: Math.round(projectedMonthly * 100) / 100,
      dailyAverage: Math.round(dailyAverage * 1000) / 1000,
      costPerSearch: COST_PER_SEARCH,
      note: `Estimated: ${totalCount} searches × $${COST_PER_SEARCH}/search (Gemini API)`,
      generatedAt: now.toISOString()
    };

    console.log('[AdminBilling] Estimated costs:', { 
      currentMonth: currentMonthCost, 
      searches: currentMonthCount,
      user: profile.email 
    });
    
    return res.status(200).json(billing);

  } catch (error) {
    console.error('[AdminBilling] Error:', error);
    return res.status(500).json({ 
      configured: false,
      error: 'Failed to fetch billing data',
      message: error.message
    });
  }
}
