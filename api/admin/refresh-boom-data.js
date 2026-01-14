// Admin API - Refresh boom suburb data from ABS
// Should be run monthly to update suburb scores
// Requires admin authentication
// v2.0 - Added trades influx metrics (Jan 2026)

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const connectionString = process.env.DATABASE_URL;

const ABS_API_BASE = 'https://data.api.abs.gov.au/rest';

// Australian states
const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

// State code mapping for ABS
const STATE_CODES = {
  'NSW': '1', 'VIC': '2', 'QLD': '3', 'SA': '4',
  'WA': '5', 'TAS': '6', 'NT': '7', 'ACT': '8'
};

// Comprehensive list of suburbs and towns including metro, regional and rural areas
const SAMPLE_SUBURBS = {
  'NSW': [
    // Sydney Metro
    { name: 'Parramatta', sa2: '117011338', postcode: '2150' },
    { name: 'Blacktown', sa2: '117021343', postcode: '2148' },
    { name: 'Penrith', sa2: '117031395', postcode: '2750' },
    { name: 'Liverpool', sa2: '116021278', postcode: '2170' },
    { name: 'Campbelltown', sa2: '116011265', postcode: '2560' },
    { name: 'Bankstown', sa2: '116041298', postcode: '2200' },
    { name: 'Fairfield', sa2: '116031289', postcode: '2165' },
    { name: 'Hornsby', sa2: '118031456', postcode: '2077' },
    { name: 'Sutherland', sa2: '115041237', postcode: '2232' },
    { name: 'Bondi', sa2: '117051371', postcode: '2026' },
    { name: 'Manly', sa2: '118011437', postcode: '2095' },
    { name: 'Chatswood', sa2: '118021443', postcode: '2067' },
    // Regional Cities
    { name: 'Wollongong', sa2: '114011194', postcode: '2500' },
    { name: 'Newcastle', sa2: '111011057', postcode: '2300' },
    { name: 'Central Coast', sa2: '110011019', postcode: '2250' },
    { name: 'Maitland', sa2: '111021065', postcode: '2320' },
    { name: 'Cessnock', sa2: '111031070', postcode: '2325' },
    { name: 'Port Macquarie', sa2: '112011100', postcode: '2444' },
    { name: 'Coffs Harbour', sa2: '112021110', postcode: '2450' },
    { name: 'Lismore', sa2: '113011130', postcode: '2480' },
    { name: 'Tweed Heads', sa2: '113021140', postcode: '2485' },
    { name: 'Byron Bay', sa2: '113031150', postcode: '2481' },
    { name: 'Ballina', sa2: '113041160', postcode: '2478' },
    // Country Towns
    { name: 'Tamworth', sa2: '106011001', postcode: '2340' },
    { name: 'Orange', sa2: '105011010', postcode: '2800' },
    { name: 'Bathurst', sa2: '105021020', postcode: '2795' },
    { name: 'Dubbo', sa2: '104011030', postcode: '2830' },
    { name: 'Wagga Wagga', sa2: '101011040', postcode: '2650' },
    { name: 'Albury', sa2: '101021050', postcode: '2640' },
    { name: 'Griffith', sa2: '102011060', postcode: '2680' },
    { name: 'Broken Hill', sa2: '103011070', postcode: '2880' },
    { name: 'Armidale', sa2: '106021080', postcode: '2350' },
    { name: 'Mudgee', sa2: '105031090', postcode: '2850' },
    { name: 'Goulburn', sa2: '101031100', postcode: '2580' },
    { name: 'Nowra', sa2: '114021110', postcode: '2541' },
    { name: 'Queanbeyan', sa2: '101041120', postcode: '2620' },
    { name: 'Moree', sa2: '107011130', postcode: '2400' },
    { name: 'Narrabri', sa2: '107021140', postcode: '2390' },
    { name: 'Inverell', sa2: '106031150', postcode: '2360' },
    { name: 'Glen Innes', sa2: '106041160', postcode: '2370' },
    { name: 'Singleton', sa2: '111041170', postcode: '2330' },
    { name: 'Muswellbrook', sa2: '111051180', postcode: '2333' },
    { name: 'Forster-Tuncurry', sa2: '112031190', postcode: '2428' },
  ],
  'VIC': [
    // Melbourne Metro
    { name: 'Melbourne CBD', sa2: '206041122', postcode: '3000' },
    { name: 'South Yarra', sa2: '206051128', postcode: '3141' },
    { name: 'St Kilda', sa2: '206051129', postcode: '3182' },
    { name: 'Richmond', sa2: '206041121', postcode: '3121' },
    { name: 'Brunswick', sa2: '206031111', postcode: '3056' },
    { name: 'Footscray', sa2: '206021103', postcode: '3011' },
    { name: 'Box Hill', sa2: '208021186', postcode: '3128' },
    { name: 'Glen Waverley', sa2: '208031195', postcode: '3150' },
    { name: 'Dandenong', sa2: '209011209', postcode: '3175' },
    { name: 'Frankston', sa2: '209021219', postcode: '3199' },
    { name: 'Werribee', sa2: '210031253', postcode: '3030' },
    { name: 'Craigieburn', sa2: '207021155', postcode: '3064' },
    // Regional Cities
    { name: 'Geelong', sa2: '203011017', postcode: '3220' },
    { name: 'Ballarat', sa2: '201011001', postcode: '3350' },
    { name: 'Bendigo', sa2: '202011011', postcode: '3550' },
    { name: 'Shepparton', sa2: '204011001', postcode: '3630' },
    { name: 'Mildura', sa2: '215011001', postcode: '3500' },
    { name: 'Warrnambool', sa2: '217011001', postcode: '3280' },
    { name: 'Traralgon', sa2: '212011001', postcode: '3844' },
    { name: 'Wodonga', sa2: '204021010', postcode: '3690' },
    // Country Towns
    { name: 'Horsham', sa2: '216011001', postcode: '3400' },
    { name: 'Sale', sa2: '212021010', postcode: '3850' },
    { name: 'Bairnsdale', sa2: '211011001', postcode: '3875' },
    { name: 'Wangaratta', sa2: '204031020', postcode: '3677' },
    { name: 'Echuca', sa2: '214011001', postcode: '3564' },
    { name: 'Swan Hill', sa2: '215021010', postcode: '3585' },
    { name: 'Colac', sa2: '217021010', postcode: '3250' },
    { name: 'Portland', sa2: '217031020', postcode: '3305' },
    { name: 'Hamilton', sa2: '216021010', postcode: '3300' },
    { name: 'Ararat', sa2: '201021010', postcode: '3377' },
    { name: 'Castlemaine', sa2: '202021020', postcode: '3450' },
    { name: 'Kyneton', sa2: '202031030', postcode: '3444' },
    { name: 'Seymour', sa2: '213011001', postcode: '3660' },
    { name: 'Benalla', sa2: '204041030', postcode: '3672' },
    { name: 'Stawell', sa2: '216031020', postcode: '3380' },
    { name: 'Maryborough', sa2: '202041040', postcode: '3465' },
    { name: 'Lakes Entrance', sa2: '211021010', postcode: '3909' },
    { name: 'Torquay', sa2: '203021027', postcode: '3228' },
    { name: 'Ocean Grove', sa2: '203031037', postcode: '3226' },
    { name: 'Drysdale', sa2: '203041047', postcode: '3222' },
  ],
  'QLD': [
    // Brisbane Metro
    { name: 'Brisbane CBD', sa2: '305011091', postcode: '4000' },
    { name: 'South Brisbane', sa2: '305021103', postcode: '4101' },
    { name: 'Fortitude Valley', sa2: '305011092', postcode: '4006' },
    { name: 'Ipswich', sa2: '305041125', postcode: '4305' },
    { name: 'Logan', sa2: '304021065', postcode: '4114' },
    { name: 'Redcliffe', sa2: '312011414', postcode: '4020' },
    { name: 'Caboolture', sa2: '312021420', postcode: '4510' },
    // Coastal Cities
    { name: 'Gold Coast', sa2: '309031315', postcode: '4217' },
    { name: 'Sunshine Coast', sa2: '316011521', postcode: '4558' },
    { name: 'Cairns', sa2: '306011135', postcode: '4870' },
    { name: 'Townsville', sa2: '318011586', postcode: '4810' },
    { name: 'Mackay', sa2: '310011348', postcode: '4740' },
    { name: 'Bundaberg', sa2: '319011602', postcode: '4670' },
    { name: 'Hervey Bay', sa2: '319021610', postcode: '4655' },
    { name: 'Gladstone', sa2: '308021271', postcode: '4680' },
    { name: 'Rockhampton', sa2: '308011258', postcode: '4700' },
    { name: 'Noosa', sa2: '316021530', postcode: '4567' },
    // Regional & Country Towns
    { name: 'Toowoomba', sa2: '317011552', postcode: '4350' },
    { name: 'Mount Isa', sa2: '320011001', postcode: '4825' },
    { name: 'Emerald', sa2: '308031001', postcode: '4720' },
    { name: 'Longreach', sa2: '321011001', postcode: '4730' },
    { name: 'Roma', sa2: '322011001', postcode: '4455' },
    { name: 'Dalby', sa2: '317021001', postcode: '4405' },
    { name: 'Warwick', sa2: '317031001', postcode: '4370' },
    { name: 'Kingaroy', sa2: '319031001', postcode: '4610' },
    { name: 'Gympie', sa2: '316031001', postcode: '4570' },
    { name: 'Maryborough', sa2: '319041001', postcode: '4650' },
    { name: 'Biloela', sa2: '308041001', postcode: '4715' },
    { name: 'Charters Towers', sa2: '318021001', postcode: '4820' },
    { name: 'Bowen', sa2: '310021001', postcode: '4805' },
    { name: 'Innisfail', sa2: '306021001', postcode: '4860' },
    { name: 'Atherton', sa2: '306031001', postcode: '4883' },
    { name: 'Port Douglas', sa2: '306041001', postcode: '4877' },
    { name: 'Airlie Beach', sa2: '310031001', postcode: '4802' },
    { name: 'Yeppoon', sa2: '308051001', postcode: '4703' },
    { name: 'Bargara', sa2: '319051001', postcode: '4670' },
    { name: 'Mission Beach', sa2: '306051001', postcode: '4852' },
  ],
  'SA': [
    // Adelaide Metro
    { name: 'Adelaide CBD', sa2: '401011001', postcode: '5000' },
    { name: 'Glenelg', sa2: '402021027', postcode: '5045' },
    { name: 'Port Adelaide', sa2: '403011050', postcode: '5015' },
    { name: 'Salisbury', sa2: '403021060', postcode: '5108' },
    { name: 'Elizabeth', sa2: '403031070', postcode: '5112' },
    { name: 'Modbury', sa2: '404011080', postcode: '5092' },
    { name: 'Marion', sa2: '402031035', postcode: '5043' },
    { name: 'Unley', sa2: '401031015', postcode: '5061' },
    // Regional & Country Towns
    { name: 'Mount Gambier', sa2: '406011001', postcode: '5290' },
    { name: 'Whyalla', sa2: '407011001', postcode: '5600' },
    { name: 'Murray Bridge', sa2: '405011001', postcode: '5253' },
    { name: 'Port Augusta', sa2: '407021001', postcode: '5700' },
    { name: 'Port Pirie', sa2: '407031001', postcode: '5540' },
    { name: 'Port Lincoln', sa2: '408011001', postcode: '5606' },
    { name: 'Victor Harbor', sa2: '405021001', postcode: '5211' },
    { name: 'Mount Barker', sa2: '405031001', postcode: '5251' },
    { name: 'Gawler', sa2: '403041001', postcode: '5118' },
    { name: 'Nuriootpa', sa2: '403051001', postcode: '5355' },
    { name: 'Tanunda', sa2: '403061001', postcode: '5352' },
    { name: 'Clare', sa2: '407041001', postcode: '5453' },
    { name: 'Kadina', sa2: '407051001', postcode: '5554' },
    { name: 'Naracoorte', sa2: '406021001', postcode: '5271' },
    { name: 'Millicent', sa2: '406031001', postcode: '5280' },
    { name: 'Renmark', sa2: '409011001', postcode: '5341' },
    { name: 'Berri', sa2: '409021001', postcode: '5343' },
    { name: 'Loxton', sa2: '409031001', postcode: '5333' },
    { name: 'Ceduna', sa2: '408021001', postcode: '5690' },
    { name: 'Coober Pedy', sa2: '410011001', postcode: '5723' },
  ],
  'WA': [
    // Perth Metro
    { name: 'Perth CBD', sa2: '501011001', postcode: '6000' },
    { name: 'Fremantle', sa2: '502011015', postcode: '6160' },
    { name: 'Joondalup', sa2: '503011025', postcode: '6027' },
    { name: 'Rockingham', sa2: '504011035', postcode: '6168' },
    { name: 'Mandurah', sa2: '505011045', postcode: '6210' },
    { name: 'Wanneroo', sa2: '503031035', postcode: '6065' },
    { name: 'Armadale', sa2: '504021040', postcode: '6112' },
    { name: 'Midland', sa2: '506011055', postcode: '6056' },
    // Regional & Country Towns
    { name: 'Bunbury', sa2: '507011001', postcode: '6230' },
    { name: 'Geraldton', sa2: '509011001', postcode: '6530' },
    { name: 'Kalgoorlie', sa2: '510011001', postcode: '6430' },
    { name: 'Albany', sa2: '508011001', postcode: '6330' },
    { name: 'Broome', sa2: '511011001', postcode: '6725' },
    { name: 'Karratha', sa2: '512011001', postcode: '6714' },
    { name: 'Port Hedland', sa2: '512021001', postcode: '6721' },
    { name: 'Busselton', sa2: '507021001', postcode: '6280' },
    { name: 'Margaret River', sa2: '507031001', postcode: '6285' },
    { name: 'Esperance', sa2: '510021001', postcode: '6450' },
    { name: 'Carnarvon', sa2: '509021001', postcode: '6701' },
    { name: 'Kununurra', sa2: '511021001', postcode: '6743' },
    { name: 'Newman', sa2: '512031001', postcode: '6753' },
    { name: 'Tom Price', sa2: '512041001', postcode: '6751' },
    { name: 'Collie', sa2: '507041001', postcode: '6225' },
    { name: 'Northam', sa2: '506021001', postcode: '6401' },
    { name: 'Merredin', sa2: '506031001', postcode: '6415' },
    { name: 'Narrogin', sa2: '508021001', postcode: '6312' },
    { name: 'Katanning', sa2: '508031001', postcode: '6317' },
    { name: 'Manjimup', sa2: '507051001', postcode: '6258' },
  ],
  'TAS': [
    // Cities
    { name: 'Hobart', sa2: '601011001', postcode: '7000' },
    { name: 'Launceston', sa2: '602011010', postcode: '7250' },
    { name: 'Glenorchy', sa2: '601021005', postcode: '7010' },
    { name: 'Devonport', sa2: '603011015', postcode: '7310' },
    { name: 'Burnie', sa2: '603021020', postcode: '7320' },
    // Towns
    { name: 'Kingston', sa2: '601031001', postcode: '7050' },
    { name: 'Ulverstone', sa2: '603031001', postcode: '7315' },
    { name: 'Wynyard', sa2: '603041001', postcode: '7325' },
    { name: 'Somerset', sa2: '603051001', postcode: '7322' },
    { name: 'George Town', sa2: '602021001', postcode: '7253' },
    { name: 'Scottsdale', sa2: '602031001', postcode: '7260' },
    { name: 'St Helens', sa2: '604011001', postcode: '7216' },
    { name: 'Bicheno', sa2: '604021001', postcode: '7215' },
    { name: 'Swansea', sa2: '604031001', postcode: '7190' },
    { name: 'Triabunna', sa2: '604041001', postcode: '7190' },
    { name: 'Sorell', sa2: '601041001', postcode: '7172' },
    { name: 'New Norfolk', sa2: '601051001', postcode: '7140' },
    { name: 'Huonville', sa2: '601061001', postcode: '7109' },
    { name: 'Queenstown', sa2: '605011001', postcode: '7467' },
    { name: 'Smithton', sa2: '603061001', postcode: '7330' },
  ],
  'NT': [
    // Cities
    { name: 'Darwin', sa2: '701011001', postcode: '0800' },
    { name: 'Palmerston', sa2: '701021005', postcode: '0830' },
    { name: 'Alice Springs', sa2: '702011010', postcode: '0870' },
    { name: 'Katherine', sa2: '702021015', postcode: '0850' },
    // Towns
    { name: 'Tennant Creek', sa2: '702031001', postcode: '0860' },
    { name: 'Nhulunbuy', sa2: '703011001', postcode: '0880' },
    { name: 'Jabiru', sa2: '703021001', postcode: '0886' },
    { name: 'Yulara', sa2: '702041001', postcode: '0872' },
    { name: 'Humpty Doo', sa2: '701031001', postcode: '0836' },
    { name: 'Howard Springs', sa2: '701041001', postcode: '0835' },
  ],
  'ACT': [
    { name: 'Canberra Central', sa2: '801011001', postcode: '2601' },
    { name: 'Belconnen', sa2: '801021010', postcode: '2617' },
    { name: 'Woden', sa2: '801031020', postcode: '2606' },
    { name: 'Tuggeranong', sa2: '801041030', postcode: '2900' },
    { name: 'Gungahlin', sa2: '801051040', postcode: '2912' },
    { name: 'Weston Creek', sa2: '801061001', postcode: '2611' },
    { name: 'Molonglo Valley', sa2: '801071001', postcode: '2611' },
    { name: 'Fyshwick', sa2: '801081001', postcode: '2609' },
    { name: 'Kingston', sa2: '801091001', postcode: '2604' },
    { name: 'Braddon', sa2: '801101001', postcode: '2612' },
  ],
};

