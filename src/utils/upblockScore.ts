// Upblock Deal Score Utility
// Calculates a composite investment score (0-100) based on yield, cash flow, uplift, and constraints

// ============ TYPES ============

export type ConstraintSeverity = "low" | "medium" | "high";

export type ConstraintFlag = {
  key: string;
  label: string;
  severity: ConstraintSeverity;
};

export type UpliftScenario = {
  conservative?: number; // absolute $ uplift (can be negative)
  base?: number;         // absolute $ uplift
  upside?: number;       // absolute $ uplift
};

export type ScoreInputs = {
  purchasePrice?: number;     // $ value (estimated market value / indicativeMidpoint)
  askingPrice?: number;       // $ value (current listing price from realestate.com.au/Domain)
  annualRent?: number;        // $ per year
  annualExpenses?: number;    // $ per year (optional)
  annualDebtService?: number; // $ per year mortgage interest+principal (optional)
  cashFlowAnnual?: number;    // if already computed, use this
  cashFlowWeekly?: number;    // weekly cash position (will be converted to annual)
  yieldPercent?: number;      // if already computed (gross yield %)
  uplift?: UpliftScenario;    // uplift scenario in $
  constraints?: ConstraintFlag[];
};

export type SubScore = {
  name: "yield" | "cashFlow" | "uplift" | "constraints" | "value";
  score: number;              // 0–100
  label: string;              // Strong/OK/Weak etc
  detail: string;             // explanation for UI tooltip
};

export type ScoreResult = {
  score: number;              // 0–100 (rounded)
  scoreRange?: { low: number; high: number }; // when confidence low
  confidence: number;         // 0–1
  confidenceLabel: "Low" | "Medium" | "High";
  subs: SubScore[];
  drivers: { positive: SubScore[]; negative: SubScore[] }; // top 2 best/worst
};

// ============ HELPERS ============

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function roundInt(n: number): number {
  return Math.round(n);
}

function safeNumber(val: unknown): number | undefined {
  if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
    return val;
  }
  return undefined;
}

// ============ WEIGHTS (configurable) ============

const WEIGHTS = {
  value: 0.20,       // Price vs estimated value - critical for deal quality
  cashFlow: 0.30,
  yield: 0.20,
  uplift: 0.20,
  constraints: 0.10,
};

// ============ SUB-SCORE CALCULATIONS ============

function computeYieldSubScore(inputs: ScoreInputs): { score: number; yieldPct?: number; isNet: boolean; available: boolean } {
  // If yield percent is directly provided, use it
  if (inputs.yieldPercent !== undefined) {
    const yieldPct = inputs.yieldPercent;
    return { score: mapYieldToScore(yieldPct), yieldPct, isNet: false, available: true };
  }

  // Otherwise calculate from rent and price
  const price = safeNumber(inputs.purchasePrice);
  const rent = safeNumber(inputs.annualRent);
  const expenses = safeNumber(inputs.annualExpenses);

  if (!price || !rent || price <= 0) {
    return { score: 55, available: false, isNet: false }; // neutral if missing
  }

  // Net yield if expenses available, else gross
  const isNet = expenses !== undefined;
  const netRent = isNet ? rent - (expenses || 0) : rent;
  const yieldPct = (netRent / price) * 100;

  return { score: mapYieldToScore(yieldPct), yieldPct, isNet, available: true };
}

function mapYieldToScore(yieldPct: number): number {
  if (yieldPct < 2) return 10;
  if (yieldPct < 3) return 30;
  if (yieldPct < 4) return 55;
  if (yieldPct < 5) return 75;
  if (yieldPct < 6) return 88;
  return 95;
}

function getYieldLabel(score: number): string {
  if (score >= 75) return "Strong";
  if (score >= 45) return "OK";
  return "Weak";
}

function computeCashFlowSubScore(inputs: ScoreInputs): { score: number; weeklyFlow?: number; available: boolean } {
  let annual: number | undefined;

  // Priority: use provided cashFlowAnnual
  if (inputs.cashFlowAnnual !== undefined) {
    annual = inputs.cashFlowAnnual;
  }
  // Or convert from weekly
  else if (inputs.cashFlowWeekly !== undefined) {
    annual = inputs.cashFlowWeekly * 52;
  }
  // Or compute from components
  else {
    const rent = safeNumber(inputs.annualRent);
    const expenses = safeNumber(inputs.annualExpenses);
    const debt = safeNumber(inputs.annualDebtService);
    
    if (rent !== undefined) {
      annual = rent - (expenses || 0) - (debt || 0);
    }
  }

  if (annual === undefined) {
    return { score: 55, available: false }; // neutral if missing
  }

  const weekly = annual / 52;
  return { score: mapCashFlowToScore(weekly), weeklyFlow: weekly, available: true };
}

