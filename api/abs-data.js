// API endpoint for fetching real ABS (Australian Bureau of Statistics) data
// Used to supplement and validate AI-generated property insights
// ABS API: https://api.data.abs.gov.au (no API key required)

const ABS_API_BASE = 'https://api.data.abs.gov.au';

// Greater Capital City Statistical Area codes for property price lookups
const GCCSA_CODES = {
  'sydney': '1GSYD',
  'melbourne': '2GMEL',
  'brisbane': '3GBRI',
  'adelaide': '4GADE',
  'perth': '5GPER',
  'hobart': '6GHOB',
  'darwin': '7GDAR',
  'canberra': '8ACTE',
};

// Suburb to capital city mapping (simplified - covers major areas)
const SUBURB_TO_GCCSA = {
  // Greater Sydney
  'parramatta': '1GSYD', 'blacktown': '1GSYD', 'penrith': '1GSYD', 'liverpool': '1GSYD',
  'campbelltown': '1GSYD', 'randwick': '1GSYD', 'bondi': '1GSYD', 'manly': '1GSYD',
  'chatswood': '1GSYD', 'hornsby': '1GSYD', 'sutherland': '1GSYD', 'cronulla': '1GSYD',
  'burwood': '1GSYD', 'strathfield': '1GSYD', 'ryde': '1GSYD', 'epping': '1GSYD',
  'castle hill': '1GSYD', 'baulkham hills': '1GSYD', 'north sydney': '1GSYD',
  'mosman': '1GSYD', 'neutral bay': '1GSYD', 'cremorne': '1GSYD', 'kirribilli': '1GSYD',
  'dee why': '1GSYD', 'brookvale': '1GSYD', 'mona vale': '1GSYD', 'avalon': '1GSYD',
  'hurstville': '1GSYD', 'kogarah': '1GSYD', 'rockdale': '1GSYD', 'bankstown': '1GSYD',
  'auburn': '1GSYD', 'granville': '1GSYD', 'merrylands': '1GSYD', 'fairfield': '1GSYD',
  'cabramatta': '1GSYD', 'ingleburn': '1GSYD', 'leumeah': '1GSYD', 'macarthur': '1GSYD',
  // Greater Melbourne
  'st kilda': '2GMEL', 'south yarra': '2GMEL', 'richmond': '2GMEL', 'fitzroy': '2GMEL',
  'brunswick': '2GMEL', 'footscray': '2GMEL', 'doncaster': '2GMEL', 'box hill': '2GMEL',
  'glen waverley': '2GMEL', 'dandenong': '2GMEL', 'frankston': '2GMEL', 'werribee': '2GMEL',
  'craigieburn': '2GMEL', 'epping': '2GMEL', 'preston': '2GMEL', 'coburg': '2GMEL',
  'essendon': '2GMEL', 'moonee ponds': '2GMEL', 'northcote': '2GMEL', 'collingwood': '2GMEL',
  'carlton': '2GMEL', 'parkville': '2GMEL', 'kew': '2GMEL', 'hawthorn': '2GMEL',
  'camberwell': '2GMEL', 'malvern': '2GMEL', 'toorak': '2GMEL', 'brighton': '2GMEL',
  'sandringham': '2GMEL', 'moorabbin': '2GMEL', 'bentleigh': '2GMEL', 'caulfield': '2GMEL',
  // Greater Brisbane
  'south brisbane': '3GBRI', 'fortitude valley': '3GBRI', 'west end': '3GBRI',
  'paddington': '3GBRI', 'toowong': '3GBRI', 'indooroopilly': '3GBRI', 'ipswich': '3GBRI',
  'logan': '3GBRI', 'springwood': '3GBRI', 'browns plains': '3GBRI', 'caboolture': '3GBRI',
  'redcliffe': '3GBRI', 'chermside': '3GBRI', 'aspley': '3GBRI', 'nundah': '3GBRI',
  // Greater Adelaide
  'glenelg': '4GADE', 'port adelaide': '4GADE', 'salisbury': '4GADE', 'elizabeth': '4GADE',
  'modbury': '4GADE', 'noarlunga': '4GADE', 'marion': '4GADE', 'unley': '4GADE',
  'norwood': '4GADE', 'burnside': '4GADE', 'prospect': '4GADE', 'walkerville': '4GADE',
  // Greater Perth
  'fremantle': '5GPER', 'joondalup': '5GPER', 'stirling': '5GPER', 'rockingham': '5GPER',
  'mandurah': '5GPER', 'armadale': '5GPER', 'midland': '5GPER', 'subiaco': '5GPER',
  'claremont': '5GPER', 'cottesloe': '5GPER', 'scarborough': '5GPER', 'morley': '5GPER',
  // Greater Hobart
  'glenorchy': '6GHOB', 'kingston': '6GHOB', 'sandy bay': '6GHOB', 'battery point': '6GHOB',
  // Darwin
  'palmerston': '7GDAR', 'casuarina': '7GDAR', 'stuart park': '7GDAR',
  // Canberra/ACT
  'belconnen': '8ACTE', 'woden': '8ACTE', 'tuggeranong': '8ACTE', 'gungahlin': '8ACTE',
  'civic': '8ACTE', 'braddon': '8ACTE', 'kingston': '8ACTE', 'manuka': '8ACTE',
};

