// Server-side Gemini API calls - API key is NEVER exposed to client
import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for caching
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Cache TTL: 2 weeks in milliseconds
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

// Normalize address for consistent cache keys
function normalizeAddress(address) {
  return address
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')           // collapse multiple spaces
    .replace(/[,\.]/g, '')          // remove punctuation
    .replace(/\s+(nsw|vic|qld|wa|sa|tas|nt|act)\s+/gi, ' $1 '); // normalize state
}

// Response schema for Gemini (matching the TypeScript types)
const responseSchema = {
  type: "OBJECT",
  properties: {
    address: { type: "STRING" },
    propertyType: { type: "STRING", enum: ['House', 'Apartment / Unit', 'Townhouse', 'Villa', 'Duplex', 'Land', 'Rural', 'Commercial', 'Unknown'] },
    landSize: { type: "STRING" },
    isCombinedLots: { type: "BOOLEAN" },
    attributes: {
      type: "OBJECT",
      properties: {
        beds: { type: "INTEGER" },
        baths: { type: "INTEGER" },
        cars: { type: "INTEGER" }
      }
    },
    sitePlan: {
      type: "OBJECT",
      properties: {
        width: { type: "STRING" },
        depth: { type: "STRING" },
        frontage: { type: "STRING" },
        siteCoverage: { type: "STRING" },
        setbacks: {
          type: "OBJECT",
          properties: { front: { type: "STRING" }, side: { type: "STRING" }, rear: { type: "STRING" } }
        }
      }
    },
    zoning: {
      type: "OBJECT",
      properties: {
        code: { type: "STRING" },
        title: { type: "STRING" },
        description: { type: "STRING" }
      }
    },
    proximity: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          distance: { type: "STRING" },
          type: { type: "STRING", enum: ['transport', 'shopping', 'education', 'leisure'] }
        }
      }
    },
    valueSnapshot: {
      type: "OBJECT",
      properties: {
        estimateMin: { type: "NUMBER" },
        estimateMax: { type: "NUMBER" },
        indicativeMidpoint: { type: "NUMBER" },
        askingPrice: { type: "NUMBER" },
        askingPriceSource: { type: "STRING" },
        yield: { type: "STRING" },
        growth: { type: "STRING" },
        confidenceLevel: { type: "STRING", enum: ['High', 'Medium', 'Low'] }
      }
    },
    rentalPosition: {
      type: "OBJECT",
      properties: {
        estimatedWeeklyRent: { type: "NUMBER" },
        estimatedAnnualRent: { type: "NUMBER" },
        grossYieldPercent: { type: "NUMBER" },
        estimatedCashPositionWeekly: { type: "NUMBER" },
        gearingStatus: { type: "STRING", enum: ['Positively Geared', 'Negatively Geared', 'Neutral'] }
      }
    },
    approvalPathway: {
      type: "OBJECT",
      properties: {
        likelyPathway: { type: "STRING", enum: ['Exempt', 'CDC', 'DA', 'Mixed/Depends', 'Unknown'] },
        explanation: { type: "STRING" },
        estimatedApprovalTimeWeeks: {
          type: "OBJECT",
          properties: { low: { type: "NUMBER" }, high: { type: "NUMBER" } }
        }
      }
    },
    zoningIntel: {
      type: "OBJECT",
      properties: {
        currentZoneCode: { type: "STRING" },
        currentZoneTitle: { type: "STRING" },
        whatItMeans: { type: "STRING" }
      }
    },
    comparableSales: {
      type: "OBJECT",
      properties: {
        nearbySales: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              addressShort: { type: "STRING" },
              date: { type: "STRING" },
              price: { type: "NUMBER" },
              distanceKm: { type: "NUMBER" },
              status: { type: "STRING", enum: ['SOLD', 'SETTLED'] },
              notes: { type: "STRING" }
            }
          }
        },
        pricingContextSummary: { type: "STRING" }
      }
    },
    valueAddStrategies: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          description: { type: "STRING" },
          effort: { type: "STRING" },
          planningPathway: { type: "STRING", enum: ['Exempt', 'CDC', 'DA', 'Unknown'] },
          estimatedCost: { type: "OBJECT", properties: { low: { type: "NUMBER" }, high: { type: "NUMBER" } } },
          estimatedUplift: { type: "OBJECT", properties: { low: { type: "NUMBER" }, high: { type: "NUMBER" } } }
        }
      }
    },
    developmentScenarios: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          scenarioType: { type: "STRING", enum: ['Knockdown', 'Duplex', 'Townhouse'] },
          eligibility: { type: "STRING", enum: ['Allowed', 'Likely', 'Uncertain', 'Not Allowed'] },
          planningPathway: { type: "STRING", enum: ['Exempt', 'CDC', 'DA', 'Unknown'] },
          description: { type: "STRING" },
          whyAllowedOrNot: { type: "STRING" },
          estimatedCost: { type: "OBJECT", properties: { low: { type: "NUMBER" }, high: { type: "NUMBER" } } },
          estimatedNetProfit: { type: "OBJECT", properties: { low: { type: "NUMBER" }, high: { type: "NUMBER" } } }
        }
      }
    },
    frontageAssessment: {
      type: "OBJECT",
      properties: {
        frontageMeters: { type: "NUMBER" },
        frontageSource: { type: "STRING", enum: ['Measured', 'From Plan', 'Estimated', 'Unknown'] },
        confidence: { type: "STRING", enum: ['High', 'Medium', 'Low'] },
        lotAreaSqm: { type: "NUMBER" },
        intendedOutcome: { type: "STRING", enum: ['Duplex', '3 Townhouses', '4+ Townhouses', 'Terraces', 'Not Assessed'] },
        localRuleFound: { type: "BOOLEAN" },
        localRuleDetails: { type: "STRING" },
        minimumRequiredMeters: { type: "NUMBER" },
        recommendedWidthMeters: { type: "NUMBER" },
        result: { type: "STRING", enum: ['GREEN', 'AMBER', 'RED', 'UNKNOWN'] },
        resultExplanation: { type: "STRING" },
        frontageScore: { type: "NUMBER" },
        modifiers: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              factor: { type: "STRING" },
              adjustment: { type: "NUMBER" }
            }
          }
        },
        nextAction: { type: "STRING" },
        isCornerBlock: { type: "BOOLEAN" },
        isBattleAxe: { type: "BOOLEAN" },
        accessConstraints: { type: "STRING" }
      }
    },
    portfolioSelloutSummary: {
      type: "OBJECT",
      properties: {
        bestStrategyByProfit: { type: "STRING" },
        estimatedNetProfitRange: { type: "OBJECT", properties: { low: { type: "NUMBER" }, high: { type: "NUMBER" } } },
        selloutExplanation: { type: "STRING" }
      }
    },
    watchOuts: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          description: { type: "STRING" },
          severity: { type: "STRING" }
        }
      }
    },
    localAreaIntel: {
      type: "OBJECT",
      properties: {
        schools: {
          type: "OBJECT",
          properties: {
            primary: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING" },
                  distanceKm: { type: "NUMBER" }
                }
              }
            },
            secondary: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING" },
                  distanceKm: { type: "NUMBER" }
                }
              }
            }
          }
        },
        transport: {
          type: "OBJECT",
          properties: {
            trainStations: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING" },
                  distanceKm: { type: "NUMBER" },
                  typicalTravelTimeToCBD: { type: "STRING" }
                }
              }
            },
            busStops: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING" },
                  distanceKm: { type: "NUMBER" }
                }
              }
            }
          }
        },
        lifestyleSummary: { type: "STRING" }
      }
    },
    localMarketVibe: { type: "STRING" },
    sharePrompt: {
      type: "OBJECT",
      properties: { message: { type: "STRING" } }
    }
  },
  required: ["address", "attributes", "proximity", "valueSnapshot", "approvalPathway", "zoningIntel", "comparableSales", "valueAddStrategies", "portfolioSelloutSummary", "watchOuts", "sharePrompt", "rentalPosition"]
};

