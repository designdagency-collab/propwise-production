// Server-side Gemini API calls - API key is NEVER exposed to client
import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

// ABS API base URL (no API key required)
const ABS_API_BASE = 'https://api.data.abs.gov.au';

// GCCSA codes for major Australian cities
const GCCSA_CODES = {
  'sydney': '1GSYD', 'melbourne': '2GMEL', 'brisbane': '3GBRI',
  'adelaide': '4GADE', 'perth': '5GPER', 'hobart': '6GHOB',
  'darwin': '7GDAR', 'canberra': '8ACTE',
};

// Suburb to capital city mapping
const SUBURB_TO_GCCSA = {
  // Greater Sydney
  'parramatta': '1GSYD', 'blacktown': '1GSYD', 'penrith': '1GSYD', 'liverpool': '1GSYD',
  'campbelltown': '1GSYD', 'randwick': '1GSYD', 'bondi': '1GSYD', 'manly': '1GSYD',
  'chatswood': '1GSYD', 'hornsby': '1GSYD', 'sutherland': '1GSYD', 'cronulla': '1GSYD',
  'burwood': '1GSYD', 'strathfield': '1GSYD', 'ryde': '1GSYD', 'epping': '1GSYD',
  'castle hill': '1GSYD', 'north sydney': '1GSYD', 'mosman': '1GSYD', 'neutral bay': '1GSYD',
  'dee why': '1GSYD', 'brookvale': '1GSYD', 'hurstville': '1GSYD', 'kogarah': '1GSYD',
  'bankstown': '1GSYD', 'auburn': '1GSYD', 'granville': '1GSYD', 'fairfield': '1GSYD',
  'ingleburn': '1GSYD', 'wollongong': '1GSYD', 'newcastle': '1GSYD', 'gosford': '1GSYD',
  // Greater Melbourne
  'st kilda': '2GMEL', 'south yarra': '2GMEL', 'richmond': '2GMEL', 'fitzroy': '2GMEL',
  'brunswick': '2GMEL', 'footscray': '2GMEL', 'doncaster': '2GMEL', 'box hill': '2GMEL',
  'glen waverley': '2GMEL', 'dandenong': '2GMEL', 'frankston': '2GMEL', 'werribee': '2GMEL',
  'craigieburn': '2GMEL', 'preston': '2GMEL', 'coburg': '2GMEL', 'essendon': '2GMEL',
  'kew': '2GMEL', 'hawthorn': '2GMEL', 'camberwell': '2GMEL', 'toorak': '2GMEL',
  'brighton': '2GMEL', 'sandringham': '2GMEL', 'caulfield': '2GMEL', 'geelong': '2GMEL',
  // Greater Brisbane
  'south brisbane': '3GBRI', 'fortitude valley': '3GBRI', 'west end': '3GBRI',
  'toowong': '3GBRI', 'indooroopilly': '3GBRI', 'ipswich': '3GBRI', 'logan': '3GBRI',
  'gold coast': '3GBRI', 'sunshine coast': '3GBRI', 'caboolture': '3GBRI',
  // Greater Adelaide
  'glenelg': '4GADE', 'port adelaide': '4GADE', 'salisbury': '4GADE', 'unley': '4GADE',
  'norwood': '4GADE', 'burnside': '4GADE', 'prospect': '4GADE',
  // Greater Perth
  'fremantle': '5GPER', 'joondalup': '5GPER', 'rockingham': '5GPER', 'mandurah': '5GPER',
  'subiaco': '5GPER', 'claremont': '5GPER', 'scarborough': '5GPER', 'morley': '5GPER',
  // Greater Hobart
  'glenorchy': '6GHOB', 'sandy bay': '6GHOB',
  // Darwin
  'palmerston': '7GDAR', 'casuarina': '7GDAR',
  // Canberra/ACT
  'belconnen': '8ACTE', 'woden': '8ACTE', 'tuggeranong': '8ACTE', 'gungahlin': '8ACTE',
};

// Initialize Supabase client for caching
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Cache TTL: 2 weeks in milliseconds
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Extract suburb from an Australian address
 */
