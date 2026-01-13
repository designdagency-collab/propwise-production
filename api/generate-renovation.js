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

DESIGN STYLE:
- Crisp white render with timber accents
- Modern flat or skillion roof with solar panels
- Contemporary glazing and balconies with railings
- Street-facing entry and garage (FACING THE ROAD)
- Rear private courtyard or garden

🚨 FINAL CHECK BEFORE GENERATING:
1. Is the garage facing the STREET (not the backyard)?
2. Is the driveway connecting to the ROAD (not crossing into rear)?
3. Does the building fit WITHIN the white boundary lines?
4. Would this building's orientation make sense on a real suburban street?

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
This is an INTERIOR kitchen renovation. Transform the existing kitchen into a modern, high-end cooking space.

⚠️ CRITICAL SPACE ANALYSIS - BEFORE ADDING ANYTHING:
1. MEASURE the visible floor space in the photo
2. Identify wall-to-wall distances and existing walkways
3. Note where appliances, sinks, and cooktops currently are
4. Check if there's ACTUALLY room for additional elements`;
        allowedChanges = `
WHAT TO CHANGE (kitchen specific):
- Cabinetry: Replace with handleless shaker or flat-panel in white, grey, or natural timber
- Benchtops: Install Caesarstone, marble-look engineered stone, or timber
- Splashback: Add subway tiles, herringbone pattern, or feature tiles
- Appliances: Show modern stainless steel or integrated appliances
- Lighting: Add pendant lights (if island exists), LED strip under cabinets
- Hardware: Modern matte black or brushed brass tapware and handles
- Flooring: Timber-look tiles or engineered timber (if visible)

🚫 ISLAND BENCH RULES (CRITICAL):
- ONLY add an island if there is MINIMUM 1 metre clearance on ALL sides
- If the kitchen is a GALLEY style (two parallel benches), DO NOT add an island
- If wall-to-wall distance is less than 3 metres, DO NOT add an island
- If there's already limited floor space visible, DO NOT add an island
- If in doubt, upgrade EXISTING benchtops instead of adding new ones
- A waterfall edge is ONLY appropriate on an EXISTING island, not a new one in a tight space

DO NOT CHANGE: Wall positions, window locations, ceiling height, room shape, overall kitchen footprint`;
      } else if (strategyLower.includes('bathroom')) {
        strategyInstructions = `FOCUS: Bathroom Update
This is an INTERIOR bathroom renovation. Transform into a spa-like retreat.`;
        allowedChanges = `
WHAT TO CHANGE (bathroom specific):
- Tiles: Large format tiles, terrazzo, or marble-look porcelain
- Vanity: Floating timber or stone vanity with vessel basin
- Shower: Frameless glass, rainfall showerhead, matte black fixtures
- Tapware: Replace with matte black, brushed brass, or chrome
- Mirror: Large backlit mirror or round feature mirror
- Lighting: Wall sconces, LED strip lighting
- Storage: Built-in niches, mirrored cabinets
- Bath: Freestanding bath if space permits

DO NOT CHANGE: Room layout, window positions, door location`;
      } else if (strategyLower.includes('deck') || strategyLower.includes('outdoor') || strategyLower.includes('entertaining') || strategyLower.includes('alfresco')) {
        strategyInstructions = `FOCUS: Outdoor Entertaining Deck
Add or upgrade an outdoor entertaining area attached to the house.`;
        allowedChanges = `
WHAT TO CHANGE (outdoor entertaining specific):
- Add a timber or composite deck (Merbau, Spotted Gum, or ModWood)
- Install a pergola or roofed alfresco with timber or steel frame
- Add outdoor kitchen: BBQ, stone benchtop, bar fridge space
- Include comfortable outdoor lounge and dining furniture
- Add festoon lighting or integrated LED downlights
- Install privacy screening: timber slats, plants, or louvres
- Include ceiling fan if covered
- Add built-in bench seating or fire pit area
- Landscape immediate surroundings with low-maintenance plants

DO NOT CHANGE: House structure, existing windows, doors, or walls
The deck should CONNECT to the house and complement its style`;
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
        strategyInstructions = `FOCUS: Landscaping & Garden Design
Upgrade the outdoor landscape and gardens while keeping the house structure identical.`;
        allowedChanges = `
WHAT TO CHANGE (landscaping specific):
- Plant selection: Native Australian plants, ornamental grasses, hedging
- Garden beds: Defined edges with corten steel or timber
- Lawn: Fresh green lawn or low-maintenance artificial turf
- Paths: Stepping stones, paved walkways, gravel paths
- Trees: Feature trees like Magnolia, Frangipani, or Ornamental Pear
- Mulch: Fresh brown or black mulch in garden beds
- Lighting: Garden uplights, path markers, feature lighting
- Planters: Large Mediterranean pots with topiary or olive trees
- Driveway: Exposed aggregate, pavers, or concrete if visible

DO NOT CHANGE: House structure, windows, doors, roof, paint colors
Only the landscaping and outdoor areas should be transformed`;
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
      
      fullPrompt = `You are renovating an EXISTING building. ${strategyInstructions}

⛔⛔⛔ ABSOLUTE RULES - DO NOT BREAK THESE ⛔⛔⛔
1. KEEP THE EXACT SAME BUILDING - same shape, same walls, same roof line, same footprint
2. KEEP ALL WINDOWS in their EXACT current positions and sizes. DO NOT add, remove, or resize windows.
3. KEEP ALL DOORS in their EXACT current positions. DO NOT add, remove, or resize doors.
4. DO NOT add new openings or structural modifications.
5. DO NOT remove any existing walls or structural elements.
6. DO NOT change the roof shape or building silhouette.
7. DO NOT extend or modify the building structure in ANY way (no extensions, no new levels).
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
