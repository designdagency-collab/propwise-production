// Vercel serverless function to save search and consume credits - Supabase is source of truth
// SECURITY: Credits are calculated SERVER-SIDE only - never trust client input
import { createClient } from '@supabase/supabase-js';

// Credit constants (must match billingService.ts)
const FREE_LIFETIME_BASE = 0;
const ACCOUNT_BONUS = 2;
const PRO_MONTHLY_LIMIT = 10;

/**
 * Calculate what credit to consume - SERVER-SIDE ONLY
 * This prevents clients from manipulating their credit values
 */
function calculateCreditConsumption(profile) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const planType = profile.plan_type || 'FREE_TRIAL';
  const freeUsed = profile.search_count || 0;
  const creditTopups = profile.credit_topups || 0;
  const proUsed = profile.pro_used || 0;
  const proMonth = profile.pro_month || currentMonth;
  
  // PRO subscription
  if (planType === 'PRO') {
    // Reset if new month
    if (proMonth !== currentMonth) {
      return { field: 'pro_used', newValue: 1, proMonthReset: currentMonth };
    }
    // Use monthly credits first
    if (proUsed < PRO_MONTHLY_LIMIT) {
      return { field: 'pro_used', newValue: proUsed + 1 };
    }
    // Monthly exhausted - fall back to purchased credit topups
    if (creditTopups > 0) {
      return { field: 'credit_topups', newValue: creditTopups - 1 };
    }
    return null; // No credits available
  }
  
  // UNLIMITED_PRO - track usage but don't consume
  if (planType === 'UNLIMITED_PRO') {
    return { field: 'search_count', newValue: freeUsed + 1 };
  }
  
  // FREE_TRIAL
  const freeLifetimeCredits = FREE_LIFETIME_BASE + ACCOUNT_BONUS; // 2 free
  
  // First use up free credits
  if (freeUsed < freeLifetimeCredits) {
    return { field: 'search_count', newValue: freeUsed + 1 };
  }
  
  // Then use topups
  if (creditTopups > 0) {
    return { field: 'credit_topups', newValue: creditTopups - 1 };
  }
  
  return null; // No credits available
}

/**
 * Verify the user's JWT token matches the userId
 */
async function verifyUserOwnership(supabase, authHeader, userId) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing authorization header' };
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return { valid: false, error: 'Invalid token' };
    }
    
    if (user.id !== userId) {
      console.error('[SaveSearch] User ID mismatch:', { tokenUserId: user.id, requestedUserId: userId });
      return { valid: false, error: 'User ID mismatch' };
    }
    
    return { valid: true, user };
  } catch (err) {
    console.error('[SaveSearch] Token verification error:', err);
    return { valid: false, error: 'Token verification failed' };
  }
}

export default async function handler(req, res) {
  // CORS - restrict to our domain only
  const allowedOrigins = ['https://upblock.ai', 'https://www.upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, address, skipCreditConsumption } = req.body;

  if (!userId || !address) {
    return res.status(400).json({ error: 'userId and address are required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[SaveSearch] Missing Supabase config');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  // SECURITY: Verify the caller owns this userId
  const authHeader = req.headers.authorization;
  const verification = await verifyUserOwnership(supabase, authHeader, userId);
  
  if (!verification.valid) {
    console.error('[SaveSearch] Auth failed:', verification.error);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Check if this address was searched by this user in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: recentSearch, error: recentSearchError } = await supabase
      .from('search_history')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('address', address)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    const isRecentSearch = !recentSearchError && recentSearch;
    
    if (isRecentSearch) {
      console.log('[SaveSearch] Recent search found (within 7 days), skipping credit consumption:', { 
        userId, 
        address: address.substring(0, 30) + '...', 
        lastSearched: recentSearch.created_at 
      });
    }

    // Get current profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('search_count, credit_topups, pro_used, pro_month, plan_type')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('[SaveSearch] Profile fetch error:', profileError);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }

    const updates = { updated_at: new Date().toISOString() };
    
    // SECURITY: Calculate consumption SERVER-SIDE - never trust client input
    // Skip credit consumption if this is a recent re-search (within 7 days)
    if (!skipCreditConsumption && !isRecentSearch) {
      const consumption = calculateCreditConsumption(profile);
      
      if (!consumption) {
        console.warn('[SaveSearch] No credits available for user:', userId);
        return res.status(403).json({ error: 'No credits available' });
      }
      
      const { field, newValue, proMonthReset } = consumption;
      
      if (field === 'search_count') {
        updates.search_count = newValue;
        console.log('[SaveSearch] Incrementing search_count to:', newValue);
      } else if (field === 'credit_topups') {
        updates.credit_topups = newValue;
        console.log('[SaveSearch] Decrementing credit_topups to:', newValue);
      } else if (field === 'pro_used') {
        updates.pro_used = newValue;
        if (proMonthReset) {
          updates.pro_month = proMonthReset;
          console.log('[SaveSearch] Resetting PRO month to:', proMonthReset);
        }
        console.log('[SaveSearch] Incrementing pro_used to:', newValue);
      }
    }

    // Update profile
    if (Object.keys(updates).length > 1) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (updateError) {
        console.error('[SaveSearch] Profile update error:', updateError);
      }
    }

    // Insert search history ONLY if not a recent search (prevents duplicates)
    let historyError = null;
    if (!isRecentSearch) {
      const { error } = await supabase
        .from('search_history')
        .insert({ user_id: userId, address });
      historyError = error;
    } else {
      // Update the timestamp of the existing search so it appears at the top
      await supabase
        .from('search_history')
        .update({ created_at: new Date().toISOString() })
        .eq('id', recentSearch.id);
    }

    if (historyError) {
      console.error('[SaveSearch] History insert error:', historyError.message);
    }

    // Fetch updated profile to return current values
    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('search_count, credit_topups, pro_used, pro_month, plan_type')
      .eq('id', userId)
      .single();

    console.log('[SaveSearch] Complete:', { 
      userId, 
      address: address.substring(0, 30) + '...', 
      isRecentSearch,
      creditConsumed: !isRecentSearch && !skipCreditConsumption
    });
    
    return res.status(200).json({ 
      success: true,
      searchCount: updatedProfile?.search_count || 0,
      creditTopups: updatedProfile?.credit_topups || 0,
      proUsed: updatedProfile?.pro_used || 0,
      proMonth: updatedProfile?.pro_month || '',
      planType: updatedProfile?.plan_type || 'FREE_TRIAL',
      historyError: historyError?.message || null,
      isRecentSearch: isRecentSearch || false,  // Let frontend know this was a free re-search
      creditConsumed: !isRecentSearch && !skipCreditConsumption
    });
  } catch (error) {
    console.error('[SaveSearch] Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
