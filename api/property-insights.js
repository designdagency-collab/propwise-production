// Server-side Gemini API calls - API key is NEVER exposed to client
import { GoogleGenAI } from "@google/genai";

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
        yield: { type: "STRING" },
        growth: { type: "STRING" },
        confidenceLevel: { type: "STRING", enum: ['High', 'Medium', 'Low'] }
      }
    },
    rentalPosition: {
      type: "OBJECT",
      properties: {
        estimatedWeeklyRent: { type: "NUMBER" },
        estimatedCashPositionWeekly: { type: "NUMBER" }
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

  const { address } = req.body;

  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('[PropertyInsights] GEMINI_API_KEY not configured');
    return res.status(500).json({ error: 'AI service not configured' });
  }

  console.log('[PropertyInsights] Fetching insights for:', address.substring(0, 40) + '...');

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a professional Australian property planning analyst and prop-tech engineer for upblock.ai.
Your task is to generate a structured Property DNA report for: "${address}".

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

FOCUS: Value Uplift, Renovation Feasibility, Development Potential, Comparable Sales, Rental Yield, and Local Amenities.
MANDATORY MODULES:

1. VALUE-ADD STRATEGIES
- Return 5–8 strategies (internal/renovation focused).

2. DEVELOPMENT SCENARIOS
- Analyze up to 3 scenarios: Knockdown Rebuild, Duplex, and Townhouse/Multi-dwelling.
- Provide indicative costs, estimated end value (GRV), net profit, and timeframe.

3. INDICATIVE RENTAL CASH POSITION
- Calculate potential rent AFTER improvements.
- Assume an investment loan of 80% LVR against Predicted Post-Improvement Midpoint Value.
- Use Australian interest rates (~6.3%) for P&I 30yr loan.
- State the indicative weekly Surplus/Deficit (Cash Position) after accounting for weekly mortgage repayments vs expected weekly rent.

4. LOCAL AREA INTEL, APPROVAL PATHWAY & ZONING INTEL.
- Include schools and key public transport (trains/buses).

5. COMPARABLE SALES (CRITICAL - SOLD ONLY)
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
- Output ONLY valid JSON. No markdown blocks.`;

    console.log('[PropertyInsights] Calling Gemini API with model gemini-3-flash-preview...');
    
    // Use EXACT original format that was working
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 8192 },  // 4x more thinking time for thorough research
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.7  // Higher creativity for varied strategies, accuracy from increased thinking budget
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

