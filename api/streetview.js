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
    // Step 1: Geocode the address to get the property's actual coordinates.
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(lead.property_address)}&region=au&components=country:AU&key=${googleApiKey}`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();
    if (geoData.status !== 'OK' || !geoData.results?.length) {
      console.log('[StreetView] Geocode failed for:', lead.property_address.substring(0, 40), 'status:', geoData.status);
      return res.status(404).json({ error: 'Could not locate this address' });
    }
    const propertyLoc = geoData.results[0].geometry.location; // { lat, lng }

    // Step 2: Find the closest Street View panorama. Metadata is free and
    // returns the panorama's lat/lng so we can aim the camera at the house.
    const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${propertyLoc.lat},${propertyLoc.lng}&radius=80&source=outdoor&key=${googleApiKey}`;
    const metaRes = await fetch(metaUrl);
    const meta = await metaRes.json();
    if (meta.status !== 'OK' || !meta.location) {
      console.log('[StreetView] No imagery near:', lead.property_address.substring(0, 40), 'status:', meta.status);
      return res.status(404).json({ error: 'No street view available for this address' });
    }
    const panoLoc = meta.location; // { lat, lng } of the actual panorama

    // Step 3: Compute the heading (bearing) from the panorama → property so
    // the camera looks AT the house instead of along the street.
    const heading = bearing(panoLoc, propertyLoc);

    // Step 4: Fetch the image (billable call). Locking to the specific
    // panorama by ID ensures the heading we computed is honoured.
    const params = new URLSearchParams({
      size: STREET_VIEW_SIZE,
      pano: meta.pano_id,
      heading: String(heading.toFixed(1)),
      fov: '80',
      pitch: '0',
      source: 'outdoor',
      key: googleApiKey,
    });
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