function extractSuburb(address) {
  const normalized = address.toLowerCase().trim();
  
  // Clean address to find suburb
  let cleaned = normalized
    .replace(/\d{4}/, '') // Remove postcode
    .replace(/\b(nsw|vic|qld|sa|wa|tas|nt|act|new south wales|victoria|queensland|south australia|western australia|tasmania|northern territory|australian capital territory)\b/gi, '')
    .replace(/\b(street|st|road|rd|avenue|ave|drive|dr|court|ct|place|pl|lane|ln|crescent|cres|way|parade|pde|highway|hwy|boulevard|blvd|close|cl)\b/gi, '')
    .replace(/[,]/g, ' ')
    .trim();
  
  const parts = cleaned.split(/\s+/).filter(p => p.length > 2 && !/^\d+$/.test(p));
  
  // Check for known suburbs (from end of address)
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].toLowerCase();
    if (SUBURB_TO_GCCSA[part] || GCCSA_CODES[part]) {
      return part;
    }
    // Check two-word suburbs
    if (i > 0) {
      const twoWord = `${parts[i-1]} ${parts[i]}`.toLowerCase();
      if (SUBURB_TO_GCCSA[twoWord]) {
        return twoWord;
      }
    }
  }
  
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

/**
 * Fetch ABS Residential Property Price Index
 * Returns index value and year-on-year percentage change
 */
async function fetchABSPropertyPriceIndex(gccsaCode) {
  try {
    // RES_PROP_INDEXES: INDEX (1) and PCPY (2) for percentage change
    const url = `${ABS_API_BASE}/data/ABS,RES_PROP_INDEXES,1.0.0/1+2.${gccsaCode}.Q?detail=dataonly`;
    
    console.log('[ABS] Fetching property price index for:', gccsaCode);
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/vnd.sdmx.data+json' }
    });
    
    if (!response.ok) {
      console.log('[ABS] API returned:', response.status);
      return null;
    }
    
    const data = await response.json();
    const dataSets = data?.data?.dataSets;
    
    if (!dataSets || dataSets.length === 0) return null;
    
    const series = dataSets[0].series;
    if (!series || Object.keys(series).length === 0) return null;
    
    // Get time periods
    const timePeriods = data?.data?.structure?.dimensions?.observation?.find(
      d => d.id === 'TIME_PERIOD'
    )?.values || [];
    
    let index = null;
    let percentageChange = null;
    let period = null;
    
    for (const [seriesKey, seriesData] of Object.entries(series)) {
      const observations = seriesData.observations;
      if (!observations) continue;
      
      const obsKeys = Object.keys(observations).sort((a, b) => parseInt(b) - parseInt(a));
      if (obsKeys.length > 0) {
        const latestKey = obsKeys[0];
        const value = observations[latestKey][0];
        
        // Series "0:X:0" is index, "1:X:0" is percentage change
        if (seriesKey.startsWith('0:')) {
          index = value;
          period = timePeriods[parseInt(latestKey)]?.name || timePeriods[parseInt(latestKey)]?.id;
        } else if (seriesKey.startsWith('1:')) {
          percentageChange = value;
        }
      }
    }
    
    console.log('[ABS] Property price index:', { index, percentageChange, period });
    return { index, percentageChange, period };
    
  } catch (error) {
    console.error('[ABS] Error fetching price index:', error.message);
    return null;
  }
}

/**
 * Fetch real ABS data for an address to supplement AI insights
 */
