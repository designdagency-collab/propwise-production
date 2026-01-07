// Admin API - Estimate API costs based on search volume + Google Cloud actual costs
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const billingAccountId = process.env.GOOGLE_CLOUD_BILLING_ACCOUNT_ID;
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

// Base cost per search estimate (Gemini 1.5 Pro pricing)
// This gets calibrated over time based on actual Google Cloud costs
const BASE_COST_PER_SEARCH = 0.0085;

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

    // Fetch Google Cloud actual costs if configured
    let googleCloudCosts = null;
    if (billingAccountId && credentialsJson) {
      try {
        googleCloudCosts = await fetchGoogleCloudCosts(credentialsJson, billingAccountId);
      } catch (gcErr) {
        console.error('[AdminBilling] Google Cloud fetch error:', gcErr.message);
      }
    }

    // Get calibration factor from stored history (learns over time)
    const { data: calibrationData } = await supabase
      .from('billing_calibration')
      .select('calibration_factor, last_actual_cost, last_search_count')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    // Use calibrated cost per search, or base if no calibration yet
    const calibrationFactor = calibrationData?.calibration_factor || 1.0;
    const costPerSearch = BASE_COST_PER_SEARCH * calibrationFactor;

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

    // Calculate estimated costs based on calibrated search cost
    const currentMonthEstimate = Math.round(currentMonthCount * costPerSearch * 100) / 100;
    const lastMonthEstimate = Math.round(lastMonthCount * costPerSearch * 100) / 100;
    const totalEstimate = Math.round(totalCount * costPerSearch * 100) / 100;

    // Calculate daily average and projected monthly cost
    const daysElapsed = Math.max(1, now.getDate());
    const dailyAverage = currentMonthEstimate / daysElapsed;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedMonthly = dailyAverage * daysInMonth;

    // If we have actual Google Cloud costs, update calibration
    if (googleCloudCosts?.currentMonth > 0 && currentMonthCount > 0) {
      const actualCostPerSearch = googleCloudCosts.currentMonth / currentMonthCount;
      const newCalibrationFactor = actualCostPerSearch / BASE_COST_PER_SEARCH;
      
      // Store calibration data (exponential moving average for smoothing)
      const smoothedFactor = calibrationFactor * 0.7 + newCalibrationFactor * 0.3;
      
      await supabase
        .from('billing_calibration')
        .upsert({
          id: 'main',
          calibration_factor: Math.round(smoothedFactor * 1000) / 1000,
          last_actual_cost: googleCloudCosts.currentMonth,
          last_search_count: currentMonthCount,
          updated_at: now.toISOString()
        }, { onConflict: 'id' });
    }

    const billing = {
      configured: true,
      currentMonth: {
        estimated: currentMonthEstimate,
        actual: googleCloudCosts?.currentMonth || null,
        searches: currentMonthCount,
        period: `${startOfMonth.toLocaleDateString()} - ${now.toLocaleDateString()}`
      },
      lastMonth: {
        estimated: lastMonthEstimate,
        searches: lastMonthCount
      },
      allTime: {
        estimated: totalEstimate,
        searches: totalCount
      },
      googleCloud: googleCloudCosts ? {
        accountName: googleCloudCosts.accountName,
        currentBalance: googleCloudCosts.currentBalance,
        currentMonth: googleCloudCosts.currentMonth,
        status: googleCloudCosts.status
      } : null,
      projectedMonthly: Math.round(projectedMonthly * 100) / 100,
      dailyAverage: Math.round(dailyAverage * 1000) / 1000,
      costPerSearch: Math.round(costPerSearch * 10000) / 10000,
      calibrationFactor: Math.round(calibrationFactor * 100) / 100,
      note: googleCloudCosts 
        ? `Calibrated from actual Google Cloud costs (factor: ${calibrationFactor.toFixed(2)}×)`
        : `Estimated: ${totalCount} searches × $${costPerSearch.toFixed(4)}/search`,
      generatedAt: now.toISOString()
    };

    console.log('[AdminBilling] Estimated costs:', { 
      currentMonth: currentMonthEstimate, 
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
