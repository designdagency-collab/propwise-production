// ABS Data API Service
// Fetches real Australian statistics from the Australian Bureau of Statistics
// API Documentation: https://www.abs.gov.au/about/data-services/application-programming-interfaces-apis/data-api-user-guide/using-api
// No API key required as of November 2024

const ABS_API_BASE = 'https://api.data.abs.gov.au';

// LGA name to code mapping for major Australian areas
// Source: ABS ASGS LGA codes
const LGA_CODES: Record<string, string> = {
  // NSW
  'sydney': 'LGA17200',
  'north sydney': 'LGA15350',
  'parramatta': 'LGA15900',
  'blacktown': 'LGA10750',
  'penrith': 'LGA16350',
  'liverpool': 'LGA14900',
  'campbelltown': 'LGA11500',
  'canterbury-bankstown': 'LGA11570',
  'randwick': 'LGA16550',
  'waverley': 'LGA18500',
  'woollahra': 'LGA18700',
  'mosman': 'LGA15240',
  'inner west': 'LGA14170',
  'burwood': 'LGA11300',
  'strathfield': 'LGA17420',
  'ryde': 'LGA16700',
  'hornsby': 'LGA14000',
  'ku-ring-gai': 'LGA14500',
  'northern beaches': 'LGA15990',
  'sutherland': 'LGA17150',
  'wollongong': 'LGA18450',
  'newcastle': 'LGA15900',
  'lake macquarie': 'LGA14650',
  'central coast': 'LGA11650',
  'blue mountains': 'LGA10900',
  // VIC
  'melbourne': 'LGA24600',
  'yarra': 'LGA27350',
  'port phillip': 'LGA26350',
  'stonnington': 'LGA26890',
  'boroondara': 'LGA21110',
  'glen eira': 'LGA22830',
  'bayside': 'LGA20910',
  'kingston': 'LGA24330',
  'monash': 'LGA25060',
  'whitehorse': 'LGA27450',
  'manningham': 'LGA24650',
  'banyule': 'LGA20660',
  'darebin': 'LGA22170',
  'moreland': 'LGA25250',
  'moonee valley': 'LGA25150',
  'maribyrnong': 'LGA24780',
  'hobsons bay': 'LGA23670',
  'wyndham': 'LGA27260',
  'casey': 'LGA21610',
  'frankston': 'LGA22620',
  'mornington peninsula': 'LGA25340',
  'geelong': 'LGA22750',
  // QLD
  'brisbane': 'LGA31000',
  'gold coast': 'LGA33430',
  'sunshine coast': 'LGA36720',
  'moreton bay': 'LGA35010',
  'logan': 'LGA34590',
  'ipswich': 'LGA33980',
  'redland': 'LGA36250',
  'toowoomba': 'LGA36910',
  'cairns': 'LGA31500',
  'townsville': 'LGA37010',
  // SA
  'adelaide': 'LGA40070',
  'charles sturt': 'LGA41040',
  'port adelaide enfield': 'LGA46630',
  'salisbury': 'LGA47510',
  'tea tree gully': 'LGA48350',
  'onkaparinga': 'LGA45340',
  'marion': 'LGA44920',
  'holdfast bay': 'LGA43550',
  'mitcham': 'LGA45080',
  'burnside': 'LGA40700',
  'norwood payneham st peters': 'LGA45290',
  'unley': 'LGA48510',
  // WA
  'perth': 'LGA57280',
  'stirling': 'LGA58410',
  'joondalup': 'LGA55820',
  'wanneroo': 'LGA59250',
  'cockburn': 'LGA52980',
  'melville': 'LGA56630',
  'fremantle': 'LGA53630',
  'south perth': 'LGA58290',
  'canning': 'LGA52470',
  'gosnells': 'LGA54160',
  'rockingham': 'LGA58050',
  'mandurah': 'LGA56140',
  // TAS
  'hobart': 'LGA62810',
  'launceston': 'LGA64010',
  'glenorchy': 'LGA62410',
  'clarence': 'LGA62110',
  // ACT
  'canberra': 'LGA89399',
  // NT
  'darwin': 'LGA70200',
  'palmerston': 'LGA71100',
};

// Greater Capital City Statistical Area codes
const GCCSA_CODES: Record<string, string> = {
  'sydney': '1GSYD',
  'melbourne': '2GMEL',
  'brisbane': '3GBRI',
  'adelaide': '4GADE',
  'perth': '5GPER',
  'hobart': '6GHOB',
  'darwin': '7GDAR',
  'canberra': '8ACTE',
};

// State codes
const STATE_CODES: Record<string, string> = {
  'nsw': '1',
  'new south wales': '1',
  'vic': '2',
  'victoria': '2',
  'qld': '3',
  'queensland': '3',
  'sa': '4',
  'south australia': '4',
  'wa': '5',
  'western australia': '5',
  'tas': '6',
  'tasmania': '6',
  'nt': '7',
  'northern territory': '7',
  'act': '8',
  'australian capital territory': '8',
};

