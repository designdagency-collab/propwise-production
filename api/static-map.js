/**
 * Static Map API - Returns satellite map image for PDF export
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=86400');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    address,
    lat,
    lng,
    zoom = '18',
    width = '800',
    height = '400'
  } = req.query;

  if (!address && (!lat || !lng)) {
    return res.status(400).json({ error: 'Address or lat/lng required' });
  }

  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
  console.log('[StaticMap] Request for:', address || `${lat},${lng}`);
  console.log('[StaticMap] Google API Key present:', !!googleApiKey);

  try {
    let coordinates = { lat: parseFloat(lat), lng: parseFloat(lng) };

    // Geocode if we only have address
    if (address && (!coordinates.lat || !coordinates.lng || isNaN(coordinates.lat))) {
      
      // Try Google Geocoding first
      if (googleApiKey) {
        try {
          const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=au&key=${googleApiKey}`;
          console.log('[StaticMap] Google geocoding...');
          
          const geoRes = await fetch(geoUrl);
          const geoData = await geoRes.json();
          
          console.log('[StaticMap] Google geocode status:', geoData.status);
          
          if (geoData.status === 'OK' && geoData.results?.[0]) {
            const loc = geoData.results[0].geometry.location;
            coordinates.lat = loc.lat;
            coordinates.lng = loc.lng;
            console.log('[StaticMap] Coordinates:', coordinates);
          } else {
            console.log('[StaticMap] Google geocode failed:', geoData.status, geoData.error_message);
          }
        } catch (e) {
          console.error('[StaticMap] Google geocode error:', e.message);
        }
      }
      
      // Fallback to Nominatim
      if (!coordinates.lat || !coordinates.lng || isNaN(coordinates.lat)) {
        try {
          const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ', Australia')}&format=json&limit=1`;
          console.log('[StaticMap] Nominatim geocoding...');
          
          const nomRes = await fetch(nomUrl, { headers: { 'User-Agent': 'upblock.ai/1.0' } });
          const nomData = await nomRes.json();
          
          if (nomData?.[0]) {
            coordinates.lat = parseFloat(nomData[0].lat);
            coordinates.lng = parseFloat(nomData[0].lon);
            console.log('[StaticMap] Nominatim coords:', coordinates);
          }
        } catch (e) {
          console.error('[StaticMap] Nominatim error:', e.message);
        }
      }
    }

    // Generate map if we have coordinates
    if (coordinates.lat && coordinates.lng && !isNaN(coordinates.lat)) {
      let mapUrl;
      
      if (googleApiKey) {
        // Google Maps Static API
        mapUrl = `https://maps.googleapis.com/maps/api/staticmap?` +
          `center=${coordinates.lat},${coordinates.lng}` +
          `&zoom=${zoom}` +
          `&size=${width}x${height}` +
          `&scale=2` +
          `&maptype=satellite` +
          `&markers=color:red|${coordinates.lat},${coordinates.lng}` +
          `&key=${googleApiKey}`;
        
        console.log('[StaticMap] Fetching Google map...');
      } else {
        // OpenStreetMap fallback
        mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?` +
          `center=${coordinates.lat},${coordinates.lng}` +
          `&zoom=${Math.min(parseInt(zoom), 18)}` +
          `&size=${width}x${height}` +
          `&markers=${coordinates.lat},${coordinates.lng},red-pushpin`;
        
        console.log('[StaticMap] Fetching OSM map...');
      }

      try {
        const imgRes = await fetch(mapUrl, {
          headers: { 'User-Agent': 'upblock.ai/1.0' },
          timeout: 10000
        });
        
        console.log('[StaticMap] Map response:', imgRes.status, imgRes.headers.get('content-type'));

        if (imgRes.ok) {
          const contentType = imgRes.headers.get('content-type') || 'image/png';
          
          // Check if it's actually an image
          if (contentType.includes('image')) {
            const buffer = await imgRes.arrayBuffer();
            console.log('[StaticMap] Success! Image size:', buffer.byteLength, 'bytes');
            
            res.setHeader('Content-Type', contentType);
            return res.send(Buffer.from(buffer));
          } else {
            console.log('[StaticMap] Not an image:', contentType);
          }
        } else {
          const errorText = await imgRes.text();
          console.log('[StaticMap] Map fetch failed:', imgRes.status, errorText.substring(0, 200));
        }
      } catch (fetchErr) {
        console.error('[StaticMap] Fetch error:', fetchErr.message);
      }
    } else {
      console.log('[StaticMap] No valid coordinates found');
    }

    // Fallback placeholder
    console.log('[StaticMap] Returning placeholder');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#e2e8f0"/>
      <text x="50%" y="50%" text-anchor="middle" font-family="Arial" font-size="14" fill="#64748b">
        📍 ${(address || '').substring(0, 50)}
      </text>
    </svg>`;
    
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(svg);

  } catch (error) {
    console.error('[StaticMap] Error:', error);
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect fill="#f1f5f9" width="100%" height="100%"/></svg>`);
  }
}
