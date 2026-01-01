// Vercel serverless function to save search and consume credits - Supabase is source of truth
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, address, consumption, skipCreditConsumption } = req.body;

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

  try {
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
    
    // Only consume credits if not a free re-search
    if (!skipCreditConsumption && consumption) {
      const { field, newValue, proMonthReset } = consumption;
      
      // Update the appropriate field based on consumption type
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
    } else if (!skipCreditConsumption) {
      // Legacy: just increment search_count
      updates.search_count = (profile?.search_count || 0) + 1;
    }

    // Update profile
    if (Object.keys(updates).length > 1) { // More than just updated_at
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (updateError) {
        console.error('[SaveSearch] Profile update error:', updateError);
      }
    }

    // Insert search history
    const { error: historyError } = await supabase
      .from('search_history')
      .insert({ user_id: userId, address });

    if (historyError) {
      console.error('[SaveSearch] History insert error:', historyError.message);
    }

    // Fetch updated profile to return current values
    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('search_count, credit_topups, pro_used, pro_month, plan_type')
      .eq('id', userId)
      .single();

    console.log('[SaveSearch] Complete:', { userId, address, updates });
    
    return res.status(200).json({ 
      success: true,
      searchCount: updatedProfile?.search_count || 0,
      creditTopups: updatedProfile?.credit_topups || 0,
      proUsed: updatedProfile?.pro_used || 0,
      proMonth: updatedProfile?.pro_month || '',
      planType: updatedProfile?.plan_type || 'FREE_TRIAL',
      historyError: historyError?.message || null
    });
  } catch (error) {
    console.error('[SaveSearch] Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
