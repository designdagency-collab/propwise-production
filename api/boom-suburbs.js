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
    // Build query for boom_suburbs
    let query = supabase
      .from('boom_suburbs')
      .select('*');

    // Filter by state if provided
    if (state && state !== 'all') {
      query = query.eq('state', state.toUpperCase());
    }

    // Search by suburb name if provided
    if (search) {
      query = query.ilike('suburb_name', `%${search}%`);
    }

    // Sorting
    const validSortColumns = ['boom_score', 'crowding_score', 'supply_constraint_score', 'rent_value_gap_score', 'population', 'suburb_name', 'median_rent_weekly'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'boom_score';
    const ascending = sortOrder === 'asc';
    
    query = query.order(sortColumn, { ascending, nullsFirst: false });

    // Limit results
    const maxLimit = Math.min(parseInt(limit) || 100, 500);
    query = query.limit(maxLimit);

    const { data: suburbs, error } = await query;

    if (error) {
      console.error('[BoomSuburbs] Query error:', error.message, error.code);
      
      // Schema cache issue - return empty results gracefully
      if (error.message?.includes('schema cache') || error.code === 'PGRST200') {
        console.log('[BoomSuburbs] Schema cache not ready, returning empty results');
        return res.status(200).json({
          suburbs: [],
          total: 0,
          states: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'],
          lastRefresh: null,
          refreshStatus: 'schema_pending',
          message: 'Schema cache refreshing. Please wait a few minutes and try again.'
        });
      }
      
      // Table doesn't exist
      if (error.code === '42P01') {
        return res.status(200).json({
          suburbs: [],
          total: 0,
          states: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'],
          lastRefresh: null,
          refreshStatus: 'pending',
          message: 'Tables not created. Run the SQL migration first.'
        });
      }
      
      return res.status(500).json({ error: 'Failed to fetch suburbs', details: error.message });
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

    // Get total count for the state
    let total = suburbs?.length || 0;
    try {
      let countQuery = supabase
        .from('boom_suburbs')
        .select('*', { count: 'exact', head: true });
      
      if (state && state !== 'all') {
        countQuery = countQuery.eq('state', state.toUpperCase());
      }
      if (search) {
        countQuery = countQuery.ilike('suburb_name', `%${search}%`);
      }

      const { count } = await countQuery;
      total = count || total;
    } catch (e) {
      console.log('[BoomSuburbs] Could not get count:', e.message);
    }

    // Get available states
    let states = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
    try {
      const { data: stateData } = await supabase
        .from('boom_suburbs')
        .select('state');
      
      if (stateData?.length) {
        states = [...new Set(stateData.map(s => s.state))].sort();
      }
    } catch (e) {
      console.log('[BoomSuburbs] Could not get states:', e.message);
    }

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
