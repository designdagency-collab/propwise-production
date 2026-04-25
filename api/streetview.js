// GET /api/streetview?leadId=xxx
// Returns a Google Street View image (JPEG) of the property linked to this lead.
// Gated to subscribers/admins who have already revealed this specific lead.
import { createClient } from '@supabase/supabase-js';

const STREET_VIEW_SIZE = '600x400';

export default async function handler(req, res) {
  const allowedOrigins = ['https://upblock.ai', 'https://www.upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.slice('Bearer '.length);

  const { leadId } = req.query;
  if (!leadId) return res.status(400).json({ error: 'leadId is required' });

  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!googleApiKey) return res.status(500).json({ error: 'Street View not configured' });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'Server configuration error' });

  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  // Gate: subscriber or admin only. Street View is shown as a marketing hook
  // on both revealed AND unrevealed leads — the $49 reveal unlocks contact
  // details, not the property image.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single();
  if (!profile || (profile.role !== 'subscriber' && profile.role !== 'admin' && !profile.is_admin)) {
    return res.status(403).json({ error: 'Subscriber access required' });
  }

  // Look up the property address
  const { data: lead, error: leadError } = await supabase
    .from('seller_interest')
    .select('property_address')
    .eq('id', leadId)
    .single();
  if (leadError || !lead) return res.status(404).json({ error: 'Lead not found' });

  try {
    // Cheap pre-flight: metadata endpoint is free and tells us if imagery exists
    const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodeURIComponent(lead.property_address)}&key=${googleApiKey}`;
    const metaRes = await fetch(metaUrl);
    const meta = await metaRes.json();
    if (meta.status !== 'OK') {
      console.log('[StreetView] No imagery for:', lead.property_address.substring(0, 40), 'status:', meta.status);
      return res.status(404).json({ error: 'No street view available for this address' });
    }

    // Fetch the actual image (this is the billable call)
    const imageUrl = `https://maps.googleapis.com/maps/api/streetview?size=${STREET_VIEW_SIZE}&location=${encodeURIComponent(lead.property_address)}&fov=80&pitch=0&key=${googleApiKey}`;
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      console.error('[StreetView] Google API error:', imageRes.status);
      return res.status(502).json({ error: 'Street View unavailable' });
    }

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=86400'); // 1 day per browser
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('[StreetView] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch Street View' });
  }
}
