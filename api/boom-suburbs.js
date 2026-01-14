// API endpoint to fetch pre-cached boom suburb scores by state
// Data is refreshed monthly via /api/admin/refresh-boom-data

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { state, search, sortBy = 'boom_score', sortOrder = 'desc', limit = 100 } = req.query;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Validate sort column
    const validSortColumns = ['boom_score', 'crowding_score', 'supply_constraint_score', 'rent_value_gap_score', 'population', 'suburb_name', 'median_rent_weekly'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'boom_score';
    const maxLimit = Math.min(parseInt(limit) || 100, 500);

    // Use RPC function to bypass PostgREST schema cache issues
    const { data: suburbs, error } = await supabase.rpc('get_boom_suburbs', {
      p_state: state || 'all',
      p_search: search || '',
      p_sort_by: sortColumn,
      p_sort_order: sortOrder || 'desc',
      p_limit: maxLimit
    });

    if (error) {
      console.error('[BoomSuburbs] RPC error:', error.message, error.code, error.hint);
      
      // Return error details for debugging
      return res.status(200).json({
        suburbs: [],
        total: 0,
        states: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'],
        lastRefresh: null,
        refreshStatus: 'error',
        message: `RPC Error: ${error.message}`,
        errorCode: error.code,
        errorHint: error.hint
      });
    }

    // Get metadata (last refresh date) - separate try/catch so it doesn't fail the whole request
    let metadata = null;
    try {
      const { data: metaData } = await supabase
        .from('boom_data_metadata')
        .select('*')
        .eq('id', 'main')
        .single();
      metadata = metaData;
    } catch (e) {
      console.log('[BoomSuburbs] Could not fetch metadata:', e.message);
    }

    // Count is just the length of results for now (simpler)
    const total = suburbs?.length || 0;

    // Default states
    const states = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

    return res.status(200).json({
      suburbs: suburbs || [],
      total: total || 0,
      states,
      lastRefresh: metadata?.last_refresh || null,
      refreshStatus: metadata?.refresh_status || 'unknown'
    });

  } catch (error) {
    console.error('[BoomSuburbs] Unexpected error:', error);
    
    // Return empty data gracefully for any error
    return res.status(200).json({
      suburbs: [],
      total: 0,
      states: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'],
      lastRefresh: null,
      refreshStatus: 'error',
      message: error.message || 'An error occurred'
    });
  }
}