async function fetchABSData(address) {
  const suburb = extractSuburb(address);
  if (!suburb) {
    console.log('[ABS] Could not extract suburb from address');
    return null;
  }
  
  const gccsaCode = SUBURB_TO_GCCSA[suburb.toLowerCase()] || GCCSA_CODES[suburb.toLowerCase()];
  if (!gccsaCode) {
    console.log('[ABS] No GCCSA mapping for suburb:', suburb);
    return null;
  }
  
  const priceIndex = await fetchABSPropertyPriceIndex(gccsaCode);
  
  if (priceIndex) {
    return {
      suburb,
      region: gccsaCode,
      priceIndex: priceIndex.index,
      priceGrowthPercent: priceIndex.percentageChange,
      period: priceIndex.period,
      source: 'ABS Residential Property Price Indexes'
    };
  }
  
  return null;
}

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
    commercialDetails: {
      type: "OBJECT",
      description: "Only populated when propertyType is Commercial",
      properties: {
        buildingType: { type: "STRING", enum: ['Retail', 'Office', 'Industrial', 'Warehouse', 'Medical', 'Hospitality', 'Mixed-Use', 'Other'] },
        buildingAreaSqm: { type: "NUMBER" },
        landAreaSqm: { type: "NUMBER" },
        floorSpaceRatio: { type: "NUMBER" },
        yearBuilt: { type: "STRING" },
        condition: { type: "STRING", enum: ['Excellent', 'Good', 'Fair', 'Poor', 'Unknown'] },
        parkingSpaces: { type: "INTEGER" },
        tenancyStatus: { type: "STRING", enum: ['Vacant', 'Leased', 'Partially Leased', 'Owner Occupied', 'Unknown'] },
        currentTenant: { type: "STRING" },
        annualRentIncome: { type: "NUMBER" },
        leaseTermRemaining: { type: "STRING" },
        ratePerSqmLand: { type: "NUMBER" },
        ratePerSqmBuilding: { type: "NUMBER" },
        capRate: { type: "NUMBER" },
        valuationMethod: { type: "STRING", enum: ['Direct Comparison', 'Income Capitalisation', 'Summation', 'Mixed'] },
        valuationBreakdown: { type: "STRING" },
        landValue: { type: "NUMBER" },
        improvementsValue: { type: "NUMBER" },
        potentialUses: { type: "ARRAY", items: { type: "STRING" } }
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
  const allowedOrigins = ['https://upblock.ai', 'https://www.upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
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

  // Fetch real ABS data to supplement AI insights
  let absData = null;
  try {
    absData = await fetchABSData(address);
    if (absData) {
      console.log('[PropertyInsights] ABS data fetched:', { 
        region: absData.region, 
        priceGrowth: absData.priceGrowthPercent,
        period: absData.period 
      });
    }
  } catch (absErr) {
    console.warn('[PropertyInsights] ABS fetch failed (continuing without):', absErr.message);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // ABS data context for the AI prompt
    const absContext = absData ? `
📊 OFFICIAL ABS DATA FOR THIS REGION (USE THIS - DO NOT OVERRIDE):
- Region: ${absData.region} (Greater ${absData.suburb?.charAt(0).toUpperCase() + absData.suburb?.slice(1)})
- Property Price Index: ${absData.priceIndex} (${absData.period})
- Annual Price Growth: ${absData.priceGrowthPercent !== null ? absData.priceGrowthPercent.toFixed(1) + '%' : 'N/A'}
- Source: ${absData.source}

⚠️ IMPORTANT: The above ABS data is OFFICIAL and should be used to VALIDATE your estimates.
- If your estimated growth differs significantly from ${absData.priceGrowthPercent?.toFixed(1)}%, explain why.
- Set valueSnapshot.growth to reflect the ABS data (e.g., "${absData.priceGrowthPercent?.toFixed(1)}% p.a. (ABS ${absData.period})").
- Set confidenceLevel to "High" for this region as we have official ABS data.

` : '';

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
${dataCorrectionInstructions}${absContext}
🚨 STEP 1: COMMERCIAL PROPERTY PRE-CHECK (DO THIS FIRST - BEFORE ANYTHING ELSE)
Before assuming ANY property is residential, you MUST check for commercial indicators:

🏢 COMMERCIAL ADDRESS PATTERNS (if ANY match → propertyType = "Commercial"):
- Address starts with "Shop", "Suite", "Level", "Office", "Unit" in a non-residential building
- Address contains "Kiosk", "Tenancy", "Ground Floor", "First Floor" (commercial building)
- Street number ranges like "123-125" or "10-12" (often shopfronts or commercial)
- Address is in a shopping centre, arcade, plaza, or retail complex

🛣️ MAIN ROAD / COMMERCIAL STRIP CHECK:
These roads are predominantly commercial - addresses on them are likely NOT residential:
- NSW: Parramatta Rd, Victoria Rd, Pacific Hwy, Great Western Hwy, Princes Hwy, King St (Newtown), Oxford St
- VIC: Sydney Rd, High St, Chapel St, Bridge Rd, Smith St, Brunswick St
- QLD: Coronation Dr, Ipswich Rd, Logan Rd, Sandgate Rd
- SA: Unley Rd, Magill Rd, The Parade, Henley Beach Rd
- WA: Stirling Hwy, Albany Hwy, Canning Hwy
If address is on a main arterial road → SEARCH "[address]" to verify if residential or commercial

🔍 MANDATORY COMMERCIAL VERIFICATION SEARCHES:
1. Search "[full address] ABN" - if an ABN is registered at this EXACT address → COMMERCIAL
2. Search "[full address] business" - if a business name/shop operates there → COMMERCIAL
3. Search Google Maps "[address]" - look at Street View:
   - Shopfront with signage? → COMMERCIAL
   - Awning over footpath? → COMMERCIAL
   - Display windows? → COMMERCIAL
   - Part of a row of shops? → COMMERCIAL
   - Roller door/loading dock? → COMMERCIAL (industrial)
4. Search "[address] for lease" or "[address] commercial" - if commercial listings exist → COMMERCIAL

🚫 AUTOMATIC COMMERCIAL CLASSIFICATION (NO FURTHER CHECKS NEEDED):
If ANY of the following are TRUE, set propertyType = "Commercial" immediately:
✓ An ABN or business name is registered at this address
✓ A shop, cafe, restaurant, office, or business operates there
✓ The building has shopfronts on ground floor
✓ Address format is "Shop X", "Suite X", "Level X", "Office X"
✓ Property is listed on commercialrealestate.com.au
✓ Zoning is B1, B2, B3, B4, B5, B6, B7, IN1, IN2, IN3, IN4, SP1, SP2
✓ No residential listing (beds/baths) can be found on realestate.com.au or domain.com.au

⚠️ CRITICAL DEFAULT RULE:
- If you CANNOT find a residential listing with beds/baths/cars → DO NOT assume it's a house
- Default to "Commercial" if on a main road, or "Unknown" if unclear
- ONLY mark as "House" if you find an ACTUAL real estate listing with bedroom/bathroom counts

---

📋 STEP 2: ZONING VERIFICATION (if not already classified as Commercial):
Search for zoning code from council planning maps or NSW Planning Portal:

RESIDENTIAL ZONES (can be House/Apartment/Townhouse):
- R1, R2, R3, R4, R5, RU1-RU5, E4 = Residential

COMMERCIAL/INDUSTRIAL ZONES (ALWAYS "Commercial" property type):
- B1, B2, B3, B4, B5, B6, B7 = Business/Commercial → propertyType = "Commercial"
- IN1, IN2, IN3, IN4 = Industrial → propertyType = "Commercial"
- SP1, SP2, SP3 = Special Purpose → Usually "Commercial"
- W1, W2, W3 = Working Waterfront → "Commercial"

⚠️ ZONING OVERRIDES APPEARANCE: A property in a B2 zone is COMMERCIAL even if it LOOKS like a house.

---

📋 STEP 3: RESIDENTIAL VERIFICATION (ONLY if Steps 1-2 confirm residential zone AND no commercial indicators):
- Search realestate.com.au and domain.com.au for the EXACT address
- Extract beds/baths/cars from the listing
- If NO listing found → consider "Unknown" not "House"
- Houses = standalone dwelling, typically 300sqm+ land, in R1-R5 zone
- Apartments = strata title, unit number format like "5/30" or "Unit 5"

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
- ⚠️ CRITICAL: Use REALISTIC Australian renovation costs. DO NOT inflate costs.

🌳 MANDATORY STRATEGY: CURB APPEAL / FACADE (ASSESS EXTERIOR CONDITION)
- ALWAYS include a curb appeal or facade strategy - applicable to EVERY property
- ⚠️ CRITICAL: Assess the property's EXTERIOR CONDITION from imagery/description:
  • Does it have old weatherboards, fibro, dated brick veneer?
  • Is the roof rusty, tiled, or dated Colorbond?
  • Is the paint peeling or colours outdated (cream, salmon, dark brown)?

SCALE THE RECOMMENDATION BASED ON CONDITION:

A) GOOD EXTERIOR (modern cladding, recent paint, good roof):
   - Title: "Curb Appeal & Front Garden Refresh"
   - Focus: Landscaping, new turf, native plants, modern fence, driveway seal
   - Cost: $5,000 - $25,000
   - Description style: "Enhance street presence with native coastal planting, fresh turf, and a sleek aluminium slat fence"

B) DATED EXTERIOR (old paint, tired render, minor repairs needed):
   - Title: "Facade Refresh & Curb Appeal"  
   - Focus: Exterior repaint, minor render repairs, landscaping, new gutters
   - Cost: $20,000 - $45,000
   - Description style: "Repaint exterior in contemporary Dulux Lexicon Quarter with Monument trims, add native garden beds"

C) TIRED/OLD EXTERIOR (old weatherboards, fibro, dated brick, rusty roof):
   - Title: "Complete Facade Transformation"
   - Focus: Re-cladding, new roof, full exterior makeover + landscaping
   - Cost: $60,000 - $100,000
   - Description style: "Transform with James Hardie Linea cladding in Dulux Surfmist, new Colorbond Monument roof, rendered front fence, and designer landscaping inspired by Three Birds Renovations aesthetic"

DESIGN-FORWARD DESCRIPTIONS (mention specific materials):
- Cladding: James Hardie Linea, Scyon Axon, Weathertex, rendered brick
- Roofing: Colorbond in Monument, Surfmist, Basalt, Woodland Grey
- Colours: Dulux Lexicon Quarter, Surfmist, Natural White, Domino
- Fencing: Aluminium slats, rendered brick pillars, timber battens
- Landscaping: Native grasses (lomandra, dianella), ornamental pears, olive trees, decomposed granite paths

AUSTRALIAN RENOVATION COST BENCHMARKS (use these ranges):
- Light curb appeal (landscaping only): $5,000 - $25,000
- Facade repaint + landscaping: $20,000 - $45,000
- Full facade transformation (re-clad + roof + landscaping): $60,000 - $100,000
- Kitchen renovation: $15,000 - $60,000 (NOT $200k+)
- Bathroom renovation: $15,000 - $40,000
- Kitchen + Bathroom combo: $30,000 - $80,000
- Paint refresh (interior): $3,000 - $15,000
- Flooring replacement: $5,000 - $25,000
- Minor cosmetic refresh: $5,000 - $20,000
- Outdoor deck/entertaining: $15,000 - $50,000
- Full interior renovation (whole house): $80,000 - $200,000
- Granny flat/secondary dwelling: $100,000 - $200,000

⛔ DO NOT use development-level costs ($300k+) for simple renovations.
Only knockdown rebuilds, extensions, or multi-dwelling projects should exceed $200k.

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
- For combined lots: developmentScenarios should NOT be empty. Include at least the recommended development option.

---

🏢 COMMERCIAL PROPERTY ANALYSIS (ONLY IF propertyType = "Commercial")

If you have determined the property is COMMERCIAL, you MUST populate the commercialDetails object with accurate data.
Skip residential fields (beds/baths/cars = 0, rentalPosition = null for residential rent).

📋 STEP A: DETERMINE BUILDING TYPE
Search for the property and classify:
- Retail: Shopfront, strip shop, showroom, retail warehouse
- Office: Professional office space, medical suites
- Industrial: Factory, manufacturing, light industrial
- Warehouse: Storage, distribution centre, logistics
- Medical: Healthcare facility, specialist rooms, pharmacy
- Hospitality: Café, restaurant, pub, hotel
- Mixed-Use: Retail on ground floor + residential/office above
- Other: Childcare, service station, car wash, etc.

📋 STEP B: GET LAND & BUILDING MEASUREMENTS
Search for the property on commercialrealestate.com.au, realcommercial.com.au, or council records:

1. LAND SIZE (landAreaSqm):
   - Search "[address] lot size" or check council property information
   - Look for "site area" or "land area" in commercial listings
   - If unavailable, estimate from satellite imagery (label as estimate)

2. BUILDING SIZE (buildingAreaSqm):
   - Search for "Net Lettable Area (NLA)" or "Gross Floor Area (GFA)"
   - Check commercial listings for building size
   - If unavailable, estimate: Building Area ≈ Land Size × Floor Space Ratio

3. FLOOR SPACE RATIO (floorSpaceRatio):
   - Calculate: Building Area / Land Area
   - Typical ratios: Retail strip shop 0.5-0.8, Office 1.0-2.0, Industrial 0.3-0.5

📋 STEP C: COMMERCIAL VALUATION (CRITICAL - DO THE MATH)

Use these Australian commercial benchmarks:

🏪 RETAIL (Strip shops, main road shopfronts):
- Land value: $3,000 - $15,000 /sqm (prime) to $1,500 - $5,000 /sqm (secondary)
- Building value: $1,500 - $4,000 /sqm
- Cap rates: 5.5% - 7.5%

🏢 OFFICE:
- Land value: $2,000 - $10,000 /sqm (CBD/metro), $1,000 - $3,000 /sqm (suburban)
- Building value: $2,000 - $5,000 /sqm
- Cap rates: 5.0% - 7.0%

🏭 INDUSTRIAL / WAREHOUSE:
- Land value: $500 - $2,500 /sqm (metro), $200 - $800 /sqm (outer)
- Building value: $800 - $2,000 /sqm
- Cap rates: 5.0% - 6.5%

🏥 MEDICAL:
- Land value: Similar to office
- Building value: $2,500 - $6,000 /sqm (fitted out)
- Cap rates: 5.5% - 7.0%

📊 VALUATION METHODS:

1. SUMMATION METHOD (use when vacant or owner-occupied):
   Value = Land Value + Building Value
   Example:
   - Land: 300 sqm × $5,000/sqm = $1,500,000
   - Building: 200 sqm × $2,500/sqm = $500,000
   - Total: $2,000,000

2. INCOME CAPITALISATION (use when leased):
   Value = Annual Net Rent / Cap Rate
   Example:
   - Annual rent: $120,000
   - Cap rate: 6%
   - Value = $120,000 / 0.06 = $2,000,000

3. DIRECT COMPARISON (always cross-check):
   Search commercialrealestate.com.au for recent sales of similar properties
   Compare $/sqm of building area

📋 STEP D: POPULATE commercialDetails

{
  buildingType: "Retail",           // From Step A
  buildingAreaSqm: 200,             // From Step B
  landAreaSqm: 300,                 // From Step B
  floorSpaceRatio: 0.67,            // buildingArea / landArea
  yearBuilt: "1980s",               // If known
  condition: "Good",                // From imagery/listing
  parkingSpaces: 2,                 // From listing
  tenancyStatus: "Leased",          // Vacant/Leased/Owner Occupied
  currentTenant: "XYZ Cafe",        // If leased
  annualRentIncome: 65000,          // If leased
  leaseTermRemaining: "3 years",    // If known
  ratePerSqmLand: 5000,             // $/sqm used for land
  ratePerSqmBuilding: 2500,         // $/sqm used for building
  capRate: 6.5,                     // Capitalisation rate %
  valuationMethod: "Summation",     // Method used
  valuationBreakdown: "Land: 300sqm × $5,000 = $1.5M + Building: 200sqm × $2,500 = $500K = $2.0M",
  landValue: 1500000,               // Land component
  improvementsValue: 500000,        // Building component
  potentialUses: ["Retail", "Cafe", "Medical", "Office"]  // Permitted under zoning
}

📋 STEP E: SET valueSnapshot FOR COMMERCIAL

- estimateMin / estimateMax: Based on your commercial valuation (± 10%)
- indicativeMidpoint: Your calculated value
- yield: Commercial gross yield (annual rent / value × 100)
- growth: Commercial property growth for that area (typically 3-5% p.a.)
- confidenceLevel: High if you found actual comparable sales, Medium if estimated

⚠️ COMMERCIAL COMPARABLE SALES:
Search commercialrealestate.com.au for SOLD commercial properties nearby.
For comparableSales, include commercial sales with $/sqm notes.`;

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

    // Add ABS data and confidence levels to response
    if (absData) {
      // Add official ABS source
      sources.unshift({
        title: `ABS ${absData.source}`,
        url: 'https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/residential-property-price-indexes-eight-capital-cities'
      });
      
      // Add ABS data to response
      data.absData = {
        region: absData.region,
        priceIndex: absData.priceIndex,
        priceGrowthPercent: absData.priceGrowthPercent,
        period: absData.period,
        source: absData.source
      };
      
      // Set data confidence based on what we have
      data.dataConfidence = {
        overall: 'High',
        priceGrowth: { level: 'High', source: 'ABS Official Data' },
        propertyValue: { level: 'Medium', source: 'AI Estimate + ABS Context' },
        comparableSales: { level: data.comparableSales?.nearbySales?.length > 0 ? 'Medium' : 'Low', source: 'Web Search' },
        zoning: { level: 'Medium', source: 'Web Search' }
      };
    } else {
      // No ABS data available
      data.dataConfidence = {
        overall: 'Medium',
        priceGrowth: { level: 'Low', source: 'AI Estimate' },
        propertyValue: { level: 'Medium', source: 'AI Estimate' },
        comparableSales: { level: data.comparableSales?.nearbySales?.length > 0 ? 'Medium' : 'Low', source: 'Web Search' },
        zoning: { level: 'Medium', source: 'Web Search' }
      };
    }

    console.log('[PropertyInsights] Success for:', address.substring(0, 40) + '...', 'Confidence:', data.dataConfidence?.overall);
    
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