// State name to code mapping
const STATE_CODES = {
  'nsw': '1', 'new south wales': '1',
  'vic': '2', 'victoria': '2',
  'qld': '3', 'queensland': '3',
  'sa': '4', 'south australia': '4',
  'wa': '5', 'western australia': '5',
  'tas': '6', 'tasmania': '6',
  'nt': '7', 'northern territory': '7',
  'act': '8', 'australian capital territory': '8',
};

/**
 * Extract suburb and state from an Australian address
 */
function parseAddress(address) {
  const normalized = address.toLowerCase().trim();
  
  // Extract postcode
  const postcodeMatch = normalized.match(/\b(\d{4})\b/);
  const postcode = postcodeMatch ? postcodeMatch[1] : null;
  
  // Extract state
  let state = null;
  for (const [stateName] of Object.entries(STATE_CODES)) {
    if (normalized.includes(stateName)) {
      state = stateName;
      break;
    }
  }
  
  // Clean address to find suburb
  let cleaned = normalized
    .replace(/\d{4}/, '') // Remove postcode
    .replace(/\b(nsw|vic|qld|sa|wa|tas|nt|act|new south wales|victoria|queensland|south australia|western australia|tasmania|northern territory|australian capital territory)\b/gi, '')
    .replace(/\b(street|st|road|rd|avenue|ave|drive|dr|court|ct|place|pl|lane|ln|crescent|cres|way|parade|pde|highway|hwy|boulevard|blvd|close|cl)\b/gi, '')
    .replace(/[,]/g, ' ')
    .trim();
  
  // Split into parts and find suburb
  const parts = cleaned.split(/\s+/).filter(p => p.length > 2 && !/^\d+$/.test(p));
  
  // Check for known suburbs first (from end of address)
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].toLowerCase();
    if (SUBURB_TO_GCCSA[part] || GCCSA_CODES[part]) {
      return { suburb: part, state, postcode };
    }
    // Check two-word suburbs
    if (i > 0) {
      const twoWord = `${parts[i-1]} ${parts[i]}`.toLowerCase();
      if (SUBURB_TO_GCCSA[twoWord]) {
        return { suburb: twoWord, state, postcode };
      }
    }
  }
  
  // If no known suburb found, use last meaningful word
  const suburb = parts.length > 0 ? parts[parts.length - 1] : null;
  
  return { suburb, state, postcode };
}

/**
 * Get GCCSA code for a suburb
 */
function getGCCSACode(suburb) {
  if (!suburb) return null;
  const normalized = suburb.toLowerCase().trim();
  return SUBURB_TO_GCCSA[normalized] || GCCSA_CODES[normalized] || null;
}

/**
 * Fetch Residential Property Price Index from ABS
 */
async function fetchPropertyPriceIndex(gccsaCode) {
  try {
    // RES_PROP_INDEXES: Residential Property Price Indexes
    // Structure: MEASURE.REGION.FREQUENCY
    // INDEX = actual index value, PCPY = percentage change from previous year
    const url = `${ABS_API_BASE}/data/ABS,RES_PROP_INDEXES,1.0.0/1+2.${gccsaCode}.Q?detail=dataonly`;
    
    console.log('[ABS] Fetching property price index:', url);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.sdmx.data+json'
      }
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error('[ABS] API error:', response.status, text.substring(0, 200));
      return { error: `ABS API error: ${response.status}` };
    }
    
    const data = await response.json();
    
    // Parse SDMX-JSON response
    const dataSets = data?.data?.dataSets;
    if (!dataSets || dataSets.length === 0) {
      return { error: 'No data returned from ABS' };
    }
    
    const series = dataSets[0].series;
    if (!series || Object.keys(series).length === 0) {
      return { error: 'No series data available' };
    }
    
    // Get time periods from structure
    const timePeriods = data?.data?.structure?.dimensions?.observation?.find(
      d => d.id === 'TIME_PERIOD'
    )?.values || [];
    
    // Get the latest values for index and percentage change
    let index = null;
    let percentageChange = null;
    let period = null;
    
    for (const [seriesKey, seriesData] of Object.entries(series)) {
      const observations = seriesData.observations;
      if (!observations) continue;
      
      // Get latest observation (highest key number)
      const obsKeys = Object.keys(observations).sort((a, b) => parseInt(b) - parseInt(a));
      if (obsKeys.length > 0) {
        const latestKey = obsKeys[0];
        const value = observations[latestKey][0];
        
        // Determine if this is index or percentage change based on series key
        // Series key "0:X:0" is index, "1:X:0" is percentage change
        if (seriesKey.startsWith('0:')) {
          index = value;
          period = timePeriods[parseInt(latestKey)]?.name || timePeriods[parseInt(latestKey)]?.id;
        } else if (seriesKey.startsWith('1:')) {
          percentageChange = value;
        }
      }
    }
    
    return {
      index,
      percentageChange,
      period,
      source: 'ABS Residential Property Price Indexes'
    };
    
  } catch (error) {
    console.error('[ABS] fetchPropertyPriceIndex error:', error);
    return { error: error.message || 'Unknown error' };
  }
}

