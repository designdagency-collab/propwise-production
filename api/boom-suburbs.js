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
    // Get metadata (last refresh date)
    const { data: metadata } = await supabase
      .from('boom_data_metadata')
      .select('*')
      .eq('id', 'main')
      .single();

    // Build query
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
      console.error('[BoomSuburbs] Query error:', error);
      return res.status(500).json({ error: 'Failed to fetch suburbs' });
    }

    // Get total count for the state
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

    // Get available states
    const { data: states } = await supabase
      .from('boom_suburbs')
      .select('state')
      .order('state');
    
    const uniqueStates = [...new Set(states?.map(s => s.state) || [])];

    return res.status(200).json({
      suburbs: suburbs || [],
      total: count || 0,
      states: uniqueStates,
      lastRefresh: metadata?.last_refresh || null,
      refreshStatus: metadata?.refresh_status || 'unknown'
    });

  } catch (error) {
    console.error('[BoomSuburbs] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
