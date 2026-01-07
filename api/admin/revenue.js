// Admin API - Fetch revenue metrics from Stripe
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

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

  // Authorized admin emails (hardcoded for security)
  const ADMIN_EMAILS = [
    'designd.agency@gmail.com'
  ];
  
  const isAuthorizedAdmin = ADMIN_EMAILS.includes(profile?.email?.toLowerCase());
  if (profileError || !isAuthorizedAdmin) {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }

  if (!stripeSecretKey) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  try {
    const stripe = new Stripe(stripeSecretKey);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    // Helper function to fetch ALL charges with pagination
    async function fetchAllCharges() {
      const allCharges = [];
      let hasMore = true;
      let startingAfter = undefined;
      
      while (hasMore) {
        const params = { 
          limit: 100, 
          status: 'succeeded'
        };
        if (startingAfter) {
          params.starting_after = startingAfter;
        }
        
        const result = await stripe.charges.list(params);
        allCharges.push(...result.data);
        
        hasMore = result.has_more;
        if (result.data.length > 0) {
          startingAfter = result.data[result.data.length - 1].id;
        }
        
        // Safety limit: stop at 1000 charges to prevent infinite loops
        if (allCharges.length >= 1000) {
          console.log('[AdminRevenue] Hit 1000 charge limit, stopping pagination');
          break;
        }
      }
      
      return allCharges;
    }

    // Fetch data from Stripe in parallel (except charges which need pagination)
    const [
      balanceResult,
      subscriptionsResult,
      recentPaymentsResult
    ] = await Promise.all([
      // Current balance
      stripe.balance.retrieve(),
      
      // Active subscriptions
      stripe.subscriptions.list({ 
        status: 'active',
        limit: 100
      }),
      
      // Recent payments for transaction list
      stripe.paymentIntents.list({
        limit: 20,
        created: { gte: Math.floor(thirtyDaysAgo.getTime() / 1000) }
      })
    ]);

    // Fetch ALL charges with pagination
    const charges = await fetchAllCharges();
    console.log(`[AdminRevenue] Fetched ${charges.length} total charges`);
    
    // Total revenue (all time from fetched charges)
    const totalRevenue = charges.reduce((sum, charge) => sum + charge.amount, 0) / 100;
    
    // Revenue today
    const todayCharges = charges.filter(c => new Date(c.created * 1000) >= startOfDay);
    const revenueToday = todayCharges.reduce((sum, charge) => sum + charge.amount, 0) / 100;
    
    // Revenue this week
    const weekCharges = charges.filter(c => new Date(c.created * 1000) >= startOfWeek);
    const revenueThisWeek = weekCharges.reduce((sum, charge) => sum + charge.amount, 0) / 100;
    
    // Revenue this month
    const monthlyCharges = charges.filter(c => new Date(c.created * 1000) >= startOfMonth);
    const revenueThisMonth = monthlyCharges.reduce((sum, charge) => sum + charge.amount, 0) / 100;
    
    // Revenue this year
    const yearCharges = charges.filter(c => new Date(c.created * 1000) >= startOfYear);
    const revenueThisYear = yearCharges.reduce((sum, charge) => sum + charge.amount, 0) / 100;
    
    // MRR from active subscriptions
    const mrr = subscriptionsResult.data.reduce((sum, sub) => {
      const monthlyAmount = sub.items.data.reduce((itemSum, item) => {
        const price = item.price;
        if (price.recurring?.interval === 'month') {
          return itemSum + (price.unit_amount || 0);
        } else if (price.recurring?.interval === 'year') {
          return itemSum + ((price.unit_amount || 0) / 12);
        }
        return itemSum;
      }, 0);
      return sum + monthlyAmount;
    }, 0) / 100;
    
    // Count by product type
    const productCounts = {
      starterPack: 0,
      bulkPack: 0,
      proSubscription: subscriptionsResult.data.length
    };
    
    charges.forEach(charge => {
      const description = (charge.description || '').toLowerCase();
      if (description.includes('starter') || description.includes('3 pack')) {
        productCounts.starterPack++;
      } else if (description.includes('20 pack') || description.includes('bulk')) {
        productCounts.bulkPack++;
      }
    });
    
    // Average order value
    const avgOrderValue = charges.length > 0 ? totalRevenue / charges.length : 0;
    
    // Transaction counts by period
    const transactionCount = charges.length;
    const transactionsToday = todayCharges.length;
    const transactionsThisWeek = weekCharges.length;
    const transactionsThisMonth = monthlyCharges.length;
    const transactionsThisYear = yearCharges.length;
    
    // Format recent transactions
    const recentTransactions = recentPaymentsResult.data
      .filter(pi => pi.status === 'succeeded')
      .map(pi => ({
        id: pi.id,
        amount: (pi.amount || 0) / 100,
        currency: pi.currency?.toUpperCase() || 'AUD',
        status: pi.status,
        description: pi.description || 'Payment',
        created: new Date(pi.created * 1000).toISOString(),
        customerEmail: pi.receipt_email || 'N/A'
      }));

    // Available balance
    const availableBalance = balanceResult.available.reduce((sum, b) => sum + b.amount, 0) / 100;
    const pendingBalance = balanceResult.pending.reduce((sum, b) => sum + b.amount, 0) / 100;

    const revenue = {
      totalRevenue,
      revenueToday,
      revenueThisWeek,
      revenueThisMonth,
      revenueThisYear,
      mrr,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      transactionCount,
      transactionsToday,
      transactionsThisWeek,
      transactionsThisMonth,
      transactionsThisYear,
      productCounts,
      availableBalance,
      pendingBalance,
      recentTransactions,
      activeSubscriptions: subscriptionsResult.data.length,
      generatedAt: now.toISOString()
    };

    console.log('[AdminRevenue] Fetched revenue metrics for:', profile.email);
    return res.status(200).json(revenue);

  } catch (error) {
    console.error('[AdminRevenue] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch revenue metrics' });
  }
}