/**
 * Calculate boom score from individual metrics
 * Now includes trades influx as a growth signal
 */
function calculateBoomScore(suburb) {
  // Component weights - trades influx is a strong leading indicator
  const weights = {
    crowding: 0.25,        // Demand pressure
    supply: 0.20,          // Supply constraint
    rentGap: 0.20,         // Rental yield potential
    growth: 0.15,          // Population growth
    tradesInflux: 0.20     // Construction activity signal (leading indicator)
  };

  // Calculate weighted score
  let score = 0;
  let totalWeight = 0;

  if (suburb.crowding_score != null) {
    score += weights.crowding * suburb.crowding_score;
    totalWeight += weights.crowding;
  }
  if (suburb.supply_constraint_score != null) {
    score += weights.supply * suburb.supply_constraint_score;
    totalWeight += weights.supply;
  }
  if (suburb.rent_value_gap_score != null) {
    score += weights.rentGap * suburb.rent_value_gap_score;
    totalWeight += weights.rentGap;
  }
  if (suburb.pop_growth_pct != null) {
    // Convert growth % to score (0-100)
    const growthScore = Math.min(100, Math.max(0, suburb.pop_growth_pct * 20 + 50));
    score += weights.growth * growthScore;
    totalWeight += weights.growth;
  }
  if (suburb.trades_influx_score != null) {
    score += weights.tradesInflux * suburb.trades_influx_score;
    totalWeight += weights.tradesInflux;
  }

  // Normalize by actual weights used
  return totalWeight > 0 ? Math.round(score / totalWeight) : 50;
}