/**
 * Fetch Total Value of Dwelling Stock from ABS
 * This gives actual $ values for dwelling stock
 */
async function fetchDwellingStockValue(stateCode) {
  try {
    // AUS_NATIONAL_ACCOUNTS has dwelling stock values
    const url = `${ABS_API_BASE}/data/ABS,ANA_AGG,1.0.0/DWEL_VAL.${stateCode || 'AUS'}.A?detail=dataonly`;
    
    console.log('[ABS] Fetching dwelling stock value:', url);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.sdmx.data+json'
      }
    });
    
    if (!response.ok) {
      return { error: `ABS API error: ${response.status}` };
    }
    
    const data = await response.json();
    const dataSets = data?.data?.dataSets;
    
    if (!dataSets || dataSets.length === 0) {
      return { error: 'No dwelling stock data' };
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
        totalValue: observations[obsKeys[0]][0],
        unit: 'millions AUD'
      };
    }
    
    return { error: 'No observations' };
    
  } catch (error) {
    console.error('[ABS] fetchDwellingStockValue error:', error);
    return { error: error.message };
  }
}

/**
 * Fetch CPI (Consumer Price Index) for housing costs
 */
async function fetchHousingCPI() {
  try {
    // CPI Group: Housing (includes rent, new dwelling purchase, utilities)
    const url = `${ABS_API_BASE}/data/ABS,CPI,1.0.0/3.10.10.Q?detail=dataonly&startPeriod=2023-Q1`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.sdmx.data+json'
      }
    });
    
    if (!response.ok) {
      return { error: `ABS API error: ${response.status}` };
    }
    
    const data = await response.json();
    const dataSets = data?.data?.dataSets;
    
    if (!dataSets || dataSets.length === 0) {
      return { error: 'No CPI data' };
    }
    
    const series = dataSets[0].series;
    const seriesKeys = Object.keys(series);
    
    if (seriesKeys.length > 0) {
      const observations = series[seriesKeys[0]].observations;
      const obsKeys = Object.keys(observations).sort((a, b) => parseInt(b) - parseInt(a));
      
      if (obsKeys.length > 0) {
        return {
          housingCPI: observations[obsKeys[0]][0],
          source: 'ABS Consumer Price Index - Housing'
        };
      }
    }
    
    return { error: 'No observations' };
    
  } catch (error) {
    console.error('[ABS] fetchHousingCPI error:', error);
    return { error: error.message };
  }
}

export default async function handler(req, res) {
  // CORS
  const allowedOrigins = ['https://upblock.ai', 'https://www.upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get address from query (GET) or body (POST)
  const address = req.method === 'GET' 
    ? req.query.address 
    : req.body?.address;

  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }

  console.log('[ABS] Fetching data for address:', address.substring(0, 50));

  try {
    // Parse the address
    const { suburb, state, postcode } = parseAddress(address);
    console.log('[ABS] Parsed address:', { suburb, state, postcode });

    // Get GCCSA code for the suburb
    const gccsaCode = getGCCSACode(suburb);
    const stateCode = state ? STATE_CODES[state.toLowerCase()] : null;

    // Results object
    const result = {
      address,
      parsed: { suburb, state, postcode },
      gccsaCode,
      stateCode,
      propertyPriceIndex: null,
      dwellingStock: null,
      housingCPI: null,
      confidence: 'Low',
      errors: []
    };

    // Fetch property price index if we have a GCCSA code
    if (gccsaCode) {
      const priceIndex = await fetchPropertyPriceIndex(gccsaCode);
      if (!priceIndex.error) {
        result.propertyPriceIndex = priceIndex;
        result.confidence = 'High';
      } else {
        result.errors.push(priceIndex.error);
      }
    } else {
      result.errors.push(`Unknown suburb: ${suburb}. Try a capital city or major suburb.`);
    }

    // Fetch dwelling stock value
    const dwellingStock = await fetchDwellingStockValue(stateCode);
    if (!dwellingStock.error) {
      result.dwellingStock = dwellingStock;
    }

    // Fetch housing CPI
    const housingCPI = await fetchHousingCPI();
    if (!housingCPI.error) {
      result.housingCPI = housingCPI;
    }

    // Set confidence level
    if (result.propertyPriceIndex && !result.propertyPriceIndex.error) {
      result.confidence = 'High';
    } else if (result.dwellingStock || result.housingCPI) {
      result.confidence = 'Medium';
    }

    console.log('[ABS] Result:', {
      suburb,
      gccsaCode,
      hasPriceIndex: !!result.propertyPriceIndex,
      confidence: result.confidence
    });

    return res.status(200).json(result);

  } catch (error) {
    console.error('[ABS] Handler error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch ABS data',
      message: error.message 
    });
  }
}
