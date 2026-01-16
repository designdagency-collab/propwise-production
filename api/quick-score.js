// Lightweight API endpoint for Chrome Extension
// Returns just the Upblock Score (0-100) for a given address
// Much cheaper than full property-insights (2k tokens vs 10k tokens)

import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

export default async function handler(req, res) {
  // CORS - Allow Chrome extension to call from any domain
  const allowedOrigins = [
    'https://upblock.ai',
    'https://www.upblock.ai',
    'http://localhost:5173',
    'https://www.realestate.com.au',
    'https://realestate.com.au',
    'https://www.domain.com.au',
    'https://domain.com.au',
    'https://www.realcommercial.com.au',
    'https://realcommercial.com.au',
    'https://www.commercialrealestate.com.au',
    'https://commercialrealestate.com.au'
  ];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin) || origin?.startsWith('chrome-extension://')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { address } = req.body;

  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }

  // Normalize address for cache key
  const addressKey = address.toLowerCase().trim();

  try {
    // Check cache first (7 day cache for extension)
    const { data: cachedScore } = await supabase
      .from('quick_scores_cache')
      .select('score, estimated_value, confidence, cached_at')
      .eq('address_key', addressKey)
      .single();

    if (cachedScore) {
      const cacheAge = Date.now() - new Date(cachedScore.cached_at).getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      
      if (cacheAge < sevenDays) {
        console.log('[QuickScore] Cache hit for:', address);
        return res.status(200).json({
          score: cachedScore.score,
          estimatedValue: cachedScore.estimated_value,
          confidence: cachedScore.confidence,
          cached: true,
          address
        });
      }
    }

    // Calculate score using Gemini
    console.log('[QuickScore] Calculating score for:', address);
    
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const prompt = `Analyze this Australian property address and provide an investment score AND estimated market value.

Address: ${address}

SCORING CRITERIA (0-100):
- Location Quality (30 points): Proximity to CBDs, transport, schools, amenities
- Property Type (20 points): House > Townhouse > Unit > Apartment
- Land Size Potential (20 points): Larger land = development potential
- Market Indicators (15 points): Growth area, demand signals
- Development Feasibility (15 points): Zoning, subdivision, granny flat potential

ESTIMATED VALUE CRITERIA:
- Research recent sales in the suburb/street
- Consider property type (house/unit/townhouse)
- Account for land size if mentioned in listing
- Use local market data for that suburb
- Provide realistic Australian market values

OUTPUT FORMAT (JSON):
{
  "score": 75,
  "estimatedValueMin": 850000,
  "estimatedValueMax": 950000,
  "confidence": "Medium"
}

CONFIDENCE LEVELS:
- High: Found recent comparable sales, clear property type
- Medium: Limited sales data, estimated from suburb averages
- Low: Minimal data, rough estimate only

Return ONLY valid JSON, no other text.`;

    const result = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json"
      }
    });
    
    const responseText = result.text?.trim() || '{}';
    let parsedResponse;
    
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (e) {
      console.error('[QuickScore] Failed to parse JSON:', responseText);
      return res.status(500).json({ error: 'Invalid response format' });
    }
    
    const score = parseInt(parsedResponse.score);
    const estimatedValueMin = parseInt(parsedResponse.estimatedValueMin) || null;
    const estimatedValueMax = parseInt(parsedResponse.estimatedValueMax) || null;
    const confidence = parsedResponse.confidence || 'Low';

    if (isNaN(score) || score < 0 || score > 100) {
      console.error('[QuickScore] Invalid score:', parsedResponse);
      return res.status(500).json({ error: 'Invalid score returned' });
    }

    // Calculate estimated value midpoint for display
    const estimatedValue = estimatedValueMin && estimatedValueMax 
      ? Math.round((estimatedValueMin + estimatedValueMax) / 2)
      : null;

    // Cache the score and value
    await supabase
      .from('quick_scores_cache')
      .upsert({
        address_key: addressKey,
        address: address,
        score: score,
        estimated_value: estimatedValue,
        confidence: confidence,
        user_id: user.id,
        cached_at: new Date().toISOString()
      }, {
        onConflict: 'address_key'
      });

    console.log('[QuickScore] Score and value calculated:', { score, estimatedValue, confidence });

    return res.status(200).json({
      score,
      estimatedValue,
      estimatedValueMin,
      estimatedValueMax,
      confidence,
      cached: false,
      address
    });

  } catch (error) {
    console.error('[QuickScore] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to calculate score',
      message: error.message 
    });
  }
}
