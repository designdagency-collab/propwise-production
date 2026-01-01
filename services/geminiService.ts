import { GoogleGenAI, Type } from "@google/genai";
import { PropertyData } from "../types";

// Check if address has a range pattern that COULD indicate combined lots
// Final determination requires checking property type (only houses/land, not apartments)
function hasRangePattern(address: string): boolean {
  const trimmed = address.trim().toLowerCase();
  
  // Exclude obvious unit-style addresses
  if (/^(unit|u|apt|apartment|suite|level|shop|office)\s*\d/i.test(trimmed)) return false;
  if (/^\d+\s*\/\s*\d+/.test(trimmed)) return false; // "1/45 Smith St" format
  
  // Check for hyphen range pattern (e.g., "2-6 Smith St")
  const hyphenMatch = address.trim().match(/^(\d+)\s*-\s*(\d+)\s+/);
  if (hyphenMatch) {
    const start = parseInt(hyphenMatch[1]);
    const end = parseInt(hyphenMatch[2]);
    // Only potential combined lots if difference is small (max 6)
    if (end - start <= 6 && end > start) return true;
  }
  
  // Check for ampersand pattern (e.g., "2 & 4 Smith St")
  if (/^\d+\s*&\s*\d+\s+/.test(address.trim())) return true;
  
  // Check for "Lot 1 & 2" style (explicit lot reference)
  if (/lots?\s*\d+\s*(&|,)\s*\d+/i.test(address.trim())) return true;
  
  return false;
}

// Determine if property is combined lots based on address pattern AND property type
function isCombinedLots(address: string, propertyType: string): boolean {
  // Must have a range pattern in the address
  if (!hasRangePattern(address)) return false;
  
  // Only mark as combined lots for houses/land, NOT apartments/units
  const nonCombinedTypes = ['apartment', 'unit', 'townhouse', 'villa', 'flat', 'strata'];
  const propTypeLower = (propertyType || '').toLowerCase();
  
  // If it's an apartment/unit type, it's NOT combined lots
  if (nonCombinedTypes.some(t => propTypeLower.includes(t))) return false;
  
  // It's a house/land with a range pattern - likely combined lots
  return true;
}

export class GeminiService {
  async fetchPropertyInsights(address: string): Promise<PropertyData> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const addressHasRange = hasRangePattern(address);
    
    // Build combined lots context if address has range pattern
    // AI will verify based on property type (only houses/land, not apartments)
    const combinedLotsContext = addressHasRange ? `
⚠️ POTENTIAL COMBINED/AMALGAMATED LOTS:
This address has a range pattern (e.g., "${address}") which MAY indicate multiple adjoining lots.
- FIRST determine the property type (House, Apartment, etc.)
- If it's an APARTMENT/UNIT building, this is just a unit range - treat normally
- If it's HOUSES or LAND, this likely represents combined lots being sold together:
  - Calculate the COMBINED total land area for all lots
  - Analyse development potential based on the amalgamated site
  - Consider that combining lots often unlocks greater development opportunities
` : '';