export default async function handler(req, res) {
  // CORS - restrict to our domain only
  const allowedOrigins = ['https://upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address, forceRefresh } = req.body;

  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }

  // Normalize address for cache lookup
  const addressKey = normalizeAddress(address);
  
  // Check cache first (if Supabase is configured and not forcing refresh)
  if (supabaseUrl && supabaseServiceKey && !forceRefresh) {
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const twoWeeksAgo = new Date(Date.now() - CACHE_TTL_MS).toISOString();
      
      const { data: cached, error: cacheError } = await supabase
        .from('property_cache')
        .select('data, created_at')
        .eq('address_key', addressKey)
        .gte('created_at', twoWeeksAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (cached && !cacheError) {
        console.log('[PropertyInsights] Cache HIT for:', addressKey.substring(0, 40) + '...');
        return res.status(200).json({ data: cached.data, cached: true });
      }
      
      if (cacheError) {
        console.warn('[PropertyInsights] Cache lookup error (continuing without cache):', cacheError.message);
      } else {
        console.log('[PropertyInsights] Cache MISS for:', addressKey.substring(0, 40) + '...');
      }
    } catch (cacheErr) {
      console.warn('[PropertyInsights] Cache check failed (continuing without cache):', cacheErr.message);
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('[PropertyInsights] GEMINI_API_KEY not configured');
    return res.status(500).json({ error: 'AI service not configured' });
  }

  console.log('[PropertyInsights] Fetching insights for:', address.substring(0, 40) + '...', forceRefresh ? '(DATA CORRECTION MODE)' : '');

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Data correction instructions when user triggers refresh
    const dataCorrectionInstructions = forceRefresh ? `
🔄 DATA CORRECTION MODE - USER REQUESTED REFRESH
The user has indicated the previous data may be INCORRECT. Pay EXTRA attention to:

1. PROPERTY TYPE VERIFICATION (Land vs House+Land):
   - Is this VACANT LAND ONLY or does it have a DWELLING?
   - Check satellite imagery for existing structures
   - If listing says "land" or shows no dwelling, set propertyType to "Vacant Land"
   - If there's a house on the land, include BOTH land AND dwelling value

2. ADDRESS INTERPRETATION (Unit/Lot Numbers):
   - "8-26 Fortune St" could mean: Unit 8 at 26 Fortune St, OR property spanning 8-26 Fortune St
   - "26/8 Smith Rd" means Unit 26 at 8 Smith Rd
   - "8/26 Smith Rd" means Unit 8 at 26 Smith Rd
   - VERIFY the correct interpretation from actual listings
   - If uncertain, search BOTH interpretations and use the one with actual listing data

3. BEDROOM/BATHROOM/GARAGE VERIFICATION:
   - DO NOT assume or estimate - ONLY use data from ACTUAL LISTINGS
   - Cross-reference realestate.com.au AND domain.com.au
   - If listings show different counts, use the most recent/detailed listing
   - If no listing data available, set beds/baths/cars to 0 and confidenceLevel to "Low"

4. LAND SIZE VERIFICATION:
   - Get land size from council records or actual listings
   - For units/apartments, land size should be the LOT size, not building footprint
   - If land-only, ensure estimate reflects LAND value only, not house+land

⚠️ ACCURACY IS CRITICAL - Previous data was flagged as potentially incorrect.

` : '';

    const prompt = `You are a professional Australian property planning analyst and prop-tech engineer for upblock.ai.
Your task is to generate a structured Property DNA report for: "${address}".
${dataCorrectionInstructions}

⚠️ MANDATORY FIRST STEP - ZONING & PROPERTY TYPE VERIFICATION:
Before generating ANY data, you MUST search and verify:

1. SEARCH FOR ZONING CODE FIRST (from council planning maps, NSW Planning Portal, or similar):
   - R1, R2, R3, R4, R5, RU1-RU5 = RESIDENTIAL zones → Could be House, Apartment, Townhouse
   - B1, B2, B3, B4, B5, B6, B7 = BUSINESS/COMMERCIAL zones → Property type = "Commercial"
   - IN1, IN2, IN3, IN4 = INDUSTRIAL zones → Property type = "Commercial"
   - SP1, SP2 = Special Purpose → Usually "Commercial" or check specific use
   - If zoning is Business or Industrial, the property is COMMERCIAL, regardless of what it looks like.

2. PROPERTY TYPE DETECTION RULES (in order of priority):
   a) CHECK ZONING FIRST - Commercial/Industrial zone = "Commercial" property type
   b) Search for business names at this address - if businesses operate there = "Commercial"
   c) Check Google Maps/satellite - warehouses, factories, retail shops, offices = "Commercial"
   d) Large flat-roof buildings, loading docks, no residential features = "Commercial"
   e) Unit notation (1/30, Unit 5, Apt 3) = "Apartment / Unit"
   f) Only mark as "House" if you can CONFIRM it's a standalone residential dwelling in a residential zone

3. RESIDENTIAL VERIFICATION (only if zoning is R1-R5):
   - Verify from real estate listings (Domain, realestate.com.au)
   - Check bed/bath/car counts from actual listings
   - Cross-reference land size
   - Houses = standalone, typically 300sqm+ land
   - Apartments = strata title, typically 0-100sqm land or "N/A"

4. WHEN UNCERTAIN:
   - Use "Commercial" if in business/industrial zone OR if property appears commercial
   - Use "Unknown" if you cannot verify residential property type
   - NEVER default to "House" without verification

5. COMBINED/AMALGAMATED LOTS DETECTION (CRITICAL - CROSS-REFERENCE LISTINGS):
   When searching for this property on realestate.com.au or Domain:
   
   ⚠️ IMPORTANT: The user may enter "2 Grace Avenue" but the ACTUAL listing might be for "2-4 Grace Avenue" or "2 & 4 Grace Avenue" (combined lots). You MUST check:
   
   a) LISTING TITLE CHECK: Does the listing title include MULTIPLE street numbers?
      - User searched: "2 Grace Avenue"
      - Actual listing: "2-4 Grace Avenue" or "2 & 4 Grace Avenue" → THIS IS COMBINED LOTS
      - Look for patterns like "2-4", "2 & 4", "2, 4", "Lots 1 & 2"
   
   b) LISTING DESCRIPTION CHECK: Does it mention:
      - "combined lots", "amalgamated", "dual blocks", "two titles", "multiple lots"
      - "sold together", "both properties", "development site"
      - "combined area", "total land"
   
   c) LAND SIZE CHECK: Is the land size LARGER than typical for one house?
      - If listing shows 1,000sqm+ in suburban area, likely combined lots
      - Cross-reference: typical house lot in that suburb is 600-800sqm
   
   d) IF COMBINED LOTS DETECTED:
      - Set isCombinedLots = true
      - Use the COMBINED land area from the listing (e.g., 1,443sqm not 715sqm)
      - Update the address to reflect the combined lots (e.g., "2-4 Grace Avenue")
      - Emphasise development potential in your analysis
      - MUST populate developmentScenarios with at least 1-2 viable development options
      - If recommending development as bestStrategyByProfit, ensure that EXACT scenario is in developmentScenarios

FOCUS: Value Uplift, Renovation Feasibility, Development Potential, Comparable Sales, Rental Yield, and Local Amenities.

⚠️ CRITICAL: ASKING PRICE CAPTURE
When analyzing a property from realestate.com.au or Domain:
- ALWAYS try to extract the current asking price or price guide from the listing
- Set valueSnapshot.askingPrice to the numeric asking price (use midpoint if range, e.g., "$1.2M-$1.3M" → 1250000)
- Set valueSnapshot.askingPriceSource to describe where price came from (e.g., "realestate.com.au listing", "Domain price guide", "Auction guide")
- If no asking price found (e.g., "Contact Agent", "Price on Application"), leave askingPrice undefined
- This is used to calculate deal quality: if asking price is significantly above estimated value, the property is overpriced

MANDATORY MODULES:

1. VALUE-ADD STRATEGIES
- Return 5–8 strategies (internal/renovation focused).

2. DEVELOPMENT SCENARIOS (CRITICAL FOR COMBINED LOTS & LARGE SITES)
- Analyze up to 3 scenarios: Knockdown Rebuild, Duplex, and Townhouse/Multi-dwelling.
- Provide indicative costs, estimated end value (GRV), net profit, and timeframe.
- ⚠️ IMPORTANT: If any development scenario is recommended as bestStrategyByProfit, that EXACT scenario title MUST appear here with full details.
- Reference frontageAssessment result when determining eligibility for multi-dwelling outcomes.

3. FRONTAGE ASSESSMENT (CRITICAL FOR TOWNHOUSE/DUPLEX FEASIBILITY)
Assess the site's lot width/frontage for development potential:

A) DETERMINE PROPERTY CONTEXT:
   - State (NSW/VIC/QLD/SA/WA/TAS/ACT/NT)
   - Council/LGA
   - Zoning + overlays (heritage, flood, bushfire, coastal)
   - Proposed development intent: Duplex / 3 TH / 4+ TH / Terraces
   - Site geometry: lot area (m²), frontage (m), corner block (Y/N), access constraints

B) FIND FRONTAGE DATA (priority order):
   1) Council GIS / property mapping with frontage dimensions
   2) Title plan / deposited plan references
   3) Real estate listing floorplan/site plan with dimensions
   4) Estimate from satellite/parcel map (label as "Estimated")
   If unknown: set frontageSource = "Unknown", confidence = "Low", cap frontageScore at 55

C) LOCAL PLANNING CONFIRMATION:
   Search for "[Council] DCP minimum lot width dual occupancy/multi-dwelling"
   Extract: minimum lot width/frontage, measurement method, specific rules

D) SCREENING HEURISTICS (Australian rule-of-thumb):
   - Duplex (2 dwellings): Likely min ~12–15m, Recommended ~16–18m
   - 3 Townhouses: Likely min ~15–18m, Recommended ~18–20m
   - 4+ Townhouses/Terraces: Likely min ~18–21m, Recommended ~20–24m

E) RESULT CLASSIFICATION:
   - GREEN: meets recommended or clearly meets local minimum with buffer
   - AMBER: meets rough minimum but tight / design risk / needs planner check
   - RED: below likely minimum or conflicts with confirmed local rule
   - UNKNOWN: frontage data not available

F) FRONTAGE SCORE (0–100):
   Start at 100, then:
   - If width unknown: cap at 55, add "Needs plan" flag
   - If below likely minimum: 0–30 based on how far below
   - If meets minimum but not recommended: 50–75
   - If meets recommended: 80–95
   - If exceeds recommended + strong access: 95–100
   MODIFIERS:
   +10 if corner block with easy access
   -10 to -25 if battle-axe / constrained access / easements restrict driveway
   -10 if strict heritage/streetscape controls limit outcomes

G) NEXT ACTION:
   Set one of: "Proceed to concept design" / "Planner check needed" / "Obtain title plan" / "Not suitable for multi-dwelling"

4. INDICATIVE RENTAL & YIELD POSITION
- Estimate weekly rent based on comparable rentals in the area (estimatedWeeklyRent).
- Calculate annual rent (estimatedAnnualRent = weekly × 52).
- Calculate gross yield percent (grossYieldPercent = annualRent / indicativeMidpoint × 100).
- Assume an investment loan of 80% LVR against indicativeMidpoint Value.
- Use Australian interest rates (~6.3%) for P&I 30yr loan.
- Calculate weekly cash position (estimatedCashPositionWeekly = weekly rent - weekly mortgage).
- Set gearingStatus: 'Positively Geared' if cash position > 0, 'Negatively Geared' if < 0, 'Neutral' if ~0.

5. LOCAL AREA INTEL, APPROVAL PATHWAY & ZONING INTEL.
- Include schools and key public transport (trains/buses).

6. COMPARABLE SALES (CRITICAL - SOLD ONLY)
⚠️ ONLY return RECENTLY SOLD properties as comparables. Do NOT include:
- Active listings (for sale, coming soon, expressions of interest)
- Under offer / under contract properties
- Price guide / auction listings without a sold result
- Withdrawn or expired listings

For each comparable sale:
- Must have an actual SOLD DATE (when it settled/sold)
- Must have an actual SALE PRICE (what it sold for, not asking price)
- Should be within 18 months of today's date
- Should be within 2km of the subject property
- Prefer similar property types (houses with houses, units with units)

If you cannot find verified sold comparables, return an empty array rather than including active listings.

RULES:
- LISTING ADDRESS is king: If user searches "2 Grace Ave" but listing is "2-4 Grace Ave", use "2-4 Grace Ave" and treat as combined lots.
- Always use data from the ACTUAL listing found, not assumptions based on search input.
- Output ONLY valid JSON. No markdown blocks.

⚠️ BEST STRATEGY CONSISTENCY (CRITICAL):
- portfolioSelloutSummary.bestStrategyByProfit MUST reference an EXISTING strategy.
- If best strategy is a development type (Knockdown Rebuild, Duplex, Townhouse, Subdivision, etc.):
  → The EXACT title MUST appear in developmentScenarios array with full details (costs, profit, eligibility).
- If best strategy is a renovation/value-add (e.g., "Kitchen & Bathroom Renovation"):
  → The EXACT title MUST appear in valueAddStrategies array.
- For combined lots: developmentScenarios should NOT be empty. Include at least the recommended development option.`;

    console.log('[PropertyInsights] Calling Gemini API with model gemini-3-flash-preview...');
    
    // Use EXACT original format that was working
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 2048 },
        responseMimeType: "application/json",
        responseSchema: responseSchema
      },
    });

    console.log('[PropertyInsights] Got response, extracting text...');

    let text = response.text || '';
    console.log('[PropertyInsights] Raw text length:', text.length);
    
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    if (!text) {
      console.error('[PropertyInsights] Empty response from Gemini');
      return res.status(500).json({ error: 'Empty response from AI service' });
    }
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('[PropertyInsights] JSON parse error:', parseError.message);
      console.error('[PropertyInsights] Raw text (first 500 chars):', text.substring(0, 500));
      return res.status(500).json({ error: 'Invalid response format from AI service' });
    }
    
    // Extract sources from grounding metadata if available
    const sources = [];
    const candidates = response.candidates;
    if (candidates?.[0]?.groundingMetadata?.groundingChunks) {
      candidates[0].groundingMetadata.groundingChunks.forEach((chunk) => {
        if (chunk.web) {
          sources.push({ title: chunk.web.title || "Market Source", url: chunk.web.uri });
        }
      });
    }
    data.sources = sources;

    console.log('[PropertyInsights] Success for:', address.substring(0, 40) + '...');
    
    // Save to cache (non-blocking, don't fail if cache save fails)
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from('property_cache')
          .upsert({
            address_key: addressKey,
            data: data,
            created_at: new Date().toISOString()
          }, { onConflict: 'address_key' });
        console.log('[PropertyInsights] Cached result for:', addressKey.substring(0, 40) + '...');
      } catch (cacheErr) {
        console.warn('[PropertyInsights] Failed to cache result:', cacheErr.message);
      }
    }
    
    return res.status(200).json({ data });
  } catch (error) {
    console.error('[PropertyInsights] Error:', error.message || error);
    console.error('[PropertyInsights] Stack:', error.stack);
    return res.status(500).json({ error: 'Failed to fetch property insights: ' + (error.message || 'Unknown error') });
  }
}

// Increase timeout for Gemini API calls
export const config = {
  maxDuration: 60,
};