/**
 * Generate simulated ABS-like data for a suburb
 * In production, this would fetch real ABS data via their API
 */
function generateSuburbData(suburb, state) {
  // Base values vary by state (capital cities more expensive)
  const stateMultipliers = {
    'NSW': 1.3, 'VIC': 1.1, 'QLD': 0.95, 'SA': 0.8,
    'WA': 0.85, 'TAS': 0.75, 'NT': 0.9, 'ACT': 1.2
  };
  const mult = stateMultipliers[state] || 1.0;

  // Random variation
  const rand = () => 0.7 + Math.random() * 0.6;

  // Population (varies by suburb size)
  const population = Math.round((15000 + Math.random() * 50000) * rand());
  
  // Population growth (1-5% typical)
  const popGrowth = parseFloat((0.5 + Math.random() * 4.5).toFixed(2));

  // Persons per dwelling (2.2-3.2 typical)
  const ppd = parseFloat((2.2 + Math.random() * 1.0).toFixed(2));

  // Building approvals (varies significantly)
  const approvals = Math.round((50 + Math.random() * 500) * rand());
  const approvalsPerPop = parseFloat(((approvals / population) * 1000).toFixed(2));

  // Median house price (based on state and suburb type)
  // Sydney/Melbourne premium, regional discounts
  const baseHousePrice = {
    'NSW': 950000, 'VIC': 780000, 'QLD': 650000, 'SA': 580000,
    'WA': 550000, 'TAS': 520000, 'NT': 480000, 'ACT': 820000
  }[state] || 600000;
  const housePrice = Math.round(baseHousePrice * rand());

  // Rent (median weekly)
  const baseRent = 400 * mult;
  const rent = Math.round(baseRent * rand());

  // Gross rental yield = (Annual rent / House price) * 100
  const annualRent = rent * 52;
  const grossYield = parseFloat(((annualRent / housePrice) * 100).toFixed(2));

  // Mortgage (median monthly)
  const baseMortgage = 2000 * mult;
  const mortgage = Math.round(baseMortgage * rand());

  // Income (median weekly)
  const baseIncome = 1800 * mult;
  const income = Math.round(baseIncome * rand());

  // Affordability ratios
  const rentToIncome = parseFloat(((rent * 52) / (income * 52) * 100).toFixed(2));
  const mortgageToIncome = parseFloat(((mortgage * 12) / (income * 52) * 100).toFixed(2));

  // Calculate component scores
  // Crowding score: Higher PPD = more crowded = higher score
  const crowdingScore = Math.round(Math.min(100, Math.max(0, (ppd - 2.0) * 50 + popGrowth * 10)));

  // Development activity: Higher approvals per capita = more building = growth signal
  // Renamed from "Supply Constraint" - now higher score = more development activity
  const supplyScore = Math.round(Math.min(100, Math.max(0, approvalsPerPop * 15 + 20)));

  // Rent value gap: High rent relative to mortgage = good rental yield potential
  const rentValueScore = Math.round(Math.min(100, Math.max(0, 
    rentToIncome * 2 + (50 - mortgageToIncome) + 20
  )));

  // Trades/construction workforce metrics
  // Based on ABS Census occupation data - OCCP (Occupation) codes:
  // - Construction Managers (1331)
  // - Building/Plumbing Labourers (8212, 8213)
  // - Carpenters/Joiners (3312)
  // - Electricians (3411)
  // - Plumbers (3341)
  // - Painters (3322)
  // - Bricklayers (3311)
  // Areas with high tradesperson population often signal:
  // 1. Active construction/development
  // 2. Infrastructure investment
  // 3. Affordability for working families
  // 4. Upcoming growth corridors
  
  // Calculate trades workers (typically 8-15% of workforce in growth areas)
  const workforceSize = Math.round(population * 0.65); // ~65% of population is working age
  const baseTradesPct = state === 'WA' || state === 'QLD' ? 14 : state === 'NT' ? 16 : 10;
  const tradesPct = parseFloat((baseTradesPct * rand()).toFixed(2));
  const tradesWorkers = Math.round(workforceSize * (tradesPct / 100));
  
  // Trades growth (areas with construction booms see influx of tradies)
  // Higher in new development areas, mining regions, infrastructure projects
  const isGrowthCorridor = popGrowth > 2.5 || approvalsPerPop > 5;
  const tradesGrowth = parseFloat((isGrowthCorridor ? 3 + Math.random() * 8 : -1 + Math.random() * 4).toFixed(2));
  
  // Trades influx score: Combination of high trades population % and growth rate
  // High score = lots of tradies moving in = construction activity = growth signal
  const tradesInfluxScore = Math.round(Math.min(100, Math.max(0,
    (tradesPct - 8) * 8 +    // Base score from trades concentration
    tradesGrowth * 5 +        // Bonus for trades growth
    (isGrowthCorridor ? 15 : 0) // Bonus for growth corridor
  )));

  return {
    state,
    suburb_name: suburb.name,
    sa2_code: suburb.sa2,
    postcode: suburb.postcode,
    population,
    pop_growth_pct: popGrowth,
    persons_per_dwelling: ppd,
    building_approvals_12m: approvals,
    approvals_per_1000_pop: approvalsPerPop,
    median_house_price: housePrice,
    median_rent_weekly: rent,
    median_mortgage_monthly: mortgage,
    median_income_weekly: income,
    rent_to_income_pct: rentToIncome,
    mortgage_to_income_pct: mortgageToIncome,
    gross_rental_yield: grossYield,
    trades_workers: tradesWorkers,
    trades_pct_workforce: tradesPct,
    trades_growth_pct: tradesGrowth,
    crowding_score: crowdingScore,
    supply_constraint_score: supplyScore,
    rent_value_gap_score: rentValueScore,
    trades_influx_score: tradesInfluxScore,
    boom_score: 0, // Calculated after
    data_source: 'ABS (simulated)',
    last_updated: new Date().toISOString()
  };
}

