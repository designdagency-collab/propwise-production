/**
 * Static Map API Endpoint
 * Returns a static map image for PDF export
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
 * 
 * Returns: Redirects to static map image URL or returns placeholder
 */

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
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
  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;

  try {
    let mapUrl;

    // Option 1: Google Maps Static API (best quality, requires API key)
    if (googleApiKey) {
      const location = address 
        ? encodeURIComponent(address)
        : `${lat},${lng}`;
      
      mapUrl = `https://maps.googleapis.com/maps/api/staticmap?` +
        `center=${location}` +
        `&zoom=${zoom}` +
        `&size=${width}x${height}` +
        `&maptype=satellite` +
        `&markers=color:red%7C${location}` +
        `&key=${googleApiKey}`;
      
      return res.redirect(302, mapUrl);
    }

    // Option 2: Mapbox Static API (good quality, requires token)
    if (mapboxToken) {
      // TODO: Implement geocoding if only address is provided
      if (lat && lng) {
        mapUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/` +
          `pin-l+ff0000(${lng},${lat})/` +
          `${lng},${lat},${zoom},0/` +
          `${width}x${height}@2x` +
          `?access_token=${mapboxToken}`;
        
        return res.redirect(302, mapUrl);
      }
    }

    // Option 3: OpenStreetMap Static (free, no API key)
    // Using staticmapmaker.com or osm-static-maps service
    if (lat && lng) {
      // Use OpenStreetMap tile server with a static map service
      // This is a basic implementation - consider hosting your own for production
      const osmUrl = `https://staticmap.openstreetmap.de/staticmap.php?` +
        `center=${lat},${lng}` +
        `&zoom=${zoom}` +
        `&size=${width}x${height}` +
        `&markers=${lat},${lng},red-pushpin`;
      
      return res.redirect(302, osmUrl);
    }

    // Option 4: Generate a placeholder map image URL
    // When no coordinates and no API keys, return a styled placeholder
    if (address) {
      // Try to use a free geocoding + map service
      // OpenStreetMap Nominatim for geocoding (rate limited)
      try {
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(address)}` +
          `&format=json&limit=1`;
        
        const geocodeRes = await fetch(geocodeUrl, {
          headers: {
            'User-Agent': 'upblock.ai/1.0 (Property Intelligence)'
          }
        });
        
        if (geocodeRes.ok) {
          const geocodeData = await geocodeRes.json();
          if (geocodeData && geocodeData.length > 0) {
            const { lat: geoLat, lon: geoLng } = geocodeData[0];
            
            const osmUrl = `https://staticmap.openstreetmap.de/staticmap.php?` +
              `center=${geoLat},${geoLng}` +
              `&zoom=${zoom}` +
              `&size=${width}x${height}` +
              `&markers=${geoLat},${geoLng},red-pushpin`;
            
            return res.redirect(302, osmUrl);
          }
        }
      } catch (geoError) {
        console.error('Geocoding failed:', geoError);
      }
    }

    // Fallback: Return a placeholder image
    // Using a placeholder service that generates a styled "Map unavailable" image
    const placeholderUrl = `https://via.placeholder.com/${width}x${height}/f3f4f6/9ca3af?text=Map+Unavailable`;
    
    return res.redirect(302, placeholderUrl);

  } catch (error) {
    console.error('Static map error:', error);
    
    // Return placeholder on any error
    const placeholderUrl = `https://via.placeholder.com/${width}x${height}/f3f4f6/9ca3af?text=Map+Error`;
    return res.redirect(302, placeholderUrl);
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
 * 
 * 3. Add rate limiting to prevent abuse
 * 
 * 4. For high volume, consider self-hosting OSM tiles
 */

