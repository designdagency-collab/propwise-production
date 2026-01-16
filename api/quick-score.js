// Lightweight API endpoint for Chrome Extension
// Returns just the Upblock Score (0-100) for a given address
// Much cheaper than full property-insights (2k tokens vs 10k tokens)

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

export default async function handler(req, res) {
  // CORS
  const allowedOrigins = ['https://upblock.ai', 'https://www.upblock.ai', 'http://localhost:5173', 'chrome-extension://*'];
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
      .select('score, cached_at')
      .eq('address_key', addressKey)
      .single();

    if (cachedScore) {
      const cacheAge = Date.now() - new Date(cachedScore.cached_at).getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      
      if (cacheAge < sevenDays) {
        console.log('[QuickScore] Cache hit for:', address);
        return res.status(200).json({
          score: cachedScore.score,
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

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Analyze this Australian property address and return ONLY a numeric score from 0-100 representing its investment potential.

Address: ${address}

SCORING CRITERIA (0-100):
- Location Quality (30 points): Proximity to CBDs, transport, schools, amenities
- Property Type (20 points): House > Townhouse > Unit > Apartment
- Land Size Potential (20 points): Larger land = development potential
- Market Indicators (15 points): Growth area, demand signals
- Development Feasibility (15 points): Zoning, subdivision, granny flat potential

SCORE BRACKETS:
- 80-100: Exceptional investment (prime location, large land, high growth)
- 60-79: Strong investment (good location, development potential)
- 40-59: Average investment (standard property, limited upside)
- 20-39: Below average (poor location or limited potential)
- 0-19: Avoid (unfavorable investment characteristics)

IMPORTANT:
- Return ONLY the numeric score (e.g., "75")
- No explanations, just the number
- Base on address analysis only (suburb, street type, property format)

Score:`;

    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();
    const score = parseInt(response);

    if (isNaN(score) || score < 0 || score > 100) {
      console.error('[QuickScore] Invalid score:', response);
      return res.status(500).json({ error: 'Invalid score returned' });
    }

    // Cache the score
    await supabase
      .from('quick_scores_cache')
      .upsert({
        address_key: addressKey,
        address: address,
        score: score,
        user_id: user.id,
        cached_at: new Date().toISOString()
      }, {
        onConflict: 'address_key'
      });

    console.log('[QuickScore] Score calculated and cached:', score);

    return res.status(200).json({
      score,
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
