import { GoogleGenAI, Type } from "@google/genai";
import { PropertyData } from "../types";

export class GeminiService {
  async fetchPropertyInsights(address: string): Promise<PropertyData> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `You are a professional Australian property planning analyst and prop-tech engineer for Propwise.
Your task is to generate a structured Property DNA report for: "${address}".

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
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              address: { type: Type.STRING },
              propertyType: { type: Type.STRING },
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
      return data;
    } catch (error: any) {
      console.error("Strategy Compilation Error:", error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