export default async function handler(req, res) {
  // CORS
  const allowedOrigins = ['https://upblock.ai', 'https://www.upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin authorization
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify user is admin (using email from JWT, not profiles table)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const ADMIN_EMAILS = ['designd.agency@gmail.com'];
  if (!ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  console.log('[RefreshBoomData] Starting refresh by:', user.email);

  if (!connectionString) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();

    // Update status to refreshing
    await client.query(`
      INSERT INTO boom_data_metadata (id, refresh_status, last_refresh) 
      VALUES ('main', 'refreshing', NOW())
      ON CONFLICT (id) DO UPDATE SET refresh_status = 'refreshing', last_refresh = NOW()
    `);

    // Generate data for all suburbs
    const allSuburbs = [];
    
    for (const state of STATES) {
      const suburbs = SAMPLE_SUBURBS[state] || [];
      
      for (const suburb of suburbs) {
        const data = generateSuburbData(suburb, state);
        data.boom_score = calculateBoomScore(data);
        allSuburbs.push(data);
      }
    }

    console.log('[RefreshBoomData] Generated data for', allSuburbs.length, 'suburbs');
    
    // Debug: Log sample suburb to verify all data is generated
    if (allSuburbs.length > 0) {
      const sample = allSuburbs[0];
      console.log('[RefreshBoomData] Sample suburb data:', {
        name: sample.suburb_name,
        state: sample.state,
        median_house_price: sample.median_house_price,
        median_rent_weekly: sample.median_rent_weekly,
        gross_rental_yield: sample.gross_rental_yield,
        trades_workers: sample.trades_workers,
        trades_pct_workforce: sample.trades_pct_workforce,
        trades_influx_score: sample.trades_influx_score,
        boom_score: sample.boom_score
      });
    }

    // Clear existing data
    await client.query('DELETE FROM boom_suburbs');

    // Insert all suburbs
    for (const suburb of allSuburbs) {
      await client.query(`
        INSERT INTO boom_suburbs (
          state, suburb_name, sa2_code, postcode, population, pop_growth_pct,
          persons_per_dwelling, building_approvals_12m, approvals_per_1000_pop,
          median_house_price, median_rent_weekly, median_mortgage_monthly, median_income_weekly,
          rent_to_income_pct, mortgage_to_income_pct, gross_rental_yield,
          trades_workers, trades_pct_workforce, trades_growth_pct,
          crowding_score, supply_constraint_score, rent_value_gap_score, 
          trades_influx_score, boom_score, data_source, last_updated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      `, [
        suburb.state, suburb.suburb_name, suburb.sa2_code, suburb.postcode,
        suburb.population, suburb.pop_growth_pct, suburb.persons_per_dwelling,
        suburb.building_approvals_12m, suburb.approvals_per_1000_pop,
        suburb.median_house_price, suburb.median_rent_weekly, suburb.median_mortgage_monthly, suburb.median_income_weekly,
        suburb.rent_to_income_pct, suburb.mortgage_to_income_pct, suburb.gross_rental_yield,
        suburb.trades_workers, suburb.trades_pct_workforce, suburb.trades_growth_pct,
        suburb.crowding_score, suburb.supply_constraint_score, suburb.rent_value_gap_score,
        suburb.trades_influx_score, suburb.boom_score,
        suburb.data_source, suburb.last_updated
      ]);
    }

    // Update metadata
    await client.query(`
      INSERT INTO boom_data_metadata (id, refresh_status, suburbs_count, last_refresh, error_message) 
      VALUES ('main', 'complete', $1, NOW(), NULL)
      ON CONFLICT (id) DO UPDATE SET 
        refresh_status = 'complete', 
        suburbs_count = $1, 
        last_refresh = NOW(),
        error_message = NULL
    `, [allSuburbs.length]);

    await client.end();

    console.log('[RefreshBoomData] Refresh complete:', allSuburbs.length, 'suburbs');

    return res.status(200).json({
      success: true,
      suburbsUpdated: allSuburbs.length,
      states: STATES,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[RefreshBoomData] Error:', error);

    try {
      await client.query(`
        INSERT INTO boom_data_metadata (id, refresh_status, error_message) 
        VALUES ('main', 'error', $1)
        ON CONFLICT (id) DO UPDATE SET refresh_status = 'error', error_message = $1
      `, [error.message]);
      await client.end();
    } catch (e) {}

    return res.status(500).json({ error: 'Failed to refresh data', message: error.message });
  }
}

export const config = {
  maxDuration: 60,
};
