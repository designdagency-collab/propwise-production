// Returns the Google Maps API key to the client at runtime so the
// Property3DView component can load Maps JS without us having to
// duplicate the key into a VITE_-prefixed env var. Security is enforced
// the same way it would be with a bundled key: HTTP referer
// restriction on the key itself in Google Cloud Console.

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not configured on server' });
  }

  return res.status(200).json({ apiKey });
}
