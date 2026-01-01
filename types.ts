export interface ValueAddStrategy {
  title: string;
  description: string;
  effort: 'Low' | 'Medium' | 'High';
  impact: 'High' | 'Medium' | 'Low';
  planningPathway: 'Exempt' | 'CDC' | 'DA' | 'Unknown';
  planningNotes: string;
  estimatedCost: {
    low: number;
    high: number;
    costNotes: string;
  };
  estimatedUplift: {
    low: number;
    high: number;
    upliftNotes: string;
  };
  indicativeEquityUplift: {
    low: number;
    high: number;
  };
  saleProfitEstimate: {
    low: number;
    high: number;
  };
  timeframeWeeks: {
    low: number;
    high: number;
  };
  tradeBreakdown: {
    trade: string;
    low: number;
    high: number;
    notes: string;
  }[];
}

export type DevEligibility = 'Allowed' | 'Likely' | 'Uncertain' | 'Not Allowed';

export interface MoneyRange {
  low?: number;
  high?: number;
}

export interface WeekRange {
  low?: number;
  high?: number;
}

export interface DevelopmentScenario {
  title: string;
  scenarioType: 'Knockdown' | 'Duplex' | 'Townhouse';
  eligibility: DevEligibility;
  planningPathway: 'Exempt' | 'CDC' | 'DA' | 'Unknown';
  description: string;
  whyAllowedOrNot: string;
  indicativeYield?: {
    dwellings?: number;
    bedroomsTypical?: string;
  };
  estimatedCost?: MoneyRange;
  estimatedEndValue?: MoneyRange;
  estimatedNetProfit?: MoneyRange;
  marginPercent?: MoneyRange;
  timeframeWeeks?: WeekRange;
  keyConstraints?: string[];
  keyRisks?: string[];
  confidenceLevel?: 'High' | 'Medium' | 'Low';
  sources?: { title: string; url: string }[];
}

export interface HighestBestUseSummary {
  bestScenarioTitle?: string;
  bestBy?: 'NetProfit' | 'EndValue' | 'Feasibility';
  rationale?: string;
}

export interface PortfolioSelloutSummary {
  bestStrategyByProfit: string;
  estimatedNetProfitRange: {
    low: number;
    high: number;
  };
  selloutExplanation: string;
}

export interface WatchOut {
  title: string;
  description: string;
  severity: 'Warning' | 'Critical' | 'Info';
  impact: 'Low' | 'Medium' | 'High';
  consequence: string;
}

export interface ValueSnapshot {
  estimateMin: number;
  estimateMax: number;
  indicativeMidpoint: number;
  yield: string;
  growth: string;
  confidenceLevel: 'High' | 'Medium' | 'Low';
}

export interface RentalPosition {
  estimatedWeeklyRent?: number;
  estimatedAnnualRent?: number;
  grossYieldPercent?: number;
  estimatedCashPositionWeekly?: number;
  gearingStatus?: 'Positively Geared' | 'Negatively Geared' | 'Neutral';
  repaymentAssumptionNotes?: string;
}

export interface ZoningInfo {
  code: string;
  title: string;
  description: string;
  recommendation: string;
}

export interface ApprovalPathway {
  likelyPathway: 'Exempt' | 'CDC' | 'DA' | 'Mixed/Depends' | 'Unknown';
  explanation: string;
  typicalTriggers: string[];
  docsToConfirm: string[];
  estimatedApprovalTimeWeeks: {
    low: number;
    high: number;
  };
}

export interface ZoningIntel {
  currentZoneCode: string;
  currentZoneTitle: string;
  whatItMeans: string;
  recentChanges: {
    date: string;
    changeTitle: string;
    summary: string;
    impactOnOwner: string;
  }[];
  confidence: 'High' | 'Medium' | 'Low';
}

export interface ComparableSale {
  addressShort: string;
  date: string;
  price: number;
  beds?: number;
  baths?: number;
  cars?: number;
  distanceKm?: number;
  notes: string;
  sourceUrl: string;
}

export interface ComparableSales {
  subjectLastSale: {
    date: string;
    price: number;
    sourceUrl: string;
  } | null;
  sameBuildingSales: {
    unitLabel: string;
    date: string;
    price: number;
    notes: string;
    sourceUrl: string;
  }[];
  nearbySales: ComparableSale[];
  pricingContextSummary: string;
}