    const prompt = `You are a professional Australian property planning analyst and prop-tech engineer for upblock.ai.
Your task is to generate a structured Property DNA report for: "${address}".
${combinedLotsContext}

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

RULES:
- Address match is king.
- Output ONLY valid JSON. No markdown blocks.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingBudget: 2048 },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              address: { type: Type.STRING },
              propertyType: { type: Type.STRING, enum: ['House', 'Apartment / Unit', 'Townhouse', 'Villa', 'Duplex', 'Land', 'Rural', 'Commercial', 'Unknown'] },
              landSize: { type: Type.STRING },
              attributes: {
                type: Type.OBJECT,
                properties: {
                  beds: { type: Type.INTEGER },
                  baths: { type: Type.INTEGER },
                  cars: { type: Type.INTEGER }
                }
              },
              sitePlan: {
                type: Type.OBJECT,
                properties: {
                  width: { type: Type.STRING },
                  depth: { type: Type.STRING },
                  frontage: { type: Type.STRING },
                  siteCoverage: { type: Type.STRING },
                  setbacks: {
                    type: Type.OBJECT,
                    properties: { front: { type: Type.STRING }, side: { type: Type.STRING }, rear: { type: Type.STRING } }
                  }
                }
              },
              zoning: {
                type: Type.OBJECT,
                properties: {
                  code: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING }
                }
              },
              proximity: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    distance: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['transport', 'shopping', 'education', 'leisure'] }
                  }
                }
              },
              valueSnapshot: {
                type: Type.OBJECT,
                properties: {
                  estimateMin: { type: Type.NUMBER },
                  estimateMax: { type: Type.NUMBER },
                  indicativeMidpoint: { type: Type.NUMBER },
                  yield: { type: Type.STRING },
                  growth: { type: Type.STRING },
                  confidenceLevel: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
                }
              },
              rentalPosition: {
                type: Type.OBJECT,
                properties: {
                  estimatedWeeklyRent: { type: Type.NUMBER },
                  estimatedCashPositionWeekly: { type: Type.NUMBER }
                }
              },
              approvalPathway: {
                type: Type.OBJECT,
                properties: {
                  likelyPathway: { type: Type.STRING, enum: ['Exempt', 'CDC', 'DA', 'Mixed/Depends', 'Unknown'] },
                  explanation: { type: Type.STRING },
                  estimatedApprovalTimeWeeks: {
                    type: Type.OBJECT,
                    properties: { low: { type: Type.NUMBER }, high: { type: Type.NUMBER } }
                  }
                }
              },
              zoningIntel: {
                type: Type.OBJECT,
                properties: {
                  currentZoneCode: { type: Type.STRING },
                  currentZoneTitle: { type: Type.STRING },
                  whatItMeans: { type: Type.STRING }
                }
              },
              comparableSales: {
                type: Type.OBJECT,
                properties: {
                  nearbySales: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        addressShort: { type: Type.STRING },
                        date: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        distanceKm: { type: Type.NUMBER }
                      }
                    }
                  },
                  pricingContextSummary: { type: Type.STRING }
                }
              },
              valueAddStrategies: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    effort: { type: Type.STRING },
                    planningPathway: { type: Type.STRING, enum: ['Exempt', 'CDC', 'DA', 'Unknown'] },
                    estimatedCost: { type: Type.OBJECT, properties: { low: { type: Type.NUMBER }, high: { type: Type.NUMBER } } },
                    estimatedUplift: { type: Type.OBJECT, properties: { low: { type: Type.NUMBER }, high: { type: Type.NUMBER } } }
                  }
                }
              },
              developmentScenarios: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    scenarioType: { type: Type.STRING, enum: ['Knockdown', 'Duplex', 'Townhouse'] },
                    eligibility: { type: Type.STRING, enum: ['Allowed', 'Likely', 'Uncertain', 'Not Allowed'] },
                    planningPathway: { type: Type.STRING, enum: ['Exempt', 'CDC', 'DA', 'Unknown'] },
                    description: { type: Type.STRING },
                    whyAllowedOrNot: { type: Type.STRING },
                    estimatedCost: { type: Type.OBJECT, properties: { low: { type: Type.NUMBER }, high: { type: Type.NUMBER } } },
                    estimatedNetProfit: { type: Type.OBJECT, properties: { low: { type: Type.NUMBER }, high: { type: Type.NUMBER } } }
                  }
                }
              },
              portfolioSelloutSummary: {
                type: Type.OBJECT,
                properties: {
                  bestStrategyByProfit: { type: Type.STRING },
                  estimatedNetProfitRange: { type: Type.OBJECT, properties: { low: { type: Type.NUMBER }, high: { type: Type.NUMBER } } },
                  selloutExplanation: { type: Type.STRING }
                }
              },
              watchOuts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    severity: { type: Type.STRING }
                  }
                }
              },
              localAreaIntel: {
                type: Type.OBJECT,
                properties: {
                  schools: {
                    type: Type.OBJECT,
                    properties: {
                      primary: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            name: { type: Type.STRING },
                            distanceKm: { type: Type.NUMBER }
                          }
                        }
                      },
                      secondary: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            name: { type: Type.STRING },
                            distanceKm: { type: Type.NUMBER }
                          }
                        }
                      }
                    }
                  },
                  transport: {
                    type: Type.OBJECT,
                    properties: {
                      trainStations: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            name: { type: Type.STRING },
                            distanceKm: { type: Type.NUMBER },
                            typicalTravelTimeToCBD: { type: Type.STRING }
                          }
                        }
                      },
                      busStops: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            name: { type: Type.STRING },
                            distanceKm: { type: Type.NUMBER }
                          }
                        }
                      }
                    }
                  },
                  lifestyleSummary: { type: Type.STRING }
                }
              },
              localMarketVibe: { type: Type.STRING },
              sharePrompt: {
                type: Type.OBJECT,
                properties: { message: { type: Type.STRING } }
              }
            },
            required: ["address", "attributes", "proximity", "valueSnapshot", "approvalPathway", "zoningIntel", "comparableSales", "valueAddStrategies", "portfolioSelloutSummary", "watchOuts", "sharePrompt", "rentalPosition"]
          }
        },
      });

      let text = response.text || '';
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const data = JSON.parse(text) as PropertyData;
      const sources: { title: string, url: string }[] = [];
      const candidates = response.candidates as any[];
      const chunks = candidates?.[0]?.groundingMetadata?.groundingChunks;
      
      if (chunks) {
        chunks.forEach((chunk: any) => {
          if (chunk.web) sources.push({ title: chunk.web.title || "Market Source", url: chunk.web.uri });
        });
      }
      data.sources = sources;
      // Determine combined lots based on address pattern AND property type from AI
      data.isCombinedLots = isCombinedLots(address, data.propertyType || '');
      return data;
    } catch (error: any) {
      console.error("Strategy Compilation Error:", error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