function mapCashFlowToScore(weekly: number): number {
  if (weekly >= 200) return 95;
  if (weekly >= 50) return 80;
  if (weekly >= -49) return 65;
  if (weekly >= -199) return 40;
  if (weekly >= -499) return 20;
  return 10;
}

function getCashFlowLabel(score: number): string {
  if (score >= 75) return "Strong";
  if (score >= 45) return "OK";
  return "Weak";
}

function computeUpliftSubScore(inputs: ScoreInputs): { score: number; basePct?: number; conservativePct?: number; available: boolean } {
  const price = safeNumber(inputs.purchasePrice);
  const base = safeNumber(inputs.uplift?.base);
  const conservative = safeNumber(inputs.uplift?.conservative);

  if (!price || price <= 0 || base === undefined) {
    return { score: 55, available: false }; // neutral if missing
  }

  const basePct = (base / price) * 100;
  const conservativePct = conservative !== undefined ? (conservative / price) * 100 : undefined;

  let score = mapUpliftToScore(basePct);

  // Penalize if conservative scenario is negative
  if (conservativePct !== undefined && conservativePct < 0) {
    if (conservativePct >= -5) score -= 10;
    else if (conservativePct >= -10) score -= 18;
    else score -= 25;
  }

  return { score: clamp(score, 0, 100), basePct, conservativePct, available: true };
}

function mapUpliftToScore(basePct: number): number {
  if (basePct <= 0) return 35;
  if (basePct <= 5) return 55;
  if (basePct <= 10) return 70;
  if (basePct <= 20) return 85;
  return 95;
}

function getUpliftLabel(score: number): string {
  if (score >= 75) return "Strong";
  if (score >= 45) return "OK";
  return "Weak";
}

function computeConstraintsSubScore(inputs: ScoreInputs): { score: number; flags: ConstraintFlag[]; available: boolean } {
  const constraints = inputs.constraints;

  if (!constraints || constraints.length === 0) {
    // Unknown constraints - moderate score with reduced confidence
    return { score: 60, flags: [], available: false };
  }

  let penalty = 0;
  for (const c of constraints) {
    switch (c.severity) {
      case "high": penalty += 22; break;
      case "medium": penalty += 12; break;
      case "low": penalty += 6; break;
    }
  }

  return { score: clamp(100 - penalty, 0, 100), flags: constraints, available: true };
}

function getConstraintsLabel(score: number): string {
  if (score >= 75) return "Few Issues";
  if (score >= 45) return "Some Issues";
  return "Major Issues";
}

// ============ VALUE (PRICE PREMIUM) SUB-SCORE ============

function computeValueSubScore(inputs: ScoreInputs): { score: number; premiumPct?: number; available: boolean } {
  const estimatedValue = safeNumber(inputs.purchasePrice);
  const askingPrice = safeNumber(inputs.askingPrice);

  // If no asking price available, return neutral score
  if (askingPrice === undefined || estimatedValue === undefined || estimatedValue === 0) {
    return { score: 60, available: false };
  }

  // Calculate premium percentage: (asking - estimated) / estimated * 100
  const premiumPct = ((askingPrice - estimatedValue) / estimatedValue) * 100;

  let score: number;

  if (premiumPct >= 40) {
    // 40%+ above market: Deal breaker - terrible value
    score = 5;
  } else if (premiumPct >= 30) {
    // 30-40% above market: Very poor value
    score = 15;
  } else if (premiumPct >= 20) {
    // 20-30% above market: Poor value
    score = 30;
  } else if (premiumPct >= 10) {
    // 10-20% above market: Below average value
    score = 50;
  } else if (premiumPct >= 0) {
    // 0-10% above market: Fair value
    score = 70;
  } else if (premiumPct >= -10) {
    // 0-10% below market: Good value
    score = 85;
  } else if (premiumPct >= -20) {
    // 10-20% below market: Great value
    score = 95;
  } else {
    // 20%+ below market: Exceptional value (or suspicious)
    score = 100;
  }

  return { score, premiumPct, available: true };
}

