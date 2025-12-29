import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const ai = new GoogleGenAI({ apiKey });

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

10. RENTAL POSITION
- Estimate weekly rent based on comparable rentals in the area
- Calculate annual rent (weekly * 52)
- Calculate gross yield percentage ((annual rent / indicative midpoint value) * 100)

RULES:
- Address match is king.
- Accuracy first. If unknown, state "Unknown".
- Output ONLY valid JSON. No markdown blocks.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            address: { type: "string" },
            propertyType: { type: "string" },
            landSize: { type: "string" },
            attributes: {
              type: "object",
              properties: {
                beds: { type: "integer" },
                baths: { type: "integer" },
                cars: { type: "integer" }
              }
            },
            sitePlan: {
              type: "object",
              properties: {
                width: { type: "string" },
                depth: { type: "string" },
                frontage: { type: "string" },
                siteCoverage: { type: "string" },
                setbacks: {
                  type: "object",
                  properties: {
                    front: { type: "string" },
                    side: { type: "string" },
                    rear: { type: "string" }
                  }
                },
                neighborProximity: { type: "string" }
              }
            },
            zoning: {
              type: "object",
              properties: {
                code: { type: "string" },
                title: { type: "string" },
                description: { type: "string" },
                recommendation: { type: "string" }
              }
            },
            proximity: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  distance: { type: "string" },
                  type: { type: "string" }
                }
              }
            },
            valueSnapshot: {
              type: "object",
              properties: {
                estimateMin: { type: "number" },
                estimateMax: { type: "number" },
                indicativeMidpoint: { type: "number" },
                yield: { type: "string" },
                growth: { type: "string" },
                confidenceLevel: { type: "string" }
              }
            },
            rentalPosition: {
              type: "object",
              properties: {
                estimatedWeeklyRent: { type: "number" },
                estimatedAnnualRent: { type: "number" },
                grossYieldPercent: { type: "number" }
              }
            },
            confidenceReasons: {
              type: "array",
              items: { type: "string" }
            },
            approvalPathway: {
              type: "object",
              properties: {
                likelyPathway: { type: "string" },
                explanation: { type: "string" },
                typicalTriggers: { type: "array", items: { type: "string" } },
                docsToConfirm: { type: "array", items: { type: "string" } },
                estimatedApprovalTimeWeeks: {
                  type: "object",
                  properties: { low: { type: "number" }, high: { type: "number" } }
                }
              }
            },
            zoningIntel: {
              type: "object",
              properties: {
                currentZoneCode: { type: "string" },
                currentZoneTitle: { type: "string" },
                whatItMeans: { type: "string" },
                recentChanges: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      date: { type: "string" },
                      changeTitle: { type: "string" },
                      summary: { type: "string" },
                      impactOnOwner: { type: "string" }
                    }
                  }
                },
                confidence: { type: "string" }
              }
            },
            comparableSales: {
              type: "object",
              properties: {
                subjectLastSale: {
                  type: "object",
                  nullable: true,
                  properties: {
                    date: { type: "string" },
                    price: { type: "number" },
                    sourceUrl: { type: "string" }
                  }
                },
                sameBuildingSales: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      unitLabel: { type: "string" },
                      date: { type: "string" },
                      price: { type: "number" },
                      notes: { type: "string" },
                      sourceUrl: { type: "string" }
                    }
                  }
                },
                nearbySales: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      addressShort: { type: "string" },
                      date: { type: "string" },
                      price: { type: "number" },
                      beds: { type: "integer" },
                      baths: { type: "integer" },
                      cars: { type: "integer" },
                      distanceKm: { type: "number" },
                      notes: { type: "string" },
                      sourceUrl: { type: "string" }
                    }
                  }
                },
                pricingContextSummary: { type: "string" }
              }
            },
            trueCostToOwn: {
              type: "object",
              properties: {
                assumptions: {
                  type: "object",
                  properties: {
                    interestRatePercent: { type: "number" },
                    loanTermYears: { type: "number" },
                    depositPercent: { type: "number" }
                  }
                },
                mortgageWeeklyEstimate: { type: "number" },
                mortgageMonthlyEstimate: { type: "number" },
                buyingCosts: {
                  type: "object",
                  properties: {
                    stampDutyEstimate: { type: "number" },
                    legalAndConveyancingEstimate: { type: "number" },
                    inspectionsEstimate: { type: "number" },
                    totalUpfrontEstimate: { type: "number" }
                  }
                },
                ongoingCosts: {
                  type: "object",
                  properties: {
                    councilRatesAnnualEstimate: { type: "number" },
                    waterRatesAnnualEstimate: { type: "number" },
                    insuranceAnnualEstimate: { type: "number" },
                    strataLeviesAnnualEstimate: { type: "number" },
                    maintenanceAnnualEstimate: { type: "number" }
                  }
                },
                affordabilitySummary: { type: "string" }
              }
            },
            lifestyleReality: {
              type: "object",
              properties: {
                commuteToCBD: { type: "string" },
                walkabilitySummary: { type: "string" },
                noiseExposure: { type: "string" },
                familyFriendliness: { type: "string" },
                weekendLifestyle: { type: "string" },
                summary: { type: "string" }
              }
            },
            nextSteps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  whyItMatters: { type: "string" },
                  priority: { type: "string" }
                }
              }
            },
            valueAddStrategies: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  effort: { type: "string" },
                  impact: { type: "string" },
                  planningPathway: { type: "string" },
                  planningNotes: { type: "string" },
                  estimatedCost: {
                    type: "object",
                    properties: {
                      low: { type: "number" },
                      high: { type: "number" },
                      costNotes: { type: "string" }
                    }
                  },
                  estimatedUplift: {
                    type: "object",
                    properties: {
                      low: { type: "number" },
                      high: { type: "number" },
                      upliftNotes: { type: "string" }
                    }
                  },
                  saleProfitEstimate: {
                    type: "object",
                    properties: {
                      low: { type: "number" },
                      high: { type: "number" }
                    }
                  },
                  timeframeWeeks: {
                    type: "object",
                    properties: {
                      low: { type: "number" },
                      high: { type: "number" }
                    }
                  },
                  tradeBreakdown: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        trade: { type: "string" },
                        low: { type: "number" },
                        high: { type: "number" },
                        notes: { type: "string" }
                      }
                    }
                  }
                }
              }
            },
            developmentScenarios: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  scenarioType: { type: "string" },
                  eligibility: { type: "string" },
                  planningPathway: { type: "string" },
                  description: { type: "string" },
                  whyAllowedOrNot: { type: "string" },
                  indicativeYield: {
                    type: "object",
                    properties: {
                      dwellings: { type: "integer" },
                      bedroomsTypical: { type: "string" }
                    }
                  },
                  estimatedCost: {
                    type: "object",
                    properties: { low: { type: "number" }, high: { type: "number" } }
                  },
                  estimatedEndValue: {
                    type: "object",
                    properties: { low: { type: "number" }, high: { type: "number" } }
                  },
                  estimatedNetProfit: {
                    type: "object",
                    properties: { low: { type: "number" }, high: { type: "number" } }
                  },
                  timeframeWeeks: {
                    type: "object",
                    properties: { low: { type: "number" }, high: { type: "number" } }
                  },
                  keyConstraints: { type: "array", items: { type: "string" } },
                  keyRisks: { type: "array", items: { type: "string" } },
                  confidenceLevel: { type: "string" }
                }
              }
            },
            highestBestUse: {
              type: "object",
              properties: {
                bestScenarioTitle: { type: "string" },
                bestBy: { type: "string" },
                rationale: { type: "string" }
              }
            },
            localAreaIntel: {
              type: "object",
              properties: {
                schools: {
                  type: "object",
                  properties: {
                    primary: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          type: { type: "string" },
                          distanceKm: { type: "number" },
                          approxCatchment: { type: "string" },
                          ratingHint: { type: "string" },
                          sourceUrl: { type: "string" }
                        }
                      }
                    },
                    secondary: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          type: { type: "string" },
                          distanceKm: { type: "number" },
                          approxCatchment: { type: "string" },
                          ratingHint: { type: "string" },
                          sourceUrl: { type: "string" }
                        }
                      }
                    }
                  }
                },
                transport: {
                  type: "object",
                  properties: {
                    trainStations: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          lineOrNetwork: { type: "string" },
                          distanceKm: { type: "number" },
                          typicalTravelTimeToCBD: { type: "string" },
                          sourceUrl: { type: "string" }
                        }
                      }
                    },
                    busStops: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          routes: { type: "array", items: { type: "string" } },
                          distanceKm: { type: "number" },
                          sourceUrl: { type: "string" }
                        }
                      }
                    }
                  }
                },
                lifestyleSummary: { type: "string" }
              }
            },
            portfolioSelloutSummary: {
              type: "object",
              properties: {
                bestStrategyByProfit: { type: "string" },
                estimatedNetProfitRange: {
                  type: "object",
                  properties: {
                    low: { type: "number" },
                    high: { type: "number" }
                  }
                },
                selloutExplanation: { type: "string" }
              }
            },
            watchOuts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  severity: { type: "string" },
                  impact: { type: "string" },
                  consequence: { type: "string" }
                }
              }
            },
            investmentVerdict: { type: "string" },
            localMarketVibe: { type: "string" },
            sharePrompt: {
              type: "object",
              properties: {
                headline: { type: "string" },
                message: { type: "string" },
                ctaLabel: { type: "string" }
              }
            }
          }
        }
      },
    });

    let text = response.text || '';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const data = JSON.parse(text);
    const sources = [];
    const candidates = response.candidates;
    const chunks = candidates?.[0]?.groundingMetadata?.groundingChunks;

    if (chunks) {
      chunks.forEach((chunk) => {
        if (chunk.web) sources.push({ title: chunk.web.title || "Market Source", url: chunk.web.uri });
      });
    }
    data.sources = sources;

    res.json(data);
  } catch (error) {
    console.error("Property audit error:", error);
    res.status(500).json({ error: error.message || 'Failed to generate property audit' });
  }
}

