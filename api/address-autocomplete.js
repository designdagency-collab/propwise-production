/**
 * Address Autocomplete API - Returns Australian address suggestions
 * Uses Google Places Autocomplete API
 */

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { input } = req.query;

  if (!input || input.length < 3) {
    return res.status(200).json({ predictions: [] });
  }

  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!googleApiKey) {
    console.error('[Autocomplete] No Google API key configured');
    return res.status(200).json({ predictions: [] });
  }

  try {
    // Use Google Places Autocomplete API
    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', input);
    url.searchParams.set('types', 'address');
    url.searchParams.set('components', 'country:au'); // Australia only
    url.searchParams.set('key', googleApiKey);

    console.log('[Autocomplete] Fetching suggestions for:', input);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[Autocomplete] API error:', data.status, data.error_message);
      return res.status(200).json({ predictions: [] });
    }

    // Extract and format predictions
    const predictions = (data.predictions || []).slice(0, 5).map(p => ({
      description: p.description,
      placeId: p.place_id,
      // Extract main text (street address) and secondary text (suburb, state)
      mainText: p.structured_formatting?.main_text || p.description,
      secondaryText: p.structured_formatting?.secondary_text || '',
    }));

    console.log('[Autocomplete] Returning', predictions.length, 'suggestions');

    return res.status(200).json({ predictions });

  } catch (error) {
    console.error('[Autocomplete] Error:', error.message);
    return res.status(200).json({ predictions: [] });
  }
}

