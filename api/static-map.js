/**
 * Static Map API Endpoint
 * Returns a static map image for PDF export
 * 
 * Improved geocoding accuracy for Australian addresses
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    address,
    lat,
    lng,
    zoom = '18',  // Higher zoom for better property view
    width = '800',
    height = '400'
  } = req.query;

  if (!address && (!lat || !lng)) {
    return res.status(400).json({ 
      error: 'Missing required parameters. Provide either address or lat/lng coordinates.' 
    });
  }

  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

  try {
    let mapUrl;
    let coordinates = { lat, lng };

    // Geocode address to get precise coordinates
    if (address && (!lat || !lng)) {
      // Try Google Geocoding first (most accurate for Australian addresses)
      if (googleApiKey) {
        try {
          const googleGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?` +
            `address=${encodeURIComponent(address)}` +
            `&region=au` +  // Bias to Australia
            `&key=${googleApiKey}`;
          
          const geocodeRes = await fetch(googleGeocodeUrl);
          if (geocodeRes.ok) {
            const geocodeData = await geocodeRes.json();
            if (geocodeData.status === 'OK' && geocodeData.results?.[0]) {
              const location = geocodeData.results[0].geometry.location;
              coordinates.lat = location.lat;
              coordinates.lng = location.lng;
              console.log('[StaticMap] Google geocoded:', address, '→', coordinates);
            }
          }
        } catch (geoError) {
          console.error('[StaticMap] Google geocoding failed:', geoError);
        }
      }
      
      // Fallback to Nominatim if Google failed
      if (!coordinates.lat || !coordinates.lng) {
        try {
          // Add Australia country code for better accuracy
          const nominatimUrl = `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(address + ', Australia')}` +
            `&format=json&limit=1&countrycodes=au&addressdetails=1`;
          
          const nominatimRes = await fetch(nominatimUrl, {
            headers: { 'User-Agent': 'upblock.ai/1.0' }
          });
          
          if (nominatimRes.ok) {
            const data = await nominatimRes.json();
            if (data?.[0]) {
              coordinates.lat = data[0].lat;
              coordinates.lng = data[0].lon;
              console.log('[StaticMap] Nominatim geocoded:', address, '→', coordinates);
            }
          }
        } catch (nomError) {
          console.error('[StaticMap] Nominatim geocoding failed:', nomError);
        }
      }
    }

    // Generate map URL
    if (googleApiKey && coordinates.lat && coordinates.lng) {
      // Google Maps Static API - highest quality
      mapUrl = `https://maps.googleapis.com/maps/api/staticmap?` +
        `center=${coordinates.lat},${coordinates.lng}` +
        `&zoom=${zoom}` +
        `&size=${width}x${height}` +
        `&scale=2` +  // High DPI
        `&maptype=satellite` +
        `&markers=color:red%7Csize:mid%7C${coordinates.lat},${coordinates.lng}` +
        `&key=${googleApiKey}`;
    } else if (coordinates.lat && coordinates.lng) {
      // OpenStreetMap fallback
      mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?` +
        `center=${coordinates.lat},${coordinates.lng}` +
        `&zoom=${Math.min(parseInt(zoom), 18)}` +
        `&size=${width}x${height}` +
        `&markers=${coordinates.lat},${coordinates.lng},red-pushpin`;
    }

    // Fetch and return the map image
    if (mapUrl) {
      try {
        const imageRes = await fetch(mapUrl, {
          headers: { 'User-Agent': 'upblock.ai/1.0' }
        });

        if (imageRes.ok) {
          const contentType = imageRes.headers.get('content-type');
          const imageBuffer = await imageRes.arrayBuffer();
          
          res.setHeader('Content-Type', contentType || 'image/png');
          return res.send(Buffer.from(imageBuffer));
        }
      } catch (fetchError) {
        console.error('[StaticMap] Failed to fetch map:', fetchError);
      }
    }

    // Fallback placeholder
    const placeholder = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="100%" height="100%" fill="#e5e7eb"/>
        <text x="50%" y="50%" text-anchor="middle" font-family="Arial" font-size="14" fill="#6b7280">
          📍 ${address ? address.substring(0, 50) : 'Location'}
        </text>
      </svg>
    `;
    
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(placeholder);

  } catch (error) {
    console.error('[StaticMap] Error:', error);
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect fill="#f3f4f6" width="100%" height="100%"/><text x="50%" y="50%" text-anchor="middle" fill="#999">Map unavailable</text></svg>`);
  }
}
