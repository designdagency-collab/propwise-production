// API endpoint to fetch pre-cached boom suburb scores by state
// Uses direct postgres connection via pg package to bypass PostgREST schema cache

import pg from 'pg';

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

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

  if (!connectionString) {
    return res.status(500).json({ 
      error: 'Database not configured',
      message: 'Add DATABASE_URL to Vercel environment variables'
    });
  }

  const maxLimit = Math.min(parseInt(limit) || 100, 500);

  // Validate and sanitize sort column
  const validSortColumns = ['boom_score', 'crowding_score', 'supply_constraint_score', 'rent_value_gap_score', 'population', 'suburb_name', 'median_rent_weekly'];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'boom_score';
  const sortDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();

    // Build WHERE clause
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (state && state !== 'all') {
      conditions.push(`state = $${paramIndex}`);
      params.push(state.toUpperCase());
      paramIndex++;
    }
    if (search) {
      conditions.push(`suburb_name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query suburbs
    const query = `
      SELECT * FROM boom_suburbs 
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDir} NULLS LAST
      LIMIT ${maxLimit}
    `;
    
    console.log('[BoomSuburbs] Query:', query, params);
    const { rows: suburbs } = await client.query(query, params);

    // Get metadata
    let metadata = null;
    try {
      const metaResult = await client.query(
        "SELECT * FROM boom_data_metadata WHERE id = 'main' LIMIT 1"
      );
      metadata = metaResult.rows?.[0] || null;
    } catch (e) {
      console.log('[BoomSuburbs] Could not fetch metadata:', e.message);
    }

    await client.end();

    return res.status(200).json({
      suburbs: suburbs || [],
      total: suburbs?.length || 0,
      states: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'],
      lastRefresh: metadata?.last_refresh || null,
      refreshStatus: metadata?.refresh_status || 'pending'
    });

  } catch (error) {
    console.error('[BoomSuburbs] Database error:', error.message);
    
    try { await client.end(); } catch (e) {}
    
    // Check if table doesn't exist
    if (error.message?.includes('does not exist')) {
      return res.status(200).json({
        suburbs: [],
        total: 0,
        states: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'],
        lastRefresh: null,
        refreshStatus: 'pending',
        message: 'Tables not created. Run the SQL migration first.'
      });
    }
    
    return res.status(200).json({
      suburbs: [],
      total: 0,
      states: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'],
      lastRefresh: null,
      refreshStatus: 'error',
      message: error.message || 'Database connection error'
    });
  }
}