function getValueLabel(score: number): string {
  if (score >= 85) return "Great Value";
  if (score >= 70) return "Fair";
  if (score >= 50) return "Overpriced";
  if (score >= 30) return "Poor Value";
  return "Avoid";
}

// ============ MAIN SCORING FUNCTION ============

export function computeUpblockScore(inputs: ScoreInputs): ScoreResult {
  // Compute all sub-scores
  const valueResult = computeValueSubScore(inputs);
  const yieldResult = computeYieldSubScore(inputs);
  const cashFlowResult = computeCashFlowSubScore(inputs);
  const upliftResult = computeUpliftSubScore(inputs);
  const constraintsResult = computeConstraintsSubScore(inputs);

  // Build sub-score objects - use "Unknown" label when data is missing
  const valueSub: SubScore = {
    name: "value",
    score: valueResult.score,
    label: valueResult.available ? getValueLabel(valueResult.score) : "Unknown",
    detail: valueResult.available
      ? valueResult.premiumPct !== undefined
        ? valueResult.premiumPct >= 0
          ? `Asking ${valueResult.premiumPct.toFixed(0)}% above estimated value`
          : `Asking ${Math.abs(valueResult.premiumPct).toFixed(0)}% below estimated value`
        : "Price comparison available"
      : "No asking price available",
  };

  const yieldSub: SubScore = {
    name: "yield",
    score: yieldResult.score,
    label: yieldResult.available ? getYieldLabel(yieldResult.score) : "Unknown",
    detail: yieldResult.available
      ? `${yieldResult.isNet ? "Net" : "Gross"} yield: ${yieldResult.yieldPct?.toFixed(1)}% (comparable rentals)`
      : "Missing inputs",
  };

  const cashFlowSub: SubScore = {
    name: "cashFlow",
    score: cashFlowResult.score,
    label: cashFlowResult.available ? getCashFlowLabel(cashFlowResult.score) : "Unknown",
    detail: cashFlowResult.available
      ? `${cashFlowResult.weeklyFlow! >= 0 ? "+" : ""}$${Math.round(cashFlowResult.weeklyFlow!)}/wk (80% LVR, P&I)`
      : "Missing inputs",
  };

  const upliftSub: SubScore = {
    name: "uplift",
    score: upliftResult.score,
    label: upliftResult.available ? getUpliftLabel(upliftResult.score) : "Unknown",
    detail: upliftResult.available
      ? `Base uplift: ${upliftResult.basePct?.toFixed(0)}%${upliftResult.conservativePct !== undefined ? ` (conservative: ${upliftResult.conservativePct.toFixed(0)}%)` : ""}`
      : "Missing inputs",
  };

  const constraintsSub: SubScore = {
    name: "constraints",
    score: constraintsResult.score,
    label: constraintsResult.available ? getConstraintsLabel(constraintsResult.score) : "Unknown",
    detail: constraintsResult.available
      ? constraintsResult.flags.length > 0
        ? constraintsResult.flags.slice(0, 3).map(f => f.label).join(", ")
        : "No major constraints"
      : "No constraint data provided",
  };

  const subs: SubScore[] = [valueSub, yieldSub, cashFlowSub, upliftSub, constraintsSub];

  // Calculate weighted score
  const weightedScore =
    valueSub.score * WEIGHTS.value +
    yieldSub.score * WEIGHTS.yield +
    cashFlowSub.score * WEIGHTS.cashFlow +
    upliftSub.score * WEIGHTS.uplift +
    constraintsSub.score * WEIGHTS.constraints;

  const score = roundInt(weightedScore);

  // Calculate confidence
  let confidence = 0;
  if (valueResult.available) confidence += 0.20;
  if (yieldResult.available) confidence += 0.20;
  if (cashFlowResult.available) confidence += 0.20;
  if (upliftResult.available) confidence += 0.20;
  if (constraintsResult.available) confidence += 0.20;
  confidence = clamp(confidence, 0, 1);

  const confidenceLabel: "Low" | "Medium" | "High" =
    confidence >= 0.75 ? "High" : confidence >= 0.5 ? "Medium" : "Low";

  // Score range for low confidence
  let scoreRange: { low: number; high: number } | undefined;
  if (confidence < 0.75) {
    const spread = roundInt((0.75 - confidence) * 20);
    scoreRange = {
      low: clamp(score - spread, 0, 100),
      high: clamp(score + spread, 0, 100),
    };
  }

  // Determine drivers (top 2 positive, bottom 2 negative)
  const sortedSubs = [...subs].sort((a, b) => b.score - a.score);
  const positive = sortedSubs.slice(0, 2);
  const negative = sortedSubs.slice(-2).reverse();

  return {
    score,
    scoreRange,
    confidence,
    confidenceLabel,
    subs,
    drivers: { positive, negative },
  };
}

