// Admin API - Estimate API costs based on search volume + Google Cloud actual costs
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const billingAccountId = process.env.GOOGLE_CLOUD_BILLING_ACCOUNT_ID;
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

// Optional: Set actual account balance from Google Cloud Console for accuracy
// Format: "123.45" (in AUD)
const manualAccountBalance = process.env.GOOGLE_CLOUD_ACCOUNT_BALANCE;

// Property insights uses gemini-3-flash-preview (text + structured output)
// - Includes long prompts with property data, zoning rules, etc.
// - Per search: ~$0.035 (reasonable for text-only)
const COST_PER_TEXT_SEARCH = 0.035;

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

  if (req.method !== 'GET' && req.method !== 'POST') {
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

  // POST: Update actual balance and/or lead reveal price
  if (req.method === 'POST') {
    try {
      const { actualBalance, leadRevealPriceCents } = req.body;

      if (actualBalance === undefined && leadRevealPriceCents === undefined) {
        return res.status(400).json({ error: 'actualBalance or leadRevealPriceCents is required' });
      }

      const updates = { id: 'main', updated_at: new Date().toISOString() };

      if (actualBalance !== undefined && actualBalance !== null) {
        const balance = parseFloat(actualBalance);
        if (isNaN(balance) || balance < 0) {
          return res.status(400).json({ error: 'Invalid balance amount' });
        }
        updates.actual_balance = balance;
      }

      if (leadRevealPriceCents !== undefined && leadRevealPriceCents !== null) {
        const cents = parseInt(leadRevealPriceCents, 10);
        if (isNaN(cents) || cents < 0) {
          return res.status(400).json({ error: 'Invalid lead reveal price' });
        }
        updates.lead_reveal_price_cents = cents;
      }

      const { error: updateError } = await supabase
        .from('billing_calibration')
        .upsert(updates, { onConflict: 'id' });

      if (updateError) {
        console.error('[AdminBilling] Update error:', updateError);
        return res.status(500).json({ error: 'Failed to update billing settings' });
      }

      console.log('[AdminBilling] Updated:', updates);
      return res.status(200).json({ success: true, ...updates });

    } catch (error) {
      console.error('[AdminBilling] POST error:', error);
      return res.status(500).json({ error: 'Failed to update billing settings' });
    }
  }

  // GET: Fetch billing data
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

    const currentMonthSearchCount = currentMonthSearches.count || 0;
    const lastMonthSearchCount = lastMonthSearches.count || 0;
    const totalSearchCount = totalSearches.count || 0;

    const currentMonthTextCost = currentMonthSearchCount * COST_PER_TEXT_SEARCH;
    const currentMonthEstimate = Math.round(currentMonthTextCost * 100) / 100;

    const lastMonthTextCost = lastMonthSearchCount * COST_PER_TEXT_SEARCH;
    const lastMonthEstimate = Math.round(lastMonthTextCost * 100) / 100;

    const totalTextCost = totalSearchCount * COST_PER_TEXT_SEARCH;
    const totalEstimate = Math.round(totalTextCost * 100) / 100;

    // Calculate daily average and projected monthly cost
    const daysElapsed = Math.max(1, now.getDate());
    const dailyAverage = currentMonthEstimate / daysElapsed;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedMonthly = dailyAverage * daysInMonth;

    const blendedCostPerCall = currentMonthSearchCount > 0 ? currentMonthEstimate / currentMonthSearchCount : COST_PER_TEXT_SEARCH;

    // Get stored actual balance and lead reveal price from database
    const { data: balanceData } = await supabase
      .from('billing_calibration')
      .select('actual_balance, lead_reveal_price_cents')
      .eq('id', 'main')
      .maybeSingle();

    const leadRevealPriceCents = balanceData?.lead_reveal_price_cents ?? 4900;

    // Account payable: priority order:
    // 1. Database stored actual balance (editable from dashboard)
    // 2. Manual override from env var
    // 3. Actual from Google Cloud API
    // 4. Our estimate
    let accountPayable = totalEstimate;
    let isActualBalance = false;
    
    if (balanceData?.actual_balance !== null && balanceData?.actual_balance !== undefined) {
      accountPayable = parseFloat(balanceData.actual_balance);
      isActualBalance = true;
    } else if (manualAccountBalance) {
      accountPayable = parseFloat(manualAccountBalance);
      isActualBalance = true;
    } else if (googleCloudCosts?.currentMonth !== null && googleCloudCosts?.currentMonth !== undefined) {
      // Use actual Google Cloud cost for this month + our estimate for previous months
      const previousMonthsEstimate = totalEstimate - currentMonthEstimate;
      accountPayable = previousMonthsEstimate + googleCloudCosts.currentMonth;
      isActualBalance = true;
    }

    const billing = {
      configured: true,
      accountPayable: Math.round(accountPayable * 100) / 100,
      isActualBalance,
      currentMonth: {
        estimated: currentMonthEstimate,
        actual: googleCloudCosts?.currentMonth || null,
        searches: currentMonthSearchCount,
        period: `${startOfMonth.toLocaleDateString()} - ${now.toLocaleDateString()}`
      },
      lastMonth: {
        estimated: lastMonthEstimate,
        searches: lastMonthSearchCount
      },
      allTime: {
        estimated: totalEstimate,
        searches: totalSearchCount
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
      blendedCostPerCall: Math.round(blendedCostPerCall * 10000) / 10000,
      leadRevealPriceCents,
      breakdown: {
        textCost: Math.round(currentMonthTextCost * 100) / 100
      },
      note: `Text: ${currentMonthSearchCount} × $${COST_PER_TEXT_SEARCH} = $${currentMonthTextCost.toFixed(2)}`,
      generatedAt: now.toISOString()
    };

    console.log('[AdminBilling] Estimated costs:', {
      currentMonth: currentMonthEstimate,
      searches: currentMonthSearchCount,
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
    
    // Try to get actual costs using Cloud Billing v1beta API
    let currentMonthCost = null;
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Format dates for the API: YYYY-MM-DD
      const startDate = startOfMonth.toISOString().split('T')[0];
      const endDate = now.toISOString().split('T')[0];
      
      // Try the cost query endpoint (v1beta)
      const costResponse = await fetch(
        `https://cloudbilling.googleapis.com/v1beta/billingAccounts/${billingAccountId}/services/-/costs:query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            dateRange: {
              startDate: { year: startOfMonth.getFullYear(), month: startOfMonth.getMonth() + 1, day: 1 },
              endDate: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
            }
          })
        }
      );
      
      if (costResponse.ok) {
        const costData = await costResponse.json();
        console.log('[AdminBilling] Cost API response:', JSON.stringify(costData).substring(0, 500));
        
        // Parse the cost data - structure varies by API version
        if (costData.costTotal?.units) {
          currentMonthCost = parseFloat(costData.costTotal.units) + 
            (parseFloat(costData.costTotal.nanos || 0) / 1e9);
        } else if (costData.rows) {
          // Aggregate all cost rows
          currentMonthCost = costData.rows.reduce((sum, row) => {
            const cost = row.cost?.units ? parseFloat(row.cost.units) : 0;
            const nanos = row.cost?.nanos ? parseFloat(row.cost.nanos) / 1e9 : 0;
            return sum + cost + nanos;
          }, 0);
        }
      } else {
        const errorText = await costResponse.text();
        console.log('[AdminBilling] Cost API not available:', costResponse.status, errorText.substring(0, 200));
      }
    } catch (costError) {
      console.log('[AdminBilling] Cost query failed (may need BigQuery export):', costError.message);
    }
    
    return {
      accountName: accountData.displayName || accountData.name,
      status: accountData.open ? 'Active' : 'Closed',
      masterBillingAccount: accountData.masterBillingAccount || null,
      currentMonth: currentMonthCost,
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
      scope: 'https://www.googleapis.com/auth/cloud-billing.readonly https://www.googleapis.com/auth/cloud-platform'
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