export interface ABSSuburbData {
  medianPrice?: number;
  medianPriceSource?: string;
  medianPriceDate?: string;
  priceGrowth?: number;
  priceGrowthPeriod?: string;
  medianIncome?: number;
  populationDensity?: number;
  ownerOccupied?: number;
  rented?: number;
  confidence: 'High' | 'Medium' | 'Low';
  errors?: string[];
}

/**
 * Extract suburb and state from an Australian address
 */
export function parseAddress(address: string): { suburb: string; state: string; postcode?: string } {
  const normalized = address.toLowerCase().trim();
  
  // Common patterns for Australian addresses
  // e.g., "123 Smith St, Parramatta NSW 2150"
  // e.g., "123 Smith Street, Parramatta, NSW, 2150"
  
  // Try to extract postcode
  const postcodeMatch = normalized.match(/\b(\d{4})\b/);
  const postcode = postcodeMatch ? postcodeMatch[1] : undefined;
  
  // Try to extract state
  let state = '';
  for (const [stateName, stateCode] of Object.entries(STATE_CODES)) {
    if (normalized.includes(stateName)) {
      state = stateName;
      break;
    }
  }
  
  // Extract suburb - typically before state/postcode
  // Remove street number and name, keep suburb
  const parts = normalized
    .replace(/\d{4}/, '') // Remove postcode
    .replace(/\b(nsw|vic|qld|sa|wa|tas|nt|act|new south wales|victoria|queensland|south australia|western australia|tasmania|northern territory|australian capital territory)\b/gi, '')
    .replace(/\b(street|st|road|rd|avenue|ave|drive|dr|court|ct|place|pl|lane|ln|crescent|cres|way|parade|pde|highway|hwy|boulevard|blvd)\b/gi, '')
    .split(/[,\s]+/)
    .filter(p => p.length > 2 && !/^\d+$/.test(p));
  
  // The suburb is usually the last meaningful word before state/postcode
  // Or for simple addresses, it might be recognizable
  let suburb = '';
  
  // Check if any part matches a known LGA
  for (const part of parts.reverse()) {
    const lgaKey = part.toLowerCase();
    if (LGA_CODES[lgaKey] || GCCSA_CODES[lgaKey]) {
      suburb = part;
      break;
    }
  }
  
  // If no direct match, use the last meaningful part
  if (!suburb && parts.length > 0) {
    suburb = parts[0]; // Already reversed, so this is the last original part
  }
  
  return { suburb, state, postcode };
}

/**
 * Get LGA code from suburb name
 */
export function getLGACode(suburb: string): string | undefined {
  const normalized = suburb.toLowerCase().trim();
  return LGA_CODES[normalized];
}

/**
 * Get Greater Capital City code from suburb/city name
 */
export function getGCCSACode(suburb: string): string | undefined {
  const normalized = suburb.toLowerCase().trim();
  
  // Direct match
  if (GCCSA_CODES[normalized]) {
    return GCCSA_CODES[normalized];
  }
  
  // Check if suburb is in a known capital city area
  // This is a simplified mapping - in practice you'd use postcode lookups
  const capitalCityMapping: Record<string, string> = {
    // Sydney suburbs
    'parramatta': '1GSYD',
    'blacktown': '1GSYD',
    'penrith': '1GSYD',
    'liverpool': '1GSYD',
    'randwick': '1GSYD',
    'bondi': '1GSYD',
    'chatswood': '1GSYD',
    'manly': '1GSYD',
    'cronulla': '1GSYD',
    // Melbourne suburbs
    'st kilda': '2GMEL',
    'south yarra': '2GMEL',
    'richmond': '2GMEL',
    'fitzroy': '2GMEL',
    'brunswick': '2GMEL',
    'footscray': '2GMEL',
    // Brisbane suburbs
    'south brisbane': '3GBRI',
    'fortitude valley': '3GBRI',
    'west end': '3GBRI',
    // etc.
  };
  
  return capitalCityMapping[normalized];
}

/**
 * Fetch residential property price index from ABS
 * Dataflow: ABS,RES_PROP_INDEXES - Residential Property Price Indexes
 */