// Helper to convert PropertyAnalysis data to ScoreInputs
export function mapPropertyDataToScoreInputs(data: {
  valueSnapshot?: { 
    indicativeMidpoint?: number;
    askingPrice?: number;
  };
  rentalPosition?: {
    grossYieldPercent?: number;
    estimatedAnnualRent?: number;
    estimatedCashPositionWeekly?: number;
  };
  valueAddStrategies?: Array<{
    estimatedUplift?: { low?: number; high?: number };
    saleProfitEstimate?: { low?: number; high?: number };
  }>;
  developmentScenarios?: Array<{
    estimatedNetProfit?: { low?: number; high?: number };
    keyConstraints?: string[];
    keyRisks?: string[];
  }>;
  watchOuts?: Array<{
    title: string;
    severity: 'Warning' | 'Critical' | 'Info';
  }>;
}): ScoreInputs {
  const purchasePrice = data.valueSnapshot?.indicativeMidpoint;
  const askingPrice = data.valueSnapshot?.askingPrice;
  
  // Yield and rent
  const yieldPercent = data.rentalPosition?.grossYieldPercent;
  const annualRent = data.rentalPosition?.estimatedAnnualRent;
  const cashFlowWeekly = data.rentalPosition?.estimatedCashPositionWeekly;

  // Calculate uplift from strategies
  let uplift: UpliftScenario | undefined;
  
  // First check value-add strategies
  if (data.valueAddStrategies && data.valueAddStrategies.length > 0) {
    const allUplifts = data.valueAddStrategies
      .map(s => s.estimatedUplift || s.saleProfitEstimate)
      .filter(Boolean);
    
    if (allUplifts.length > 0) {
      const avgLow = allUplifts.reduce((sum, u) => sum + (u?.low || 0), 0) / allUplifts.length;
      const avgHigh = allUplifts.reduce((sum, u) => sum + (u?.high || 0), 0) / allUplifts.length;
      uplift = {
        conservative: avgLow,
        base: (avgLow + avgHigh) / 2,
        upside: avgHigh,
      };
    }
  }
  
  // Or use development scenarios
  if (!uplift && data.developmentScenarios && data.developmentScenarios.length > 0) {
    const profits = data.developmentScenarios
      .map(s => s.estimatedNetProfit)
      .filter(Boolean);
    
    if (profits.length > 0) {
      const avgLow = profits.reduce((sum, p) => sum + (p?.low || 0), 0) / profits.length;
      const avgHigh = profits.reduce((sum, p) => sum + (p?.high || 0), 0) / profits.length;
      uplift = {
        conservative: avgLow,
        base: (avgLow + avgHigh) / 2,
        upside: avgHigh,
      };
    }
  }

  // Build constraints from various sources
  const constraints: ConstraintFlag[] = [];
  
  // From development scenarios
  if (data.developmentScenarios) {
    for (const scenario of data.developmentScenarios) {
      if (scenario.keyConstraints) {
        for (const c of scenario.keyConstraints) {
          constraints.push({
            key: c.toLowerCase().replace(/\s+/g, '_'),
            label: c,
            severity: "medium", // default to medium
          });
        }
      }
      if (scenario.keyRisks) {
        for (const r of scenario.keyRisks) {
          constraints.push({
            key: r.toLowerCase().replace(/\s+/g, '_'),
            label: r,
            severity: "medium",
          });
        }
      }
    }
  }
  
  // From watch-outs
  if (data.watchOuts) {
    for (const w of data.watchOuts) {
      constraints.push({
        key: w.title.toLowerCase().replace(/\s+/g, '_'),
        label: w.title,
        severity: w.severity === 'Critical' ? 'high' : w.severity === 'Warning' ? 'medium' : 'low',
      });
    }
  }

  return {
    purchasePrice,
    askingPrice,
    yieldPercent,
    annualRent,
    cashFlowWeekly,
    uplift,
    constraints: constraints.length > 0 ? constraints : undefined,
  };
}

