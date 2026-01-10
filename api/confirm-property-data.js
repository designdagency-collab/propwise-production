// API to save user-confirmed property data to cache
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Normalize address for consistent cache keys
function normalizeAddress(address) {
  return address
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[,\.]/g, '')
    .replace(/\s+(nsw|vic|qld|wa|sa|tas|nt|act)\s+/gi, ' $1 ');
}

export default async function handler(req, res) {
  // CORS headers
  const allowedOrigins = ['https://upblock.ai', 'https://www.upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address, data } = req.body;

  if (!address || !data) {
    return res.status(400).json({ error: 'Address and data are required' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('[ConfirmData] Supabase not configured');
    return res.status(200).json({ success: true, message: 'Data confirmed (cache not available)' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const addressKey = normalizeAddress(address);

    // Mark this data as verified by user
    const verifiedData = {
      ...data,
      _verified: true,
      _verifiedAt: new Date().toISOString()
    };

    // Upsert to property_cache - this will override any existing cached data
    const { error } = await supabase
      .from('property_cache')
      .upsert({
        address_key: addressKey,
        data: verifiedData,
        created_at: new Date().toISOString()
      }, { onConflict: 'address_key' });

    if (error) {
      console.error('[ConfirmData] Error saving to cache:', error);
      return res.status(500).json({ error: 'Failed to save confirmed data' });
    }

    console.log('[ConfirmData] Successfully saved verified data for:', addressKey.substring(0, 40) + '...');
    return res.status(200).json({ success: true, message: 'Data confirmed and saved' });

  } catch (error) {
    console.error('[ConfirmData] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

