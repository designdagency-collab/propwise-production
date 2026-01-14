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
  const maxLimit = Math.min(parseInt(limit) || 100, 500);

  try {
    // Try direct REST API call to bypass PostgREST schema cache
    const restUrl = `${supabaseUrl}/rest/v1/boom_suburbs?select=*&limit=${maxLimit}`;
    const headers = {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    // Add filters
    let url = restUrl;
    if (state && state !== 'all') {
      url += `&state=eq.${state.toUpperCase()}`;
    }
    if (search) {
      url += `&suburb_name=ilike.*${encodeURIComponent(search)}*`;
    }
    
    // Add sorting
    const validSortColumns = ['boom_score', 'crowding_score', 'supply_constraint_score', 'rent_value_gap_score', 'population', 'suburb_name', 'median_rent_weekly'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'boom_score';
    const sortDir = sortOrder === 'asc' ? 'asc' : 'desc';
    url += `&order=${sortColumn}.${sortDir}.nullslast`;

    console.log('[BoomSuburbs] Fetching from:', url);
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BoomSuburbs] REST API error:', response.status, errorText);
      
      // If schema cache issue, return empty with message
      if (errorText.includes('schema cache') || response.status === 404) {
        return res.status(200).json({
          suburbs: [],
          total: 0,
          states: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'],
          lastRefresh: null,
          refreshStatus: 'schema_pending',
          message: 'Database schema is refreshing. Please pause and resume your Supabase project, or wait 5-10 minutes.'
        });
      }
      
      throw new Error(`REST API error: ${response.status} - ${errorText}`);
    }

    const suburbs = await response.json();

    // Get metadata
    let metadata = null;
    try {
      const metaResponse = await fetch(
        `${supabaseUrl}/rest/v1/boom_data_metadata?id=eq.main&limit=1`,
        { headers }
      );
      if (metaResponse.ok) {
        const metaData = await metaResponse.json();
        metadata = metaData?.[0] || null;
      }
    } catch (e) {
      console.log('[BoomSuburbs] Could not fetch metadata:', e.message);
    }

    return res.status(200).json({
      suburbs: suburbs || [],
      total: suburbs?.length || 0,
      states: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'],
      lastRefresh: metadata?.last_refresh || null,
      refreshStatus: metadata?.refresh_status || 'pending'
    });

  } catch (error) {
    console.error('[BoomSuburbs] Error:', error.message);
    
    return res.status(200).json({
      suburbs: [],
      total: 0,
      states: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'],
      lastRefresh: null,
      refreshStatus: 'schema_pending',
      message: 'Database schema is refreshing. Please pause and resume your Supabase project to fix.'
    });
  }
}
