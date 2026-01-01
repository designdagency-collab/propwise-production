// Vercel serverless function to save search history and sync credits - bypasses RLS
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, address, creditTopups, skipCreditConsumption } = req.body;

  if (!userId || !address) {
    return res.status(400).json({ error: 'userId and address are required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase config');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Create service role client (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  try {
    // Get current profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('search_count, credit_topups')
      .eq('id', userId)
      .single();

    const currentCount = profile?.search_count || 0;
    let newCount = currentCount;
    
    // Only update credits if not a free re-search
    if (!skipCreditConsumption) {
      // Build update object
      const updates = { 
        search_count: currentCount + 1,
        updated_at: new Date().toISOString()
      };
      newCount = currentCount + 1;
      
      // If creditTopups provided, sync it to Supabase
      // This ensures purchased credits stay in sync
      if (typeof creditTopups === 'number') {
        updates.credit_topups = creditTopups;
        console.log('Syncing credit_topups to:', creditTopups);
      }
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (updateError) {
        console.error('Failed to update profile:', updateError);
      }
    } else {
      console.log('Skipping credit consumption - free re-search');
    }

    // Insert search history
    console.log('Attempting to insert search history:', { user_id: userId, address });
    const { data: historyData, error: historyError } = await supabase
      .from('search_history')
      .insert({ user_id: userId, address })
      .select();

    if (historyError) {
      console.error('Failed to save search history:', JSON.stringify(historyError));
      // Don't fail the whole request - credits were updated successfully
      // Just log the error and continue
    } else {
      console.log('Search history saved successfully:', historyData);
    }

    console.log('Search saved for user:', userId, 'address:', address, 'newCount:', newCount, 'freeResearch:', !!skipCreditConsumption);
    return res.status(200).json({ 
      success: true, 
      searchCount: newCount,
      creditTopups: profile?.credit_topups,
      historyError: historyError ? historyError.message : null,
      freeResearch: !!skipCreditConsumption
    });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

