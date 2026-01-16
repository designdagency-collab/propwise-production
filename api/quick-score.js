// Lightweight API endpoint for Chrome Extension
// Returns just the Upblock Score (0-100) for a given address
// Uses the SAME scoring logic as the main website for consistency
// Fetches full property-insights data but only returns score + value

import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

// Normalize address for consistent cache keys (MUST match property-insights.js)
function normalizeAddress(address) {
  return address
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')           // collapse multiple spaces
    .replace(/[,\.]/g, '')          // remove punctuation
    .replace(/\s+(nsw|vic|qld|wa|sa|tas|nt|act)\s+/gi, ' $1 '); // normalize state
}

// Calculate Interest Rating (1-5 stars) for quick browsing
// This mimics the Upblock Score components to predict actual investment returns:
// - Value (20%): Price positioning
// - Yield (20%): Rental returns (expensive properties = low yields)
// - Cash Flow (30%): Weekly position (expensive = negative cash flow)
// - Uplift (20%): Development/renovation potential
// - Constraints (10%): Planning restrictions
// Max possible points: 100 (matches Upblock weighting exactly)
// Most properties will score 35-55 points (2-3 stars)
// 5 stars requires 75+ points (very rare - only exceptional investments)
function calculateInterestRating(address, estimatedValue) {
  let points = 0;
  const addressLower = address.toLowerCase();
  
  // DETECT COMBINED LOTS (major development opportunity)
  const isCombinedLot = 
    addressLower.includes(' & ') || 
    addressLower.includes(' and ') ||
    addressLower.match(/\d+-\d+\s/) || // "8-10 Smith St"
    addressLower.match(/\d+\s*&\s*\d+/) || // "8 & 10 Smith St"
    addressLower.includes('combined') ||
    addressLower.includes('dual title');
  
  if (isCombinedLot) {
    console.log('[InterestRating] 🔥 COMBINED LOT DETECTED - development opportunity!');
  }
  
  // Extract suburb info
  const premiumSuburbs = [
    'mosman', 'double bay', 'vaucluse', 'bellevue hill', 'woollahra', 'bondi',
    'toorak', 'brighton', 'south yarra', 'armadale',
    'new farm', 'teneriffe', 'ascot'
  ];
  
  const isPremiumSuburb = premiumSuburbs.some(s => addressLower.includes(s));
  
  // Detect property type
  const isUnit = addressLower.includes('unit') || addressLower.includes('apartment') || addressLower.match(/\/\d+/);
  const isTownhouse = addressLower.includes('townhouse') || addressLower.includes('villa');
  const isHouse = !isUnit && !isTownhouse;
  
  // === 1. VALUE SCORE (~20 points) ===
  // Expensive properties in premium suburbs are typically overpriced (poor value)
  let valueScore = 11; // default (assume fair value)
  if (isPremiumSuburb && estimatedValue && estimatedValue > 2000000) {
    valueScore = 6; // Premium + expensive = overpriced (poor value)
  } else if (estimatedValue && estimatedValue > 1500000) {
    valueScore = 8; // Expensive = likely overpriced
  } else if (estimatedValue && estimatedValue < 800000) {
    valueScore = 15; // Affordable = potentially good value
  }
  points += valueScore;
  
  // === 2. YIELD SCORE (~20 points) ===
  // Expensive properties have LOW yields (rent doesn't scale with price)
  let yieldScore = 10; // default
  if (isUnit) {
    if (estimatedValue && estimatedValue > 800000) {
      yieldScore = 4; // Expensive units = very poor yields
    } else {
      yieldScore = 12; // Affordable units = decent yields
    }
  } else if (isHouse) {
    if (estimatedValue && estimatedValue > 2000000) {
      yieldScore = 3; // $2M+ house = terrible yields (~2-3%)
    } else if (estimatedValue && estimatedValue > 1500000) {
      yieldScore = 6; // $1.5M+ house = poor yields (~3-4%)
    } else if (estimatedValue && estimatedValue > 1000000) {
      yieldScore = 10; // $1M house = OK yields (~4-5%)
    } else {
      yieldScore = 16; // Affordable house = good yields (~5-6%)
    }
  }
  points += yieldScore;
  
  // === 3. CASH FLOW SCORE (~30 points) ===
  // Expensive properties = high mortgages = NEGATIVE cash flow
  let cashFlowScore = 15; // default
  if (estimatedValue && estimatedValue > 2500000) {
    cashFlowScore = 3; // $2.5M+ = very negative cash flow (-$800+/wk)
  } else if (estimatedValue && estimatedValue > 2000000) {
    cashFlowScore = 6; // $2M+ = negative cash flow (-$600/wk)
  } else if (estimatedValue && estimatedValue > 1500000) {
    cashFlowScore = 10; // $1.5M = negative cash flow (-$400/wk)
  } else if (estimatedValue && estimatedValue > 1000000) {
    cashFlowScore = 18; // $1M = slightly negative (-$200/wk)
  } else if (estimatedValue && estimatedValue > 700000) {
    cashFlowScore = 24; // $700k-$1M = neutral to positive
  } else {
    cashFlowScore = 28; // Under $700k = positive cash flow
  }
  points += cashFlowScore;
  
  // === 4. UPLIFT SCORE (~20 points) ===
  let upliftScore = 10; // default
  if (isHouse) {
    upliftScore = 15; // Houses have renovation/development potential
  } else if (isTownhouse) {
    upliftScore = 10; // Some potential
  } else {
    upliftScore = 6; // Units have limited uplift potential
  }
  points += upliftScore;
  
  // === 5. CONSTRAINTS SCORE (~10 points) ===
  let constraintsScore = 8; // default
  if (isPremiumSuburb) {
    constraintsScore = 5; // Premium suburbs = heritage, strict DAs
  } else {
    constraintsScore = 9; // Regular suburbs = fewer constraints
  }
  points += constraintsScore;
  
  // COMBINED LOTS BONUS: Major development opportunity
  if (isCombinedLot) {
    points += 20; // Huge boost for combined lots (uplift + value potential)
    console.log('[InterestRating] 🔥 Applied COMBINED LOTS bonus: +20 points');
  }
  
  // Convert to stars (1-5) - STRICT alignment with Upblock scores
  // Max possible: 100 points (mimics Upblock weighting)
  // Star thresholds match Upblock score ranges:
  let stars = 3; // default
  if (points >= 75) stars = 5;      // 75-100: Upblock 75-100 (exceptional investments)
  else if (points >= 60) stars = 4;  // 60-74: Upblock 60-74 (good investments)
  else if (points >= 40) stars = 3;  // 40-59: Upblock 40-59 (average - MOST COMMON)
  else if (points >= 20) stars = 2;  // 20-39: Upblock 20-39 (below average)
  else stars = 1;                    // 0-19: Upblock 0-19 (poor)
  
  console.log('[InterestRating] 🔍 DETAILED CALCULATION:', {
    address: address.substring(0, 50),
    estimatedValue: estimatedValue ? `$${(estimatedValue/1000).toFixed(0)}k` : 'unknown',
    propertyType: isUnit ? 'Unit' : isTownhouse ? 'Townhouse' : 'House',
    isPremiumSuburb,
    isCombinedLot,
    SCORES: {
      '1_Value': `${valueScore}/20`,
      '2_Yield': `${yieldScore}/20`,
      '3_CashFlow': `${cashFlowScore}/30`,
      '4_Uplift': `${upliftScore}/20`,
      '5_Constraints': `${constraintsScore}/10`
    },
    TOTAL: `${points}/100`,
    STARS: `${stars}/5 (${stars === 5 ? 'LOOK!' : stars === 4 ? 'KEEN' : stars === 3 ? 'MAYBE' : stars === 2 ? 'PASS' : 'NAH'})`,
    predictedUpblockRange: stars === 5 ? '75-100' : stars === 4 ? '60-74' : stars === 3 ? '40-59' : stars === 2 ? '20-39' : '0-19'
  });
  
  return { stars, points };
}

