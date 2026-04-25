// POST /api/admin/streetview-backfill
// Admin-only diagnostic + backfill: iterates over every seller_interest row
// without a cached Street View image and fetches one. Returns a per-row
// breakdown so we can see exactly which addresses Google has imagery for.
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = ['designd.agency@gmail.com'];

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

async function fetchStreetViewBase64(address, googleApiKey) {
  const result = { address, status: 'unavailable', metaStatus: null, panoId: null, imageBytes: 0 };
  if (!googleApiKey || !address) {
    result.error = 'No API key or address';
    return result;
  }
  try {
    const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodeURIComponent(address)}&radius=500&key=${googleApiKey}`;
    const meta = await (await fetch(metaUrl)).json();
    result.metaStatus = meta.status;
    if (meta.status !== 'OK' || !meta.location || !meta.pano_id) {
      return result;
    }
    result.panoId = meta.pano_id;

    let heading;
    try {
      const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=au&components=country:AU&key=${googleApiKey}`;
      const geo = await (await fetch(geoUrl)).json();
      if (geo.status === 'OK' && geo.results?.[0]?.geometry?.location) {
        heading = bearing(meta.location, geo.results[0].geometry.location);
      }
    } catch {}

    const params = new URLSearchParams({
      size: '600x400',
      pano: meta.pano_id,
      fov: '80',
      pitch: '0',
      key: googleApiKey,
    });
    if (heading !== undefined) params.set('heading', heading.toFixed(1));

    const imageRes = await fetch(`https://maps.googleapis.com/maps/api/streetview?${params}`);
    if (!imageRes.ok) {
      result.error = `Image fetch failed: ${imageRes.status}`;
      return result;
    }

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    result.imageBytes = buffer.length;
    result.base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    result.status = 'available';
    return result;
  } catch (e) {
    result.error = e.message;
    return result;
  }
}

export default async function handler(req, res) {
  const allowedOrigins = ['https://upblock.ai', 'https://www.upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'Server configuration error' });
  if (!googleApiKey) return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not configured' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.slice('Bearer '.length);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single();
  if (!profile || !ADMIN_EMAILS.includes(profile.email?.toLowerCase())) {
    return res.status(403).json({ error: 'Admin only' });
  }

  // Force flag: re-fetch even rows that already have status='available'
  const force = req.body?.force === true;

  let query = supabase.from('seller_interest').select('id, property_address, street_view_status');
  if (!force) {
    query = query.in('street_view_status', ['pending', 'unavailable']).order('created_at', { ascending: false });
  }
  const { data: leads, error: leadsError } = await query;
  if (leadsError) return res.status(500).json({ error: leadsError.message });

  const results = [];
  for (const lead of leads || []) {
    const fetched = await fetchStreetViewBase64(lead.property_address, googleApiKey);

    const update = {
      street_view_status: fetched.status,
      street_view_image: fetched.base64 || null,
    };
    const { error: updateError } = await supabase
      .from('seller_interest')
      .update(update)
      .eq('id', lead.id);

    results.push({
      id: lead.id,
      address: lead.property_address,
      previousStatus: lead.street_view_status,
      newStatus: fetched.status,
      metaStatus: fetched.metaStatus,
      panoId: fetched.panoId,
      imageKB: Math.round(fetched.imageBytes / 1024),
      error: fetched.error || updateError?.message || null,
    });
  }

  return res.status(200).json({
    processed: results.length,
    available: results.filter((r) => r.newStatus === 'available').length,
    unavailable: results.filter((r) => r.newStatus === 'unavailable').length,
    results,
  });
}
