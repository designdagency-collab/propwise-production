/**
 * Static Map API Endpoint
 * Returns a static map image for PDF export
 * 
 * IMPORTANT: This endpoint FETCHES and RETURNS the image data (not redirect)
 * to support the pre-fetch approach in PDF export.
 * 
 * Supports multiple providers with fallback:
 * 1. Google Maps Static API (requires GOOGLE_MAPS_API_KEY)
 * 2. OpenStreetMap Static (no API key required)
 * 
 * Query params:
 * - address: Full address string (URL encoded)
 * - lat: Latitude (optional if address provided)
 * - lng: Longitude (optional if address provided)
 * - zoom: Zoom level (default: 17)
 * - width: Image width in pixels (default: 640)
 * - height: Image height in pixels (default: 400)
 */

export default async function handler(req, res) {
  // Enable CORS
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
    zoom = '17',
    width = '640',
    height = '400'
  } = req.query;

  // Validate parameters
  if (!address && (!lat || !lng)) {
    return res.status(400).json({ 
      error: 'Missing required parameters. Provide either address or lat/lng coordinates.' 
    });
  }

  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

  try {
    let mapUrl;
    let coordinates = { lat, lng };

    // If only address provided, try to geocode it first
    if (address && (!lat || !lng)) {
      try {
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(address)}` +
          `&format=json&limit=1`;
        
        const geocodeRes = await fetch(geocodeUrl, {
          headers: {
            'User-Agent': 'upblock.ai/1.0 (Property Intelligence Platform)'
          }
        });
        
        if (geocodeRes.ok) {
          const geocodeData = await geocodeRes.json();
          if (geocodeData && geocodeData.length > 0) {
            coordinates.lat = geocodeData[0].lat;
            coordinates.lng = geocodeData[0].lon;
          }
        }
      } catch (geoError) {
        console.error('Geocoding failed:', geoError);
      }
    }

    // Option 1: Google Maps Static API (best quality, requires API key)
    if (googleApiKey) {
      const location = address 
        ? encodeURIComponent(address)
        : `${coordinates.lat},${coordinates.lng}`;
      
      mapUrl = `https://maps.googleapis.com/maps/api/staticmap?` +
        `center=${location}` +
        `&zoom=${zoom}` +
        `&size=${width}x${height}` +
        `&maptype=satellite` +
        `&markers=color:red%7C${location}` +
        `&key=${googleApiKey}`;
    }
    // Option 2: OpenStreetMap Static (free, no API key)
    else if (coordinates.lat && coordinates.lng) {
      // Use OSM static map service
      mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?` +
        `center=${coordinates.lat},${coordinates.lng}` +
        `&zoom=${Math.min(parseInt(zoom), 18)}` + // OSM max zoom is 18
        `&size=${width}x${height}` +
        `&markers=${coordinates.lat},${coordinates.lng},red-pushpin`;
    }

    // If we have a map URL, fetch and return the image
    if (mapUrl) {
      try {
        const imageResponse = await fetch(mapUrl, {
          headers: {
            'User-Agent': 'upblock.ai/1.0 (Property Intelligence Platform)'
          }
        });

        if (imageResponse.ok) {
          const contentType = imageResponse.headers.get('content-type');
          const imageBuffer = await imageResponse.arrayBuffer();
          
          res.setHeader('Content-Type', contentType || 'image/png');
          return res.send(Buffer.from(imageBuffer));
        }
      } catch (fetchError) {
        console.error('Failed to fetch map image:', fetchError);
      }
    }

    // Fallback: Generate a simple placeholder SVG
    const placeholderSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#f3f4f6"/>
            <stop offset="100%" style="stop-color:#e5e7eb"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <text x="50%" y="45%" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#6b7280">📍</text>
        <text x="50%" y="55%" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#6b7280">Map Preview</text>
        <text x="50%" y="65%" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#9ca3af">${address ? address.substring(0, 40) : 'Location'}</text>
      </svg>
    `;

    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(placeholderSvg);

  } catch (error) {
    console.error('Static map error:', error);
    
    // Return a simple error placeholder
    const errorSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <text x="50%" y="50%" text-anchor="middle" font-family="Arial" font-size="14" fill="#9ca3af">Map unavailable</text>
      </svg>
    `;
    
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(errorSvg);
  }
}

/**
 * TODO: Production improvements
 * 
 * 1. Add GOOGLE_MAPS_API_KEY to Vercel environment variables for best quality
 *    - Go to Google Cloud Console > APIs & Services > Credentials
 *    - Create API key and enable "Maps Static API"
 *    - Add to Vercel: GOOGLE_MAPS_API_KEY=your_key
 * 
 * 2. Consider caching static map images to reduce API calls
 *    - Use Vercel Edge caching or a CDN
 */