// Helper function to estimate score from full property analysis data
// This uses the same logic as the website's upblockScore.ts for consistency
function estimateScoreFromFullData(data) {
  const WEIGHTS = {
    value: 0.20,
    cashFlow: 0.30,
    yield: 0.20,
    uplift: 0.20,
    constraints: 0.10,
  };

  let scores = {};
  let totalWeight = 0;

  // 1. Value Score (asking price vs estimated value)
  const estimatedValue = data.valueSnapshot?.indicativeMidpoint;
  const askingPrice = data.valueSnapshot?.askingPrice;
  if (estimatedValue && askingPrice) {
    const premiumPct = ((askingPrice - estimatedValue) / estimatedValue) * 100;
    let valueScore = 60; // default
    if (premiumPct >= 40) valueScore = 5;
    else if (premiumPct >= 30) valueScore = 15;
    else if (premiumPct >= 20) valueScore = 30;
    else if (premiumPct >= 10) valueScore = 50;
    else if (premiumPct >= 0) valueScore = 70;
    else if (premiumPct >= -10) valueScore = 85;
    else if (premiumPct >= -20) valueScore = 95;
    else valueScore = 100;
    scores.value = valueScore;
    totalWeight += WEIGHTS.value;
  }

  // 2. Yield Score
  const grossYield = data.rentalPosition?.grossYieldPercent;
  if (grossYield !== undefined) {
    let yieldScore = 55; // default
    if (grossYield < 2) yieldScore = 10;
    else if (grossYield < 3) yieldScore = 30;
    else if (grossYield < 4) yieldScore = 55;
    else if (grossYield < 5) yieldScore = 75;
    else if (grossYield < 6) yieldScore = 88;
    else yieldScore = 95;
    scores.yield = yieldScore;
    totalWeight += WEIGHTS.yield;
  }

  // 3. Cash Flow Score
  const cashFlowWeekly = data.rentalPosition?.estimatedCashPositionWeekly;
  if (cashFlowWeekly !== undefined) {
    let cfScore = 55; // default
    if (cashFlowWeekly >= 200) cfScore = 95;
    else if (cashFlowWeekly >= 50) cfScore = 80;
    else if (cashFlowWeekly >= -49) cfScore = 65;
    else if (cashFlowWeekly >= -199) cfScore = 40;
    else if (cashFlowWeekly >= -499) cfScore = 20;
    else cfScore = 10;
    scores.cashFlow = cfScore;
    totalWeight += WEIGHTS.cashFlow;
  }

  // 4. Uplift Score (from development scenarios or value-add)
  let upliftScore = 55; // default
  if (data.developmentScenarios && data.developmentScenarios.length > 0) {
    const profits = data.developmentScenarios.map(s => s.estimatedNetProfit).filter(Boolean);
    if (profits.length > 0 && estimatedValue) {
      const avgProfit = profits.reduce((sum, p) => sum + ((p.low || 0) + (p.high || 0)) / 2, 0) / profits.length;
      const upliftPct = (avgProfit / estimatedValue) * 100;
      if (upliftPct <= 0) upliftScore = 35;
      else if (upliftPct <= 5) upliftScore = 55;
      else if (upliftPct <= 10) upliftScore = 70;
      else if (upliftPct <= 20) upliftScore = 85;
      else upliftScore = 95;
    }
  } else if (data.valueAddStrategies && data.valueAddStrategies.length > 0) {
    const uplifts = data.valueAddStrategies.map(s => s.estimatedUplift || s.saleProfitEstimate).filter(Boolean);
    if (uplifts.length > 0 && estimatedValue) {
      const avgUplift = uplifts.reduce((sum, u) => sum + ((u.low || 0) + (u.high || 0)) / 2, 0) / uplifts.length;
      const upliftPct = (avgUplift / estimatedValue) * 100;
      if (upliftPct <= 0) upliftScore = 35;
      else if (upliftPct <= 5) upliftScore = 55;
      else if (upliftPct <= 10) upliftScore = 70;
      else if (upliftPct <= 20) upliftScore = 85;
      else upliftScore = 95;
    }
  }
  
  // ALWAYS add uplift score (either calculated or default)
  scores.uplift = upliftScore;
  totalWeight += WEIGHTS.uplift;

  // 5. Constraints Score
  let constraintsScore = 60; // default unknown
  if (data.watchOuts && data.watchOuts.length > 0) {
    let penalty = 0;
    for (const w of data.watchOuts) {
      if (w.severity === 'Critical') penalty += 22;
      else if (w.severity === 'Warning') penalty += 12;
      else penalty += 6;
    }
    constraintsScore = Math.max(0, Math.min(100, 100 - penalty));
  }
  
  // ALWAYS add constraints score
  scores.constraints = constraintsScore;
  totalWeight += WEIGHTS.constraints;

  // Calculate weighted average
  let weightedScore = 0;
  if (scores.value !== undefined) weightedScore += scores.value * WEIGHTS.value;
  if (scores.yield !== undefined) weightedScore += scores.yield * WEIGHTS.yield;
  if (scores.cashFlow !== undefined) weightedScore += scores.cashFlow * WEIGHTS.cashFlow;
  if (scores.uplift !== undefined) weightedScore += scores.uplift * WEIGHTS.uplift;
  if (scores.constraints !== undefined) weightedScore += scores.constraints * WEIGHTS.constraints;

  // If we don't have enough data, use defaults for missing components
  if (totalWeight < 1.0) {
    const missingWeight = 1.0 - totalWeight;
    weightedScore += 55 * missingWeight; // neutral score for missing data
  }

  const finalScore = Math.round(weightedScore);
  
  // Debug logging
  console.log('[QuickScore] Score calculation breakdown:', {
    scores,
    totalWeight,
    weightedScore,
    finalScore,
    hasValue: scores.value !== undefined,
    hasYield: scores.yield !== undefined,
    hasCashFlow: scores.cashFlow !== undefined,
    hasUplift: scores.uplift !== undefined,
    hasConstraints: scores.constraints !== undefined
  });

  return finalScore;
}

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

  const { address, comparables } = req.body;

  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }

  // Normalize address for cache key (MUST match property-insights.js)
  const addressKey = normalizeAddress(address);
  console.log('[QuickScore] Address normalization:', { original: address, normalized: addressKey });
  
  // Log comparables if provided
  if (comparables && comparables.length > 0) {
    const avgComp = Math.round(comparables.reduce((a, b) => a + b, 0) / comparables.length);
    const minComp = Math.min(...comparables);
    const maxComp = Math.max(...comparables);
    console.log('[QuickScore] Page comparables:', { count: comparables.length, min: minComp, max: maxComp, avg: avgComp });
  }

  try {
    // FIRST: Check if we have full property-insights data from property_cache
    // (This is the same data the website uses for scoring)
    const { data: fullAnalysis } = await supabase
      .from('property_cache')
      .select('data, created_at')
      .eq('address_key', addressKey)
      .single();

    if (fullAnalysis?.data) {
      const cacheAge = Date.now() - new Date(fullAnalysis.created_at).getTime();
      const twoWeeks = 14 * 24 * 60 * 60 * 1000;
      
      // If we have recent full analysis data, use that score (CONSISTENT WITH WEBSITE)
      if (cacheAge < twoWeeks) {
        const data = fullAnalysis.data;
        const estimatedValue = data.valueSnapshot?.indicativeMidpoint;
        
        // Calculate score using the SAME logic as the website
        console.log('[QuickScore] Using full analysis data for:', address);
        console.log('[QuickScore] Property data:', {
          hasValueSnapshot: !!data.valueSnapshot,
          hasRentalPosition: !!data.rentalPosition,
          hasDevelopmentScenarios: !!data.developmentScenarios,
          hasValueAddStrategies: !!data.valueAddStrategies,
          hasWatchOuts: !!data.watchOuts,
          askingPrice: data.valueSnapshot?.askingPrice,
          indicativeMidpoint: data.valueSnapshot?.indicativeMidpoint,
          grossYield: data.rentalPosition?.grossYieldPercent,
          cashFlow: data.rentalPosition?.estimatedCashPositionWeekly
        });
        
        const score = estimateScoreFromFullData(data);
        
        // Calculate interest rating from the true score - STRICT alignment
        // This ensures stars match actual Upblock scores within ±25%
        let interestStars = 3;
        if (score >= 75) interestStars = 5;       // 75-100: Exceptional (rare)
        else if (score >= 60) interestStars = 4;  // 60-74: Good investment
        else if (score >= 40) interestStars = 3;  // 40-59: Average (most common)
        else if (score >= 20) interestStars = 2;  // 20-39: Below average
        else interestStars = 1;                   // 0-19: Poor
        
        // Detect combined lot
        const isCombinedLot = 
          address.toLowerCase().includes(' & ') || 
          address.toLowerCase().includes(' and ') ||
          address.match(/\d+-\d+\s/) ||
          address.match(/\d+\s*&\s*\d+/);
        
        console.log('[QuickScore] Final score from full_analysis:', score, 'Interest stars:', interestStars, 'Combined lot:', isCombinedLot);
        
        return res.status(200).json({
          score: score,
          interestStars: interestStars,
          isCombinedLot,
          estimatedValue: estimatedValue,
          confidence: data.dataConfidence?.overall || 'High',
          cached: true,
          address,
          source: 'full_analysis',
          verified: true
        });
      }
    }

    // SECOND: Check quick_scores_cache (AI-generated scores)
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
        
        // Calculate interest rating from cached data
        const interestRating = calculateInterestRating(address, cachedScore.estimated_value);
        
        // Detect combined lot
        const isCombinedLot = 
          address.toLowerCase().includes(' & ') || 
          address.toLowerCase().includes(' and ') ||
          address.match(/\d+-\d+\s/) ||
          address.match(/\d+\s*&\s*\d+/);
        
        return res.status(200).json({
          score: cachedScore.score,
          interestStars: interestRating.stars,
          interestPoints: interestRating.points,
          isCombinedLot,
          estimatedValue: cachedScore.estimated_value,
          confidence: cachedScore.confidence,
          cached: true,
          address,
          source: 'ai_estimate'
        });
      }
    }

    // Calculate score using Gemini
    console.log('[QuickScore] Calculating score for:', address);
    
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    
    // Build comparables context if available
    let comparablesContext = '';
    if (comparables && comparables.length > 0) {
      const avgComp = Math.round(comparables.reduce((a, b) => a + b, 0) / comparables.length);
      const minComp = Math.min(...comparables);
      const maxComp = Math.max(...comparables);
      const sortedComps = [...comparables].sort((a, b) => a - b);
      const medianComp = sortedComps[Math.floor(sortedComps.length / 2)];
      
      comparablesContext = `
🏘️ COMPARABLE PROPERTIES ON THE SAME SEARCH PAGE (CRITICAL CONTEXT):
The user is viewing this property alongside ${comparables.length} other listings in the same area/search.
These are the ACTUAL ASKING PRICES of properties currently on the market:

Min: $${minComp.toLocaleString()}
Max: $${maxComp.toLocaleString()}
Average: $${avgComp.toLocaleString()}
Median: $${medianComp.toLocaleString()}

⚠️ CRITICAL: Your estimate MUST be in line with these comparables.
- If most properties are $2M-$3M, this property is likely in that range too
- If most properties are $500k-$800k, estimate accordingly
- DO NOT estimate $800k if everything else on the page is $2M+
- DO NOT estimate $2.5M if everything else is $600k-$800k

Use these comparables as your PRIMARY reference point for estimation.
`;
    }

    const prompt = `Estimate the market value for this Australian property. BE CONSERVATIVE.

Address: ${address}
${comparablesContext}
🎯 CRITICAL INSTRUCTIONS FOR ACCURATE VALUATION:

STEP 1: USE THE PROVIDED COMPARABLES (IF AVAILABLE)
${comparables && comparables.length > 0 ? `
✅ You have been given ${comparables.length} comparable properties from the SAME search page.
✅ These are ACTUAL current listings in the same area/price range.
✅ Use these as your PRIMARY reference - they are the most accurate data available.
✅ Your estimate should fall within or near this range.
` : `
⚠️ No comparables provided - you'll need to research the suburb.
`}

STEP 2: IDENTIFY KEY FEATURES FROM ADDRESS
From the address alone, determine:
- Is this a HOUSE (typical street address) or UNIT (has "/" or "Unit" in address)?
- Suburb name and state
- Approximate location quality (research the suburb if needed)

STEP 3: REFINE YOUR ESTIMATE
Base your estimate on:
1. PROVIDED COMPARABLES (if available) ← MOST IMPORTANT
2. Recent sold prices in that suburb for similar property types
3. Current market listings in that area (NOT YOUR GUESS)
4. Median prices for that suburb from realestate.com.au data

🚨 BE CONSERVATIVE - DO NOT OVERESTIMATE:
${comparables && comparables.length > 0 ? `
- The comparables show a range of $${Math.min(...comparables).toLocaleString()} - $${Math.max(...comparables).toLocaleString()}
- Your estimate MUST be within or close to this range
- If comparables average $2.5M, estimate $2.3M-$2.7M (realistic range)
- If comparables average $650k, estimate $600k-$700k (don't guess $2M)
` : `
- If you find sales at $800k-$900k → estimate in that range
- DO NOT estimate $2.4M if similar properties sold for $800k
- If minimal data, estimate LOW rather than high
`}
- It's better to underestimate than create false expectations

EXAMPLE LOGIC WITH COMPARABLES:
If comparables show: $2.5M, $2.6M, $2.8M, $2.7M (average: $2.65M)
AND the property is a similar house in Castle Hill
→ Your estimate should be $2.5M-$2.8M (use the comparables!)

EXAMPLE WITHOUT COMPARABLES:
If searching "Harristown QLD house sold prices" shows:
- 3 bed house sold $550k (2023)
- 4 bed house sold $620k (2023)
→ Your estimate should be $550k-$620k (use the ACTUAL DATA)

DO NOT:
- Ignore the provided comparables data
- Estimate $850k when comparables show $2.5M-$2.8M
- Make wild guesses without checking the data
- Estimate $2M+ for properties in suburbs where houses sell for $500k-$800k

ESTIMATED VALUE CRITERIA:
✅ Research ACTUAL recent sales in the suburb
✅ Use realestate.com.au sold data
✅ Match property type (house/unit/townhouse)
✅ Be CONSERVATIVE - round DOWN not up
✅ Use local market reality, not optimistic projections

OUTPUT FORMAT (JSON):
{
  "score": 65,
  "estimatedValueMin": 520000,
  "estimatedValueMax": 620000,
  "confidence": "Medium"
}

CONFIDENCE LEVELS:
- High: Found 3+ recent comparable sales, clear property type
- Medium: Found 1-2 sales data, estimated from suburb averages
- Low: Minimal data, rough estimate based on suburb median

Return ONLY valid JSON, no other text.`;

    console.log('[QuickScore] Calling AI with comparables context:', comparables ? `${comparables.length} prices` : 'none');
    
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

    // Calculate Interest Rating (1-5 stars)
    const interestRating = calculateInterestRating(address, estimatedValue);
    
    // Detect if combined lot for special messaging
    const isCombinedLot = 
      address.toLowerCase().includes(' & ') || 
      address.toLowerCase().includes(' and ') ||
      address.match(/\d+-\d+\s/) ||
      address.match(/\d+\s*&\s*\d+/);
    
    console.log('[QuickScore] AI estimate calculated:', { score, estimatedValue, confidence, interestRating, isCombinedLot });
    console.log('[QuickScore] ⚠️ Using AI estimate - for accurate score, do full audit on website');

    return res.status(200).json({
      score,
      interestStars: interestRating.stars,
      interestPoints: interestRating.points,
      isCombinedLot,
      estimatedValue,
      estimatedValueMin,
      estimatedValueMax,
      confidence,
      cached: false,
      address,
      source: 'ai_estimate',
      note: 'Interest rating for browsing - visit upblock.ai for full Upblock Score'
    });

  } catch (error) {
    console.error('[QuickScore] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to calculate score',
      message: error.message 
    });
  }
}
