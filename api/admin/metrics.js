// Admin API - Fetch dashboard metrics
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    .select('email, phone_verified')
    .eq('id', user.id)
    .single();

  console.log('[AdminMetrics] Profile check:', { 
    email: profile?.email, 
    phone_verified: profile?.phone_verified,
    profileError: profileError?.message 
  });

  // Authorized admin emails (hardcoded for security)
  const ADMIN_EMAILS = [
    'designd.agency@gmail.com'
  ];
  
  const userEmail = profile?.email?.toLowerCase()?.trim();
  const isAuthorizedAdmin = ADMIN_EMAILS.includes(userEmail);
  
  console.log('[AdminMetrics] Auth check:', { userEmail, isAuthorizedAdmin, phone_verified: profile?.phone_verified });
  
  if (profileError || !isAuthorizedAdmin) {
    console.log('[AdminMetrics] Access denied - not authorized admin');
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  
  // Check phone verification - return special response so UI can prompt verification
  if (!profile?.phone_verified) {
    console.log('[AdminMetrics] Phone not verified - sending verification prompt');
    return res.status(200).json({ 
      requiresPhoneVerification: true,
      message: 'Phone verification required for admin access'
    });
  }
  
  console.log('[AdminMetrics] Access granted, fetching metrics...');

  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfWeek = new Date(now - now.getDay() * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all metrics in parallel
    const [
      totalUsersResult,
      verifiedUsersResult,
      planBreakdownResult,
      activeToday,
      active7d,
      active30d,
      newToday,
      newWeek,
      newMonth,
      totalSearches,
      searchesToday,
      totalCreditsResult,
      referralsResult,
      enterpriseWaitlistResult
    ] = await Promise.all([
      // Total users
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      
      // Verified users
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('phone_verified', true),
      
      // Plan breakdown
      supabase.from('profiles').select('plan_type'),
      
      // Active today
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_login_at', `${today}T00:00:00Z`),
      
      // Active 7 days
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_login_at', sevenDaysAgo),
      
      // Active 30 days
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_login_at', thirtyDaysAgo),
      
      // New today
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', `${today}T00:00:00Z`),
      
      // New this week
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', startOfWeek),
      
      // New this month
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth),
      
      // Total searches
      supabase.from('search_history').select('id', { count: 'exact', head: true }),
      
      // Searches today
      supabase.from('search_history').select('id', { count: 'exact', head: true }).gte('created_at', `${today}T00:00:00Z`),
      
      // Total credits in system
      supabase.from('profiles').select('credit_topups, search_count'),
      
      // Referrals
      supabase.from('referrals').select('status'),
      
      // Enterprise waitlist
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('enterprise_waitlist', true)
    ]);

    // Calculate plan breakdown
    const planCounts = {
      FREE_TRIAL: 0,
      STARTER_PACK: 0,
      PRO: 0,
      UNLIMITED_PRO: 0
    };
    if (planBreakdownResult.data) {
      planBreakdownResult.data.forEach(p => {
        const plan = p.plan_type || 'FREE_TRIAL';
        planCounts[plan] = (planCounts[plan] || 0) + 1;
      });
    }

    // Calculate total credits
    let totalCredits = 0;
    let usersAtZeroCredits = 0;
    if (totalCreditsResult.data) {
      totalCreditsResult.data.forEach(p => {
        const credits = (p.credit_topups || 0);
        const freeUsed = p.search_count || 0;
        const freeRemaining = Math.max(0, 2 - freeUsed);
        const totalUserCredits = credits + freeRemaining;
        totalCredits += totalUserCredits;
        if (totalUserCredits === 0) usersAtZeroCredits++;
      });
    }

    // Calculate referral stats
    const referralStats = {
      total: referralsResult.data?.length || 0,
      pending: 0,
      verified: 0,
      credited: 0
    };
    if (referralsResult.data) {
      referralsResult.data.forEach(r => {
        if (r.status === 'pending') referralStats.pending++;
        else if (r.status === 'verified') referralStats.verified++;
        else if (r.status === 'credited') referralStats.credited++;
      });
    }

    const metrics = {
      users: {
        total: totalUsersResult.count || 0,
        verified: verifiedUsersResult.count || 0,
        unverified: (totalUsersResult.count || 0) - (verifiedUsersResult.count || 0),
        byPlan: planCounts,
        activeToday: activeToday.count || 0,
        active7d: active7d.count || 0,
        active30d: active30d.count || 0,
        newToday: newToday.count || 0,
        newWeek: newWeek.count || 0,
        newMonth: newMonth.count || 0,
        atZeroCredits: usersAtZeroCredits
      },
      searches: {
        total: totalSearches.count || 0,
        today: searchesToday.count || 0
      },
      credits: {
        totalInSystem: totalCredits
      },
      referrals: referralStats,
      enterprise: {
        waitlist: enterpriseWaitlistResult.count || 0
      },
      generatedAt: now.toISOString()
    };

    return res.status(200).json(metrics);

  } catch (error) {
    console.error('[AdminMetrics] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch metrics' });
  }
}

