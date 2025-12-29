import { GoogleGenAI, Type } from "@google/genai";
import { PropertyData } from "../types";

export class GeminiService {
  async fetchPropertyInsights(address: string): Promise<PropertyData> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `You are a professional Australian property planning analyst and prop-tech engineer for Propwise.
Your task is to generate a structured Property DNA report for: "${address}".

FOCUS: Value Uplift, Renovation Feasibility, Development Potential, Comparable Sales, and Local Amenities.
MANDATORY MODULES:

1. VALUE-ADD STRATEGIES
- Return 5–8 strategies (internal/renovation focused).

2. DEVELOPMENT SCENARIOS
- Analyze up to 3 scenarios: Knockdown Rebuild (single dwelling), Duplex (Dual Occupancy), and Townhouse/Multi-dwelling.
- Determine eligibility (Allowed/Likely/Uncertain/Not Allowed) based on zoning, lot size, and typical Australian local council controls.
- Provide indicative costs (build/demo/fees), estimated end value (GRV), net profit, and timeframe.
- Include whyAllowedOrNot (plain-English rationale) and keyConstraints (min lot size, frontage, etc.).

3. HIGHEST BEST USE SUMMARY
- Identify which scenario (renovation or development) offers the best outcome.

4. LOCAL AREA INTEL (NEW)
- Research schools: 3 primary and 3 secondary nearby. Include type (Public/Private/Catholic), approx distance in km, and catchment notes if possible.
- Research public transport: 2 train stations and 3 bus stops. Include network names, routes, distances, and approximate travel time to the nearest major CBD if available.
- Provide a brief 1-2 sentence lifestyle summary.

5. APPROVAL PATHWAY SUMMARY
- Likely pathways (Exempt/CDC/DA).

6. ZONING INTEL (CRITICAL)
- Current zone details and explicitly research if rezoned in the LAST 2 YEARS.

7. COMPARABLE SALES
- Recent market data.

8. PORTFOLIO SELLOUT SUMMARY
9. WATCH OUTS

RULES:
- Address match is king.
- Accuracy first. If unknown, state "Unknown".
- Output ONLY valid JSON. No markdown blocks.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
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
                    properties: {
                      front: { type: Type.STRING },
                      side: { type: Type.STRING },
                      rear: { type: Type.STRING }
                    }
                  },
                  neighborProximity: { type: Type.STRING }
                }
              },
              zoning: {
                type: Type.OBJECT,
                properties: {
                  code: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  recommendation: { type: Type.STRING }
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
              confidenceReasons: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              approvalPathway: {
                type: Type.OBJECT,
                properties: {
                  likelyPathway: { type: Type.STRING, enum: ['Exempt', 'CDC', 'DA', 'Mixed/Depends', 'Unknown'] },
                  explanation: { type: Type.STRING },
                  typicalTriggers: { type: Type.ARRAY, items: { type: Type.STRING } },
                  docsToConfirm: { type: Type.ARRAY, items: { type: Type.STRING } },
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
                  whatItMeans: { type: Type.STRING },
                  recentChanges: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        date: { type: Type.STRING },
                        changeTitle: { type: Type.STRING },
                        summary: { type: Type.STRING },
                        impactOnOwner: { type: Type.STRING }
                      }
                    }
                  },
                  confidence: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
                }
              },
              comparableSales: {
                type: Type.OBJECT,
                properties: {
                  subjectLastSale: {
                    type: Type.OBJECT,
                    nullable: true,
                    properties: {
                      date: { type: Type.STRING },
                      price: { type: Type.NUMBER },
                      sourceUrl: { type: Type.STRING }
                    }
                  },
                  sameBuildingSales: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        unitLabel: { type: Type.STRING },
                        date: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        notes: { type: Type.STRING },
                        sourceUrl: { type: Type.STRING }
                      }
                    }
                  },
                  nearbySales: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        addressShort: { type: Type.STRING },
                        date: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        beds: { type: Type.INTEGER },
                        baths: { type: Type.INTEGER },
                        cars: { type: Type.INTEGER },
                        distanceKm: { type: Type.NUMBER },
                        notes: { type: Type.STRING },
                        sourceUrl: { type: Type.STRING }
                      }
                    }
                  },
                  pricingContextSummary: { type: Type.STRING }
                }
              },
              trueCostToOwn: {
                type: Type.OBJECT,
                properties: {
                  assumptions: {
                    type: Type.OBJECT,
                    properties: {
                      interestRatePercent: { type: Type.NUMBER },
                      loanTermYears: { type: Type.NUMBER },
                      depositPercent: { type: Type.NUMBER }
                    }
                  },
                  mortgageWeeklyEstimate: { type: Type.NUMBER },
                  mortgageMonthlyEstimate: { type: Type.NUMBER },
                  buyingCosts: {
                    type: Type.OBJECT,
                    properties: {
                      stampDutyEstimate: { type: Type.NUMBER },
                      legalAndConveyancingEstimate: { type: Type.NUMBER },
                      inspectionsEstimate: { type: Type.NUMBER },
                      totalUpfrontEstimate: { type: Type.NUMBER }
                    }
                  },
                  ongoingCosts: {
                    type: Type.OBJECT,
                    properties: {
                      councilRatesAnnualEstimate: { type: Type.NUMBER },
                      waterRatesAnnualEstimate: { type: Type.NUMBER },
                      insuranceAnnualEstimate: { type: Type.NUMBER },
                      strataLeviesAnnualEstimate: { type: Type.NUMBER },
                      maintenanceAnnualEstimate: { type: Type.NUMBER }
                    }
                  },
                  affordabilitySummary: { type: Type.STRING }
                }
              },
              lifestyleReality: {
                type: Type.OBJECT,
                properties: {
                  commuteToCBD: { type: Type.STRING },
                  walkabilitySummary: { type: Type.STRING },
                  noiseExposure: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
                  familyFriendliness: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
                  weekendLifestyle: { type: Type.STRING },
                  summary: { type: Type.STRING }
                }
              },
              nextSteps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    whyItMatters: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
                  }
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
                    impact: { type: Type.STRING },
                    planningPathway: { type: Type.STRING, enum: ['Exempt', 'CDC', 'DA', 'Unknown'] },
                    planningNotes: { type: Type.STRING },
                    estimatedCost: {
                      type: Type.OBJECT,
                      properties: {
                        low: { type: Type.NUMBER },
                        high: { type: Type.NUMBER },
                        costNotes: { type: Type.STRING }
                      }
                    },
                    estimatedUplift: {
                      type: Type.OBJECT,
                      properties: {
                        low: { type: Type.NUMBER },
                        high: { type: Type.NUMBER },
                        upliftNotes: { type: Type.STRING }
                      }
                    },
                    saleProfitEstimate: {
                      type: Type.OBJECT,
                      properties: {
                        low: { type: Type.NUMBER },
                        high: { type: Type.NUMBER }
                      }
                    },
                    timeframeWeeks: {
                      type: Type.OBJECT,
                      properties: {
                        low: { type: Type.NUMBER },
                        high: { type: Type.NUMBER }
                      }
                    },
                    tradeBreakdown: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          trade: { type: Type.STRING },
                          low: { type: Type.NUMBER },
                          high: { type: Type.NUMBER },
                          notes: { type: Type.STRING }
                        }
                      }
                    }
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
                    indicativeYield: {
                      type: Type.OBJECT,
                      properties: {
                        dwellings: { type: Type.INTEGER },
                        bedroomsTypical: { type: Type.STRING }
                      }
                    },
                    estimatedCost: {
                      type: Type.OBJECT,
                      properties: { low: { type: Type.NUMBER }, high: { type: Type.NUMBER } }
                    },
                    estimatedEndValue: {
                      type: Type.OBJECT,
                      properties: { low: { type: Type.NUMBER }, high: { type: Type.NUMBER } }
                    },
                    estimatedNetProfit: {
                      type: Type.OBJECT,
                      properties: { low: { type: Type.NUMBER }, high: { type: Type.NUMBER } }
                    },
                    timeframeWeeks: {
                      type: Type.OBJECT,
                      properties: { low: { type: Type.NUMBER }, high: { type: Type.NUMBER } }
                    },
                    keyConstraints: { type: Type.ARRAY, items: { type: Type.STRING } },
                    keyRisks: { type: Type.ARRAY, items: { type: Type.STRING } },
                    confidenceLevel: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
                  }
                }
              },
              highestBestUse: {
                type: Type.OBJECT,
                properties: {
                  bestScenarioTitle: { type: Type.STRING },
                  bestBy: { type: Type.STRING, enum: ['NetProfit', 'EndValue', 'Feasibility'] },
                  rationale: { type: Type.STRING }
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
                            type: { type: Type.STRING, enum: ['Public', 'Private', 'Catholic', 'Other'] },
                            distanceKm: { type: Type.NUMBER },
                            approxCatchment: { type: Type.STRING },
                            ratingHint: { type: Type.STRING },
                            sourceUrl: { type: Type.STRING }
                          }
                        }
                      },
                      secondary: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            name: { type: Type.STRING },
                            type: { type: Type.STRING, enum: ['Public', 'Private', 'Catholic', 'Other'] },
                            distanceKm: { type: Type.NUMBER },
                            approxCatchment: { type: Type.STRING },
                            ratingHint: { type: Type.STRING },
                            sourceUrl: { type: Type.STRING }
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
                            lineOrNetwork: { type: Type.STRING },
                            distanceKm: { type: Type.NUMBER },
                            typicalTravelTimeToCBD: { type: Type.STRING },
                            sourceUrl: { type: Type.STRING }
                          }
                        }
                      },
                      busStops: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            name: { type: Type.STRING },
                            routes: { type: Type.ARRAY, items: { type: Type.STRING } },
                            distanceKm: { type: Type.NUMBER },
                            sourceUrl: { type: Type.STRING }
                          }
                        }
                      }
                    }
                  },
                  lifestyleSummary: { type: Type.STRING }
                }
              },
              portfolioSelloutSummary: {
                type: Type.OBJECT,
                properties: {
                  bestStrategyByProfit: { type: Type.STRING },
                  estimatedNetProfitRange: {
                    type: Type.OBJECT,
                    properties: {
                      low: { type: Type.NUMBER },
                      high: { type: Type.NUMBER }
                    }
                  },
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
                    severity: { type: Type.STRING },
                    impact: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
                    consequence: { type: Type.STRING }
                  }
                }
              },
              investmentVerdict: { type: Type.STRING },
              localMarketVibe: { type: Type.STRING },
              sharePrompt: {
                type: Type.OBJECT,
                properties: {
                  headline: { type: Type.STRING },
                  message: { type: Type.STRING },
                  ctaLabel: { type: Type.STRING }
                }
              }
            },
            required: ["address", "attributes", "zoning", "proximity", "valueSnapshot", "sitePlan", "approvalPathway", "zoningIntel", "comparableSales", "valueAddStrategies", "portfolioSelloutSummary", "watchOuts", "investmentVerdict", "sharePrompt", "confidenceReasons", "trueCostToOwn", "nextSteps", "lifestyleReality"]
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