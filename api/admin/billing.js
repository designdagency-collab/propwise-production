// Admin API - Estimate API costs based on search volume + Google Cloud actual costs
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const billingAccountId = process.env.GOOGLE_CLOUD_BILLING_ACCOUNT_ID;
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

// Optional: Set actual account balance from Google Cloud Console for accuracy
// Format: "123.45" (in AUD)
const manualAccountBalance = process.env.GOOGLE_CLOUD_ACCOUNT_BALANCE;

// Cost estimates based on actual Google AI pricing (Jan 2026)
// Property insights uses gemini-3-flash-preview (text)
// - Input: $0.075/1M tokens, Output: $0.30/1M tokens
// - Average search: ~5000 input tokens, ~2000 output tokens
// - Per search: (5000/1M * 0.075) + (2000/1M * 0.30) = $0.00097 ≈ $0.001
const COST_PER_TEXT_SEARCH = 0.001;

// Renovation visualizations use gemini-2.5-flash-image (image generation)
// - Imagen 3 pricing: $0.03 per image (standard)
// - Each visualization is one image generation
const COST_PER_IMAGE_GENERATION = 0.03;

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

    // Fetch Google Cloud actual costs if configured
    let googleCloudCosts = null;
    if (billingAccountId && credentialsJson) {
      try {
        googleCloudCosts = await fetchGoogleCloudCosts(credentialsJson, billingAccountId);
      } catch (gcErr) {
        console.error('[AdminBilling] Google Cloud fetch error:', gcErr.message);
      }
    }

    // Fetch search counts (text API calls) from database
    const [currentMonthSearches, lastMonthSearches, totalSearches] = await Promise.all([
      supabase
        .from('search_history')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString()),
      supabase
        .from('search_history')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfLastMonth.toISOString())
        .lt('created_at', startOfMonth.toISOString()),
      supabase
        .from('search_history')
        .select('id', { count: 'exact', head: true })
    ]);

    // Fetch image generation counts from visualization_cache
    const [currentMonthImages, lastMonthImages, totalImages] = await Promise.all([
      supabase
        .from('visualization_cache')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString()),
      supabase
        .from('visualization_cache')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfLastMonth.toISOString())
        .lt('created_at', startOfMonth.toISOString()),
      supabase
        .from('visualization_cache')
        .select('id', { count: 'exact', head: true })
    ]);

    const currentMonthSearchCount = currentMonthSearches.count || 0;
    const lastMonthSearchCount = lastMonthSearches.count || 0;
    const totalSearchCount = totalSearches.count || 0;

    const currentMonthImageCount = currentMonthImages.count || 0;
    const lastMonthImageCount = lastMonthImages.count || 0;
    const totalImageCount = totalImages.count || 0;

    // Calculate costs: Text searches + Image generations
    const currentMonthTextCost = currentMonthSearchCount * COST_PER_TEXT_SEARCH;
    const currentMonthImageCost = currentMonthImageCount * COST_PER_IMAGE_GENERATION;
    const currentMonthEstimate = Math.round((currentMonthTextCost + currentMonthImageCost) * 100) / 100;

    const lastMonthTextCost = lastMonthSearchCount * COST_PER_TEXT_SEARCH;
    const lastMonthImageCost = lastMonthImageCount * COST_PER_IMAGE_GENERATION;
    const lastMonthEstimate = Math.round((lastMonthTextCost + lastMonthImageCost) * 100) / 100;

    const totalTextCost = totalSearchCount * COST_PER_TEXT_SEARCH;
    const totalImageCost = totalImageCount * COST_PER_IMAGE_GENERATION;
    const totalEstimate = Math.round((totalTextCost + totalImageCost) * 100) / 100;

    // Calculate daily average and projected monthly cost
    const daysElapsed = Math.max(1, now.getDate());
    const dailyAverage = currentMonthEstimate / daysElapsed;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedMonthly = dailyAverage * daysInMonth;

    // Calculate blended cost per search (for display)
    const totalCalls = currentMonthSearchCount + currentMonthImageCount;
    const blendedCostPerCall = totalCalls > 0 ? currentMonthEstimate / totalCalls : COST_PER_TEXT_SEARCH;

    // Account payable: use manual override if set, otherwise use estimate
    const accountPayable = manualAccountBalance 
      ? parseFloat(manualAccountBalance) 
      : totalEstimate;
    const isActualBalance = !!manualAccountBalance;

    const billing = {
      configured: true,
      accountPayable: Math.round(accountPayable * 100) / 100,
      isActualBalance,
      currentMonth: {
        estimated: currentMonthEstimate,
        actual: googleCloudCosts?.currentMonth || null,
        searches: currentMonthSearchCount,
        images: currentMonthImageCount,
        period: `${startOfMonth.toLocaleDateString()} - ${now.toLocaleDateString()}`
      },
      lastMonth: {
        estimated: lastMonthEstimate,
        searches: lastMonthSearchCount,
        images: lastMonthImageCount
      },
      allTime: {
        estimated: totalEstimate,
        searches: totalSearchCount,
        images: totalImageCount
      },
      googleCloud: googleCloudCosts ? {
        accountName: googleCloudCosts.accountName,
        currentBalance: googleCloudCosts.currentBalance,
        currentMonth: googleCloudCosts.currentMonth,
        status: googleCloudCosts.status
      } : null,
      projectedMonthly: Math.round(projectedMonthly * 100) / 100,
      dailyAverage: Math.round(dailyAverage * 1000) / 1000,
      costPerSearch: COST_PER_TEXT_SEARCH,
      costPerImage: COST_PER_IMAGE_GENERATION,
      blendedCostPerCall: Math.round(blendedCostPerCall * 10000) / 10000,
      breakdown: {
        textCost: Math.round(currentMonthTextCost * 100) / 100,
        imageCost: Math.round(currentMonthImageCost * 100) / 100
      },
      note: `Text: ${currentMonthSearchCount} × $${COST_PER_TEXT_SEARCH} = $${currentMonthTextCost.toFixed(2)} | Images: ${currentMonthImageCount} × $${COST_PER_IMAGE_GENERATION} = $${currentMonthImageCost.toFixed(2)}`,
      generatedAt: now.toISOString()
    };

    console.log('[AdminBilling] Estimated costs:', { 
      currentMonth: currentMonthEstimate, 
      searches: currentMonthSearchCount,
      images: currentMonthImageCount,
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

// Fetch actual costs from Google Cloud Billing API
async function fetchGoogleCloudCosts(credentialsJson, billingAccountId) {
  try {
    const credentials = JSON.parse(credentialsJson);
    const accessToken = await getGoogleAccessToken(credentials);
    
    if (!accessToken) {
      throw new Error('Failed to get Google access token');
    }

    // Get billing account info
    const accountResponse = await fetch(
      `https://cloudbilling.googleapis.com/v1/billingAccounts/${billingAccountId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!accountResponse.ok) {
      const errorText = await accountResponse.text();
      console.error('[AdminBilling] Google API error:', accountResponse.status, errorText);
      return null;
    }

    const accountData = await accountResponse.json();
    
    // Note: To get actual cost data, you need BigQuery billing export
    // The Billing API itself doesn't provide cost breakdowns
    // For now, return account info
    return {
      accountName: accountData.displayName || accountData.name,
      status: accountData.open ? 'Active' : 'Closed',
      masterBillingAccount: accountData.masterBillingAccount || null,
      // Actual costs require BigQuery export - returning null for now
      currentMonth: null,
      currentBalance: null
    };
    
  } catch (error) {
    console.error('[AdminBilling] fetchGoogleCloudCosts error:', error);
    return null;
  }
}

// Get OAuth2 access token using service account JWT
async function getGoogleAccessToken(credentials) {
  try {
    const now = Math.floor(Date.now() / 1000);
    
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: credentials.client_email,
      sub: credentials.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/cloud-billing.readonly'
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    // Sign with private key
    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    const signature = sign.sign(credentials.private_key, 'base64');
    const encodedSignature = signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const jwt = `${signatureInput}.${encodedSignature}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('[AdminBilling] Token error:', error);
      return null;
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (error) {
    console.error('[AdminBilling] getGoogleAccessToken error:', error);
    return null;
  }
}

function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
