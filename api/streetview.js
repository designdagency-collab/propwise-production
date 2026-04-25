// GET /api/streetview?leadId=xxx
// Returns a Google Street View image (JPEG) of the property linked to this lead.
// Subscriber/admin only. Camera heading is computed from the closest Street
// View panorama → the property's geocoded coordinates so the photo actually
// faces the house instead of pointing along the street.
import { createClient } from '@supabase/supabase-js';

const STREET_VIEW_SIZE = '600x400';

// Calculate compass bearing (degrees, 0=N, 90=E) from one lat/lng to another.
function bearing(from, to) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const dLng = toRad(to.lng - from.lng);
  const fromLat = toRad(from.lat);
  const toLat = toRad(to.lat);
  const y = Math.sin(dLng) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

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

  // Gate: subscriber or admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single();
  if (!profile || (profile.role !== 'subscriber' && profile.role !== 'admin' && !profile.is_admin)) {
    return res.status(403).json({ error: 'Subscriber access required' });
  }

  // Gate: this user must have already revealed this lead. The Street View
  // image is part of what the $49 reveal unlocks, alongside the contact
  // details — admins bypass this since they see everything.
  if (!profile.is_admin && profile.role !== 'admin') {
    const { data: reveal } = await supabase
      .from('lead_reveals')
      .select('id')
      .eq('subscriber_id', user.id)
      .eq('lead_id', leadId)
      .maybeSingle();
    if (!reveal) {
      return res.status(403).json({ error: 'Lead not revealed' });
    }
  }

  // Look up the property address
  const { data: lead, error: leadError } = await supabase
    .from('seller_interest')
    .select('property_address')
    .eq('id', leadId)
    .single();
  if (leadError || !lead) return res.status(404).json({ error: 'Lead not found' });

  try {
    // Step 1: Ask Street View directly if it has imagery for this address.
    // Letting Google do its own geocoding here is more robust than geocoding
    // ourselves first (our geocode can land on a building centroid that's
    // 100m off the street; metadata's address resolution is tuned for this).
    const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodeURIComponent(lead.property_address)}&radius=500&key=${googleApiKey}`;
    const metaRes = await fetch(metaUrl);
    const meta = await metaRes.json();
    if (meta.status !== 'OK' || !meta.location || !meta.pano_id) {
      console.log('[StreetView] No imagery for:', lead.property_address.substring(0, 60), 'status:', meta.status);
      return res.status(404).json({ error: 'No street view available for this address' });
    }
    const panoLoc = meta.location; // { lat, lng } of the chosen panorama

    // Step 2: Best-effort geocode the address so we can aim the camera at
    // the house. If geocoding fails for any reason we still serve the image,
    // just at the panorama's default heading.
    let heading;
    try {
      const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(lead.property_address)}&region=au&components=country:AU&key=${googleApiKey}`;
      const geoRes = await fetch(geoUrl);
      const geoData = await geoRes.json();
      if (geoData.status === 'OK' && geoData.results?.[0]?.geometry?.location) {
        heading = bearing(panoLoc, geoData.results[0].geometry.location);
      }
    } catch (geoErr) {
      console.warn('[StreetView] Heading geocode failed (serving image without heading):', geoErr.message);
    }

    // Step 3: Fetch the image (billable call). Locking to the specific
    // panorama by ID ensures the heading is honoured.
    const params = new URLSearchParams({
      size: STREET_VIEW_SIZE,
      pano: meta.pano_id,
      fov: '80',
      pitch: '0',
      key: googleApiKey,
    });
    if (heading !== undefined) params.set('heading', heading.toFixed(1));

    const imageRes = await fetch(`https://maps.googleapis.com/maps/api/streetview?${params}`);
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