export async function fetchPropertyPriceIndex(regionCode: string): Promise<{
  index?: number;
  change?: number;
  period?: string;
  error?: string;
}> {
  try {
    // RES_PROP_INDEXES dataflow structure:
    // Dimension 1: MEASURE (e.g., INDEX, PERCENTAGE_CHANGE)
    // Dimension 2: REGION (GCCSA codes like 1GSYD, 2GMEL)
    // Dimension 3: FREQ (Q for quarterly)
    
    const url = `${ABS_API_BASE}/data/ABS,RES_PROP_INDEXES/INDEX.${regionCode}.Q?detail=dataonly`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.sdmx.data+json'
      }
    });
    
    if (!response.ok) {
      return { error: `ABS API returned ${response.status}` };
    }
    
    const data = await response.json();
    
    // Parse SDMX-JSON response
    // The structure is: data.dataSets[0].series["0:0:0"].observations
    const dataSets = data?.data?.dataSets;
    if (!dataSets || dataSets.length === 0) {
      return { error: 'No data returned from ABS' };
    }
    
    const series = dataSets[0].series;
    const seriesKeys = Object.keys(series);
    
    if (seriesKeys.length === 0) {
      return { error: 'No series data available' };
    }
    
    // Get the latest observation
    const observations = series[seriesKeys[0]].observations;
    const obsKeys = Object.keys(observations).sort((a, b) => parseInt(b) - parseInt(a));
    
    if (obsKeys.length === 0) {
      return { error: 'No observations available' };
    }
    
    const latestObs = observations[obsKeys[0]];
    const index = latestObs[0];
    
    // Get the time period from dimensions
    const timePeriods = data?.data?.structure?.dimensions?.observation?.find(
      (d: any) => d.id === 'TIME_PERIOD'
    )?.values;
    
    const period = timePeriods?.[parseInt(obsKeys[0])]?.name || 'Unknown';
    
    return {
      index,
      period
    };
    
  } catch (error) {
    console.error('[ABSService] fetchPropertyPriceIndex error:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Fetch total dwelling units data
 * This gives an indication of housing stock in an area
 */
export async function fetchDwellingData(stateCode: string): Promise<{
  totalDwellings?: number;
  period?: string;
  error?: string;
}> {
  try {
    // BUILDING_APPROVALS dataflow for dwelling data
    const url = `${ABS_API_BASE}/data/ABS,BUILDING_APPROVALS/TOT.${stateCode}.M?detail=dataonly&startPeriod=2024-01`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.sdmx.data+json'
      }
    });
    
    if (!response.ok) {
      return { error: `ABS API returned ${response.status}` };
    }
    
    const data = await response.json();
    const dataSets = data?.data?.dataSets;
    
    if (!dataSets || dataSets.length === 0) {
      return { error: 'No data returned' };
    }
    
    const series = dataSets[0].series;
    const seriesKeys = Object.keys(series);
    
    if (seriesKeys.length === 0) {
      return { error: 'No series data' };
    }
    
    const observations = series[seriesKeys[0]].observations;
    const obsKeys = Object.keys(observations).sort((a, b) => parseInt(b) - parseInt(a));
    
    if (obsKeys.length > 0) {
      return {
        totalDwellings: observations[obsKeys[0]][0],
        period: 'Latest'
      };
    }
    
    return { error: 'No observations' };
    
  } catch (error) {
    console.error('[ABSService] fetchDwellingData error:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Main function to fetch suburb statistics from ABS
 */
export async function fetchSuburbStats(address: string): Promise<ABSSuburbData> {
  const errors: string[] = [];
  const result: ABSSuburbData = {
    confidence: 'Low',
    errors: []
  };
  
  try {
    const { suburb, state } = parseAddress(address);
    
    if (!suburb) {
      errors.push('Could not extract suburb from address');
      result.errors = errors;
      return result;
    }
    
    // Try to get GCCSA code for property price index
    const gccsaCode = getGCCSACode(suburb);
    
    if (gccsaCode) {
      const priceData = await fetchPropertyPriceIndex(gccsaCode);
      
      if (priceData.index && !priceData.error) {
        result.medianPrice = priceData.index;
        result.medianPriceDate = priceData.period;
        result.medianPriceSource = 'ABS Residential Property Price Index';
        result.confidence = 'High';
      } else if (priceData.error) {
        errors.push(`Property price: ${priceData.error}`);
      }
    } else {
      errors.push(`No GCCSA mapping for suburb: ${suburb}`);
    }
    
    // Get state code for dwelling data
    const stateCode = STATE_CODES[state?.toLowerCase() || ''];
    
    if (stateCode) {
      const dwellingData = await fetchDwellingData(stateCode);
      
      if (!dwellingData.error) {
        // This is state-level data, useful for context
        result.confidence = result.confidence === 'High' ? 'High' : 'Medium';
      } else {
        errors.push(`Dwelling data: ${dwellingData.error}`);
      }
    }
    
    result.errors = errors.length > 0 ? errors : undefined;
    return result;
    
  } catch (error) {
    console.error('[ABSService] fetchSuburbStats error:', error);
    result.errors = [error instanceof Error ? error.message : 'Unknown error'];
    return result;
  }
}

/**
 * Get available ABS dataflows for property-related data
 */
export async function listAvailableDataflows(): Promise<string[]> {
  try {
    const response = await fetch(`${ABS_API_BASE}/dataflow/ABS`, {
      headers: {
        'Accept': 'application/vnd.sdmx.structure+json'
      }
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    const dataflows = data?.data?.dataflows || [];
    
    // Filter for property-related dataflows
    const propertyKeywords = ['property', 'dwelling', 'housing', 'residential', 'rent', 'price'];
    
    return dataflows
      .filter((df: any) => {
        const name = (df.name || '').toLowerCase();
        const id = (df.id || '').toLowerCase();
        return propertyKeywords.some(kw => name.includes(kw) || id.includes(kw));
      })
      .map((df: any) => `${df.id}: ${df.name}`);
      
  } catch (error) {
    console.error('[ABSService] listAvailableDataflows error:', error);
    return [];
  }
}