export interface TrueCostToOwn {
  assumptions: {
    interestRatePercent: number;
    loanTermYears: number;
    depositPercent: number;
  };
  mortgageWeeklyEstimate: number;
  mortgageMonthlyEstimate: number;
  buyingCosts: {
    stampDutyEstimate: number;
    legalAndConveyancingEstimate: number;
    inspectionsEstimate: number;
    totalUpfrontEstimate: number;
  };
  ongoingCosts: {
    councilRatesAnnualEstimate: number;
    waterRatesAnnualEstimate: number;
    insuranceAnnualEstimate: number;
    strataLeviesAnnualEstimate: number;
    maintenanceAnnualEstimate: number;
  };
  affordabilitySummary: string;
}

export interface NextStep {
  title: string;
  whyItMatters: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface LifestyleReality {
  commuteToCBD: string;
  walkabilitySummary: string;
  noiseExposure: 'Low' | 'Medium' | 'High';
  familyFriendliness: 'Low' | 'Medium' | 'High';
  weekendLifestyle: string;
  summary: string;
}

export interface SharePrompt {
  headline: string;
  message: string;
  ctaLabel: string;
}

export interface Amenity {
  name: string;
  distance: string;
  type: 'transport' | 'shopping' | 'education' | 'leisure';
}

export interface LocalAreaIntel {
  schools?: {
    primary?: Array<{
      name: string;
      type?: 'Public' | 'Private' | 'Catholic' | 'Other';
      distanceKm?: number;
      approxCatchment?: string;
      ratingHint?: string;
      sourceUrl?: string;
    }>;
    secondary?: Array<{
      name: string;
      type?: 'Public' | 'Private' | 'Catholic' | 'Other';
      distanceKm?: number;
      approxCatchment?: string;
      ratingHint?: string;
      sourceUrl?: string;
    }>;
  };
  transport?: {
    trainStations?: Array<{
      name: string;
      lineOrNetwork?: string;
      distanceKm?: number;
      typicalTravelTimeToCBD?: string;
      sourceUrl?: string;
    }>;
    busStops?: Array<{
      name: string;
      routes?: string[];
      distanceKm?: number;
      sourceUrl?: string;
    }>;
  };
  lifestyleSummary?: string;
}

export interface SitePlanData {
  width: string;
  depth: string;
  frontage: string;
  siteCoverage: string;
  setbacks: {
    front: string;
    side: string;
    rear: string;
  };
  neighborProximity: string;
}

export interface PropertyData {
  address: string;
  propertyType: string;
  landSize: string;
  attributes: {
    beds: number;
    baths: number;
    cars: number;
  };
  sitePlan: SitePlanData;
  zoning: ZoningInfo;
  proximity: Amenity[];
  valueSnapshot: ValueSnapshot;
  rentalPosition?: RentalPosition;
  confidenceReasons: string[];
  approvalPathway: ApprovalPathway;
  zoningIntel: ZoningIntel;
  comparableSales: ComparableSales;
  trueCostToOwn: TrueCostToOwn;
  lifestyleReality: LifestyleReality;
  nextSteps: NextStep[];
  valueAddStrategies: ValueAddStrategy[];
  developmentScenarios?: DevelopmentScenario[];
  highestBestUse?: HighestBestUseSummary;
  localAreaIntel?: LocalAreaIntel;
  portfolioSelloutSummary: PortfolioSelloutSummary;
  watchOuts: WatchOut[];
  investmentVerdict: string;
  localMarketVibe: string;
  sharePrompt: SharePrompt;
  sources: { title: string; url: string }[];
}

// New pricing model plan types
export type PlanType = 'FREE_TRIAL' | 'PRO' | 'STARTER_PACK' | 'BULK_PACK' | 'UNLIMITED_PRO';

// Credit system types
export interface CreditState {
  freeUsed: number;           // prop_free_used - lifetime free audits used
  hasAccount: boolean;        // prop_has_account - gives +1 bonus (total 2 free)
  creditTopups: number;       // prop_credit_topups - purchased credits remaining
  plan: PlanType;             // prop_plan
  proMonth: string;           // prop_pro_month - YYYY-MM for PRO subscription
  proUsed: number;            // prop_pro_used - audits used this month (PRO only)
}

export enum AppState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  RESULTS = 'RESULTS',
  ERROR = 'ERROR',
  LIMIT_REACHED = 'LIMIT_REACHED'
}

// Extend Window interface for AI Studio integration
declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey?: () => Promise<boolean>;
      openSelectKey?: () => Promise<void>;
    };
  }
}