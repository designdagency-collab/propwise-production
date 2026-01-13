// API endpoint for AI-powered renovation and development visualisation
// Uses @google/genai with gemini-2.5-flash-image model (same as Three Birds)

import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Whitelist of allowed visualization types (high-value, quality results)
const ALLOWED_STRATEGIES = [
  'kitchen',      // Kitchen renovation
  'bathroom',     // Bathroom update
  'facade',       // Curb appeal
  'exterior',     // Exterior refresh
  'render',       // Facade render
  'paint',        // Exterior paint
  'curb',         // Curb appeal
  'landscap',     // Landscaping
  'garden',       // Garden design
  'outdoor',      // Outdoor entertaining
  'alfresco',     // Alfresco area
  'deck',         // Deck addition
  'entertaining', // Entertaining area
  'backyard',     // Backyard upgrade
  'patio',        // Patio area
  'granny',       // Granny flat
  'secondary',    // Secondary dwelling
  'ancillary',    // Ancillary dwelling
];

// Free visualization limit
const FREE_VISUALIZATION_LIMIT = 2;
const CREDIT_COST_PER_VISUALIZATION = 0.5;

// Development scenarios are always allowed
const ALLOW_DEVELOPMENT = true;

function isStrategyAllowed(strategyTitle, type) {
  // Development scenarios always allowed
  if (type === 'development') return ALLOW_DEVELOPMENT;
  
  // Check if strategy matches whitelist
  const strategyLower = (strategyTitle || '').toLowerCase();
  return ALLOWED_STRATEGIES.some(allowed => strategyLower.includes(allowed));
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

  try {
    // ============================================
    // AUTHENTICATION: Require signed-up user
    // ============================================
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please sign up or log in to use AI visualizations'
      });
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ 
        error: 'Invalid session',
        message: 'Please log in again to use AI visualizations'
      });
    }

    console.log('[GenerateRenovation] Authenticated user:', user.email);

    // ============================================
    // CREDIT CHECK: First 2 visualizations free, then 0.5 credits each
    // ============================================
    
    let currentVisualizationCount = 0;
    let isFreeVisualization = true;
    let creditsDeducted = false;
    
    try {
      // Count user's total visualizations across all properties
      const { count: totalVisualizationCount, error: countError } = await supabase
        .from('visualization_cache')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      if (countError) {
        console.error('[GenerateRenovation] Error counting visualizations:', countError);
        // If count fails, assume user is within free limit to avoid blocking
        console.log('[GenerateRenovation] Proceeding as free due to count error');
      } else {
        currentVisualizationCount = totalVisualizationCount || 0;
        isFreeVisualization = currentVisualizationCount < FREE_VISUALIZATION_LIMIT;
        
        console.log(`[GenerateRenovation] User has ${currentVisualizationCount} visualizations. Free: ${isFreeVisualization}`);
        
        // If not free, check and deduct credits
        if (!isFreeVisualization) {
          // Fetch user's profile to check credits
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('credit_topups, plan_type')
            .eq('id', user.id)
            .single();
          
          if (profileError) {
            console.error('[GenerateRenovation] Error fetching profile:', profileError);
            // Allow generation but don't charge
            console.log('[GenerateRenovation] Proceeding without credit check due to profile error');
          } else if (profile) {
            // UNLIMITED_PRO users don't consume credits
            if (profile.plan_type === 'UNLIMITED_PRO') {
              console.log('[GenerateRenovation] UNLIMITED_PRO user - no credit deduction');
            } else {
              const availableCredits = parseFloat(profile.credit_topups) || 0;
              
              if (availableCredits < CREDIT_COST_PER_VISUALIZATION) {
                console.log('[GenerateRenovation] Insufficient credits:', availableCredits);
                return res.status(402).json({ 
                  error: 'Insufficient credits',
                  message: `You've used your ${FREE_VISUALIZATION_LIMIT} free AI visualizations. Each additional visualization costs ${CREDIT_COST_PER_VISUALIZATION} credits. Please purchase more credits to continue.`,
                  insufficientCredits: true,
                  freeUsed: currentVisualizationCount,
                  freeLimit: FREE_VISUALIZATION_LIMIT,
                  creditsRequired: CREDIT_COST_PER_VISUALIZATION,
                  creditsAvailable: availableCredits
                });
              }
              
              // Deduct 0.5 credits
              const newCreditBalance = availableCredits - CREDIT_COST_PER_VISUALIZATION;
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ credit_topups: newCreditBalance })
                .eq('id', user.id);
              
              if (updateError) {
                console.error('[GenerateRenovation] Error deducting credits:', updateError);
                // Don't block - just log the error
                console.log('[GenerateRenovation] Proceeding without deducting credits due to update error');
              } else {
                creditsDeducted = true;
                console.log(`[GenerateRenovation] Deducted ${CREDIT_COST_PER_VISUALIZATION} credits. New balance: ${newCreditBalance}`);
              }
            }
          }
        }
      }
    } catch (creditCheckError) {
      console.error('[GenerateRenovation] Credit check failed:', creditCheckError);
      // Don't block generation if credit check fails
      console.log('[GenerateRenovation] Proceeding despite credit check error');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[GenerateRenovation] GEMINI_API_KEY not configured');
      return res.status(500).json({ error: 'API configuration error' });
    }

    const { image, type, strategyTitle, scenarioTitle, propertyAddress } = req.body;

    // ============================================
    // STRATEGY WHITELIST: Only allow high-value visualizations
    // ============================================
    if (!isStrategyAllowed(strategyTitle, type)) {
      console.log('[GenerateRenovation] Strategy not allowed:', strategyTitle);
      return res.status(400).json({ 
        error: 'Visualization not available',
        message: `AI visualization is not available for "${strategyTitle}". Try Kitchen, Bathroom, Facade, or Landscaping renovations.`,
        strategyNotAllowed: true
      });
    }

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const isDevelopment = type === 'development';
    const contextTitle = isDevelopment ? (scenarioTitle || 'Development') : (strategyTitle || 'Renovation');
    
    // Build prompt based on type
    let fullPrompt;
    
    if (isDevelopment) {
      // DEVELOPMENT: Strict boundary-respecting development with ORIENTATION DETECTION
      fullPrompt = `STEP 1 - FIND THE BOUNDARY LINES:
Look at this image. There are WHITE or CREAM colored lines drawn on it forming a shape (rectangle, square, or polygon). These lines show the PROPERTY BOUNDARY.

STEP 2 - DETERMINE STREET DIRECTION (CRITICAL):
⛔⛔⛔ BEFORE PLACING ANY BUILDING, YOU MUST IDENTIFY WHICH SIDE IS THE STREET ⛔⛔⛔

Look for these clues to find the STREET SIDE:
- Existing road, footpath, kerb, or bitumen = STREET SIDE
- Power lines or street lights along one edge = STREET SIDE  
- Neighboring houses with garages and front doors facing that direction = STREET SIDE
- Mailboxes, driveways connecting to a road = STREET SIDE

The REAR of the property is:
- Where you see backyard fences
- Where neighboring backyards are visible
- Open grassy areas with no road access

📷 CAMERA PERSPECTIVE CHECK:
- If this is a GROUND-LEVEL photo taken from a backyard looking toward street → the STREET is AWAY from the camera
- If this is AERIAL/satellite view → look for roads on one edge
- The garage and main entry MUST face the PUBLIC ROAD, not the rear yard

STEP 3 - SIZE CONSTRAINT:
Your new building MUST BE SMALL ENOUGH TO FIT INSIDE THOSE WHITE LINES.
- If the boundary shows space for 2-3 houses, build a SMALL development (duplex or townhouse)
- DO NOT build a massive apartment complex on a small lot
- The building footprint should use only 50-70% of the boundary area (leave setbacks)

WHAT TO CREATE: ${contextTitle}
- Remove existing buildings inside the boundary
- Build a NEW contemporary Australian development
- SCALE: Match the building size to the boundary size

⛔⛔⛔ ORIENTATION RULES - DO NOT BREAK THESE ⛔⛔⛔
1. Garage doors and driveways MUST face the STREET (public road)
2. DO NOT put garage or driveway at the rear of the property
3. DO NOT face the main entry toward neighboring backyards
4. Garages and driveways ONLY connect to public roads
5. The front facade faces the street, the rear faces the backyard
6. If unsure which way is street, look for existing driveways on neighboring properties

🏠🏠 DUPLEX / DUAL OCCUPANCY RULES (CRITICAL):
If creating a DUPLEX or DUAL OCCUPANCY (2 dwellings):
- Each dwelling MUST have its OWN garage
- Garages should be BALANCED - NOT all on one side
- PREFERRED: Mirrored layout with garages on OPPOSITE outer edges
  → Dwelling 1 garage on LEFT side, Dwelling 2 garage on RIGHT side
- ACCEPTABLE: Central shared driveway with garages side-by-side in middle
- NOT ACCEPTABLE: Both garages bunched to one side of the building
- The design should look SYMMETRICAL or BALANCED from the street
- Each dwelling should have equal street presence

Example good duplex layout (viewed from street):
[Garage 1] [Entry 1] [Entry 2] [Garage 2]  ✓ Balanced
[Entry 1] [Garage 1] [Garage 2] [Entry 2]  ✓ Central garages OK

Example BAD duplex layout:
[Garage 1] [Garage 2] [Entry 1] [Entry 2]  ✗ All garages on one side - WRONG

DESIGN STYLE:
- Crisp white render with timber accents
- Modern flat or skillion roof with solar panels
- Contemporary glazing and balconies with railings
- Street-facing entry and garage (FACING THE ROAD)
- Rear private courtyard or garden
- For duplex: SYMMETRICAL or BALANCED facade design

🚨 FINAL CHECK BEFORE GENERATING:
1. Is the garage facing the STREET (not the backyard)?
2. Is the driveway connecting to the ROAD (not crossing into rear)?
3. Does the building fit WITHIN the white boundary lines?
4. Would this building's orientation make sense on a real suburban street?
5. FOR DUPLEX: Are garages BALANCED (not all on one side)?
6. FOR DUPLEX: Does each dwelling have equal street presence?

🧹 WATERMARK REMOVAL:
If the original image has any watermarks, logos, text overlays, or branding from real estate agencies, mapping services, or photography companies - REMOVE THEM COMPLETELY from the generated image. The output should be clean with no watermarks.

Generate a realistic, proportionally-sized ${contextTitle.toLowerCase()} that fits WITHIN the marked boundary with CORRECT street orientation.`;
    } else {
      // RENOVATION: Strategy-specific prompts
      const strategyLower = (strategyTitle || '').toLowerCase();
      
      // Define strategy-specific instructions
      let strategyInstructions = '';
      let allowedChanges = '';
      
      if (strategyLower.includes('kitchen')) {
        strategyInstructions = `FOCUS: Kitchen Modernisation
This is an INTERIOR kitchen renovation for a RESIDENTIAL HOME (not commercial).

⛔⛔⛔ ABSOLUTE RULE - READ THIS FIRST ⛔⛔⛔
This is a SINGLE FAMILY HOME kitchen. Australian homes have:
- EXACTLY 1 oven (ONE oven, not two, not three - ONE)
- EXACTLY 1 cooktop/hotplate (ONE, not two)
- EXACTLY 1 sink (ONE sink only)
- EXACTLY 1 rangehood

COUNT THE APPLIANCES IN THE ORIGINAL PHOTO. The renovated version MUST have the SAME COUNT.
If original has 1 oven → renovated has 1 oven
If original has 1 sink → renovated has 1 sink
DO NOT ADD EXTRA APPLIANCES. This is NOT a commercial kitchen.

⚠️ BEFORE GENERATING - ANALYSE:
1. Count ovens in photo: ___  (result must match)
2. Count cooktops in photo: ___ (result must match)
3. Count sinks in photo: ___ (result must match)`;
        allowedChanges = `
WHAT TO CHANGE (kitchen specific):
- Cabinetry: Replace with handleless shaker or flat-panel in white, grey, or natural timber
- Benchtops: Install Caesarstone, marble-look engineered stone, or timber
- Splashback: Add subway tiles, herringbone pattern, or feature tiles
- Appliances: UPGRADE the EXISTING appliances - modern stainless steel or integrated
- Lighting: Add pendant lights (if island exists), LED strip under cabinets
- Hardware: Modern matte black or brushed brass tapware and handles
- Flooring: Timber-look tiles or engineered timber (if visible)

⛔⛔⛔ APPLIANCE COUNT - NEVER BREAK THESE RULES ⛔⛔⛔
- ONE OVEN ONLY - if photo shows 1 oven, result has 1 oven. NEVER 2 ovens.
- ONE COOKTOP ONLY - if photo shows 1 cooktop, result has 1 cooktop. NEVER 2.
- ONE SINK ONLY - if photo shows 1 sink, result has 1 sink. NEVER 2 sinks.
- ONE RANGEHOOD ONLY - above the single cooktop
- This is a HOME kitchen, not a restaurant. Homes don't have double ovens side by side.
- UPGRADE the appliance quality, do NOT multiply the quantity

🚫 ISLAND BENCH RULES:
- ONLY add an island if there is MINIMUM 1 metre clearance on ALL sides
- If the kitchen is a GALLEY style (two parallel benches), DO NOT add an island
- If wall-to-wall distance is less than 3 metres, DO NOT add an island
- Islands should NOT have sinks or cooktops unless the original already did

🔍 FINAL CHECK BEFORE RENDERING:
□ Does result have same number of ovens as original? (should be 1)
□ Does result have same number of cooktops as original? (should be 1)
□ Does result have same number of sinks as original? (should be 1)
□ Does this look like a realistic Australian home kitchen?

DO NOT CHANGE: Wall positions, window locations, ceiling height, room shape`;
      } else if (strategyLower.includes('bathroom')) {
        strategyInstructions = `FOCUS: Bathroom Update
This is an INTERIOR bathroom renovation. Transform into a spa-like retreat.

⚠️ CRITICAL - ANALYSE THE SPACE FIRST:
1. Identify where WINDOWS are located
2. Count existing fixtures: toilet, basin(s), shower, bath
3. Note the vanity position and wall space available`;
        allowedChanges = `
WHAT TO CHANGE (bathroom specific):
- Tiles: Large format tiles, terrazzo, or marble-look porcelain
- Vanity: Floating timber or stone vanity with vessel basin
- Shower: Frameless glass, rainfall showerhead, matte black fixtures
- Tapware: Replace with matte black, brushed brass, or chrome
- Mirror: Large backlit mirror or round feature mirror ABOVE THE VANITY
- Lighting: Wall sconces, LED strip lighting
- Storage: Built-in niches, mirrored cabinets
- Bath: Freestanding bath if space permits
- Layout: You CAN reposition fixtures for a better layout

🚫 REALISTIC BATHROOM DESIGN RULES (CRITICAL - DO NOT BREAK):
- MIRRORS GO ONLY ABOVE VANITIES/BASINS - never over windows
- NEVER place a mirror where a window exists - windows let in light, mirrors reflect
- ONE toilet only (not two)
- ONE shower only (not two)
- ONE basin unless creating a deliberate double vanity
- ONE bath maximum (if space permits)
- If you see a window, that wall gets NO MIRROR - use the opposite wall
- Vanities with mirrors should be on SOLID WALLS, not window walls
- Fixtures CAN be repositioned for better flow
- But don't DUPLICATE fixtures - upgrade them, don't multiply them

🪟 WINDOW CHECK:
- Look for natural light sources - these are windows
- Windows MUST remain visible and unobstructed
- Place vanity + mirror on a wall WITHOUT windows
- If vanity is under a window, use a small shelf mirror that doesn't cover the window`;
      } else if (strategyLower.includes('granny') || strategyLower.includes('secondary dwelling') || strategyLower.includes('ancillary')) {
        strategyInstructions = `FOCUS: Detached Granny Flat / Secondary Dwelling
Add a NEW DETACHED granny flat or secondary dwelling in the backyard.`;
        allowedChanges = `
WHAT TO CREATE (granny flat specific):
- A SEPARATE, DETACHED building in the backyard (NOT attached to main house)
- Modern 1-2 bedroom self-contained dwelling
- Size: approximately 40-60 sqm footprint
- Style: Contemporary design matching or complementing the main house
- Include: Entry, living area, kitchenette, bedroom(s), bathroom
- Flat or skillion roof with clean lines
- Large windows/sliding doors for natural light
- Small private outdoor area or courtyard
- Separate pathway from main house

DESIGN STYLE:
- Modern Australian granny flat aesthetic
- Crisp white or grey render with timber accents
- Clean contemporary lines
- Landscaping around the new dwelling

⛔ RULES:
- The granny flat is DETACHED - separate from the main house
- Do NOT modify the main house
- Position in backyard with appropriate setbacks
- Include realistic scale (not too large for a backyard)`;
      } else if (strategyLower.includes('deck') || strategyLower.includes('outdoor') || strategyLower.includes('entertaining') || strategyLower.includes('alfresco')) {
        strategyInstructions = `FOCUS: Outdoor Entertaining Deck / Alfresco Area
Add or upgrade an outdoor entertaining area ATTACHED to the house.

⛔ THIS IS A DECK/ALFRESCO ONLY - NOT A GRANNY FLAT
You are adding an OPEN-AIR entertaining space, not a separate building.`;
        allowedChanges = `
WHAT TO CREATE (outdoor entertaining specific):
- A timber or composite DECK (Merbau, Spotted Gum, or ModWood)
- A pergola or roofed alfresco with timber or steel frame
- Outdoor kitchen area: BBQ, stone benchtop, bar fridge space
- Comfortable outdoor lounge and dining furniture
- Festoon lighting or integrated LED downlights
- Privacy screening: timber slats, plants, or louvres
- Ceiling fan if covered area
- Built-in bench seating or fire pit area
- Landscaping around the deck

⛔⛔⛔ DO NOT ADD THESE - WRONG STRATEGY ⛔⛔⛔
- DO NOT add a granny flat or secondary dwelling
- DO NOT add a separate building
- DO NOT add enclosed rooms with walls on all sides
- This is an OPEN or SEMI-OPEN outdoor entertaining space
- The deck should be ATTACHED to the house, not detached

CORRECT OUTPUT: An outdoor deck/alfresco area for entertaining
WRONG OUTPUT: A granny flat, studio, or separate building

DO NOT CHANGE: Main house structure, existing windows, doors
The deck should CONNECT to and complement the existing house style`;
      } else if (strategyLower.includes('solar') || strategyLower.includes('panel')) {
        strategyInstructions = `FOCUS: Solar Panel Installation
Add solar panels to the existing roof. This is a ROOF-ONLY change.`;
        allowedChanges = `
WHAT TO CHANGE (solar specific):
- Add black-framed solar panels to the roof (modern all-black panels preferred)
- Panels should be neatly arranged in rows on north or west-facing roof sections
- Include a Tesla Powerwall or battery storage unit on side of house (if visible)
- Show panels on the largest, most sun-exposed roof area

⛔⛔⛔ DO NOT CHANGE ANYTHING ELSE ⛔⛔⛔
- DO NOT change paint colors
- DO NOT change landscaping
- DO NOT change windows, doors, or facade
- DO NOT change roof shape or roof color
- ONLY add solar panels to the existing roof
- The house should look IDENTICAL except for solar panels`;
      } else if (strategyLower.includes('landscap') || strategyLower.includes('garden') || strategyLower.includes('curb')) {
        strategyInstructions = `FOCUS: Three Birds Style Curb Appeal & Front Landscaping
Transform the front yard into a magazine-worthy, coastal-luxe Australian streetscape.

🏠 THREE BIRDS RENOVATIONS AESTHETIC:
- Fresh, modern, welcoming street presence
- Layered planting with texture and depth
- Clean lines with organic softness
- "Undone but designed" natural look
- Instantly adds perceived value at first glance`;
        allowedChanges = `
WHAT TO CREATE (Three Birds curb appeal):

🌿 PLANTING PALETTE (coastal-luxe Australian):
- Hedging: Murraya, Lilly Pilly, Star Jasmine on fence
- Ornamental grasses: Lomandra, Blue Fescue, Pennisetum
- Feature plants: Agave, Bird of Paradise, Cycads
- Softening plants: Silver Bush, Westringia, Coastal Rosemary
- Trees: Ornamental Pear, Frangipani, Magnolia Little Gem, Olive
- Ground cover: Native violet, Dichondra, Star Jasmine

🛤️ HARDSCAPE (modern Australian):
- Paths: Large format concrete pavers or bluestone steppers
- Driveway: Exposed aggregate in warm grey or charcoal
- Edging: Corten steel garden bed edges (signature Three Birds)
- Letterbox: Modern concrete or timber post with black numbers
- Fencing: Horizontal timber slat or rendered wall with capping

✨ FINISHING TOUCHES:
- Mulch: Black or dark brown chunky mulch (fresh, generous layer)
- Lighting: Copper or black path lights, up-lights on feature trees
- Planters: Large white or concrete pots with topiary spheres or olive trees
- House numbers: Oversized modern numbers in matte black
- Entry: Frame the front door with symmetrical planting

🎨 THREE BIRDS DESIGN PRINCIPLES:
- Create DEPTH with layered planting (low → medium → tall)
- Add TEXTURE contrast (spiky grasses + soft shrubs + sculptural plants)
- Keep it CURATED - lush but intentional, not overgrown
- Frame the entry - draw the eye to the front door
- Balance symmetry with organic natural shapes
- Use a LIMITED colour palette (greens, whites, greys, warm timber)
- Add ONE statement feature (Frangipani, sculptural Agave, or Olive tree)

DO NOT CHANGE: House structure, windows, doors, roof, paint colors
TRANSFORM: Front yard, garden beds, lawn, driveway surface, paths, fencing
The house stays the same - only the landscaping gets the Three Birds treatment`;
      } else if (strategyLower.includes('facade') || strategyLower.includes('exterior') || strategyLower.includes('render') || strategyLower.includes('paint')) {
        strategyInstructions = `FOCUS: Facade Refresh
Update the exterior appearance with paint, render, and cosmetic improvements.`;
        allowedChanges = `
WHAT TO CHANGE (facade specific):
- Paint/Render: Fresh white, soft grey, or warm greige render
- Roof: Colorbond in Monument, Surfmist, Basalt, or terracotta tiles
- Window frames: Repaint to black or white aluminum look
- Front door: Statement door in black, timber, or feature color
- Gutters and fascia: Match roof or contrast in white
- Lighting: Modern wall-mounted entry lights
- House numbers: Contemporary large format numbers
- Fencing: Modern front fence if visible

DO NOT CHANGE: Building shape, window positions, door positions, roof line
Only surface finishes and colors should change`;
      } else {
        // Generic renovation fallback
        strategyInstructions = `FOCUS: General Cosmetic Renovation
Apply a modern, coastal-luxe Australian aesthetic to the existing building.`;
        allowedChanges = `
WHAT YOU CAN CHANGE (cosmetic only):
- Paint colors and render finishes (prefer crisp white or soft grey)
- Roof material/color (Colorbond in Monument, Surfmist, or Basalt)
- Window frames color (black or white aluminum)
- Front door style and color
- Landscaping, garden beds, and plants
- Driveway and path surfaces
- Fencing and gates
- Lighting fixtures
- Deck/patio surfaces (timber or composite decking)
- Gutters and fascia color`;
      }
      
      fullPrompt = `You are renovating an EXISTING RESIDENTIAL HOME (single family dwelling).
This is NOT a commercial property. This is a normal Australian HOUSE.

${strategyInstructions}

⛔⛔⛔ ABSOLUTE RULES - DO NOT BREAK THESE ⛔⛔⛔
1. KEEP THE EXACT SAME BUILDING - same shape, same walls, same roof line, same footprint
2. KEEP ALL WINDOWS in their EXACT current positions and sizes. DO NOT add, remove, or resize windows.
3. KEEP ALL DOORS in their EXACT current positions. DO NOT add, remove, or resize doors.
4. DO NOT add new openings or structural modifications.
5. DO NOT remove any existing walls or structural elements.
6. DO NOT change the roof shape or building silhouette.
7. DO NOT extend or modify the building structure in ANY way (no extensions, no new levels).
8. DO NOT DUPLICATE APPLIANCES - homes have ONE of each major appliance (1 oven, 1 cooktop, 1 sink)
${allowedChanges}

DESIGN STYLE: Three Birds Renovations / coastal-luxe Australian
- Modern, bright, airy aesthetic
- Clean lines, quality finishes
- Magazine-worthy presentation

🚨 CRITICAL: The STRUCTURE must be IDENTICAL to the original photo. Only make changes that are DIRECTLY RELEVANT to "${contextTitle}".
If the original has 3 windows, the result has 3 windows in the same positions.
If the original has a pitched roof, the result has the same pitched roof.

🧹 WATERMARK REMOVAL:
If the original image has any watermarks, logos, text overlays, or branding from real estate agencies, mapping services, or photography companies - REMOVE THEM COMPLETELY from the generated image. The output should be clean with no watermarks.

Generate a beautifully updated version focusing ONLY on ${contextTitle.toLowerCase()}, keeping everything else identical.`;
    }

    console.log(`[GenerateRenovation] Generating for: ${contextTitle}`);

    // Extract base64 data
    const base64Data = image.includes(',') ? image.split(',')[1] : image;

    // Check image size - reduce if too large
    const imageSizeKB = Math.round(base64Data.length * 0.75 / 1024);
    console.log(`[GenerateRenovation] Image size: ${imageSizeKB}KB`);
    
    if (imageSizeKB > 4000) {
      console.error('[GenerateRenovation] Image too large:', imageSizeKB, 'KB');
      return res.status(400).json({ error: 'Image too large. Please use a smaller image (under 4MB).' });
    }

    // Generate image (exact Three Birds pattern)
    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Data
              }
            },
            {
              text: fullPrompt
            }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9"
          }
        }
      });
    } catch (apiError) {
      console.error('[GenerateRenovation] API Error:', apiError.message);
      console.error('[GenerateRenovation] API Error details:', JSON.stringify(apiError, null, 2));
      return res.status(500).json({ 
        error: 'AI service error',
        message: apiError.message || 'Failed to connect to AI service'
      });
    }

    console.log('[GenerateRenovation] Response type:', typeof response);
    console.log('[GenerateRenovation] Response keys:', response ? Object.keys(response) : 'null');

    // Extract generated image (exact Three Birds pattern)
    let generatedImage = null;
    
    if (!response || !response.candidates || !response.candidates[0]) {
      console.error('[GenerateRenovation] Invalid response structure:', JSON.stringify(response).substring(0, 500));
      return res.status(500).json({ error: 'Invalid response from AI. Please try again.' });
    }

    for (const part of response.candidates[0]?.content?.parts || []) {
      if (part.inlineData) {
        generatedImage = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!generatedImage) {
      console.error('[GenerateRenovation] No image in response parts');
      // Check if there's text in response (might be an error message)
      const textPart = response.candidates[0]?.content?.parts?.find(p => p.text);
      if (textPart) {
        console.error('[GenerateRenovation] Response text:', textPart.text);
      }
      return res.status(500).json({ error: 'AI did not generate an image. Please try a different photo.' });
    }

    console.log(`[GenerateRenovation] Success for: ${contextTitle}`);

    return res.status(200).json({
      success: true,
      generatedImage,
      type: isDevelopment ? 'development' : 'renovation',
      context: contextTitle,
      // Credit info for frontend
      creditInfo: {
        wasFree: isFreeVisualization,
        creditsCharged: creditsDeducted ? CREDIT_COST_PER_VISUALIZATION : 0,
        totalVisualizationsNow: currentVisualizationCount + 1,
        freeLimit: FREE_VISUALIZATION_LIMIT
      }
    });

  } catch (error) {
    console.error('[GenerateRenovation] Error:', error.message);
    return res.status(500).json({ 
      error: 'Failed to generate visualisation',
      message: error.message
    });
  }
}

// Increase timeout for AI image generation (Gemini needs 30-60s)
export const config = {
  maxDuration: 60,
};
