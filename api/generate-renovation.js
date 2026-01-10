// API endpoint for AI-powered renovation and development visualisation
// Uses @google/genai with gemini-2.5-flash-image model (same as Three Birds)

import { GoogleGenAI } from "@google/genai";

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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[GenerateRenovation] GEMINI_API_KEY not configured');
      return res.status(500).json({ error: 'API configuration error' });
    }

    const { image, type, strategyTitle, scenarioTitle, propertyAddress } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const isDevelopment = type === 'development';
    const contextTitle = isDevelopment ? (scenarioTitle || 'Development') : (strategyTitle || 'Renovation');
    
    // Build prompt based on type
    let fullPrompt;
    
    if (isDevelopment) {
      // DEVELOPMENT: Strict boundary-respecting development
      fullPrompt = `STEP 1 - FIND THE BOUNDARY LINES FIRST:
Look at this aerial image. There are WHITE or CREAM colored lines drawn on it forming a shape (rectangle, square, or polygon). These lines show the PROPERTY BOUNDARY.

STEP 2 - MEASURE THE BOUNDARY SIZE:
The boundary in this image appears to be a SMALL to MEDIUM residential lot (approximately 600-1500 sqm based on the houses visible).

⛔⛔⛔ CRITICAL SIZE CONSTRAINT ⛔⛔⛔
Your new building MUST BE SMALL ENOUGH TO FIT INSIDE THOSE WHITE LINES.
- If the boundary shows space for 2-3 houses, build a SMALL development (duplex or townhouse)
- DO NOT build a massive apartment complex on a small lot
- The building footprint should use only 50-70% of the boundary area (leave setbacks)
- BUILD SMALL - you can go UP in height but NOT OUT past the boundary

WHAT TO CREATE: ${contextTitle}
- Remove existing buildings
- Build a NEW contemporary Australian development
- SCALE: Match the building size to the boundary size
- Small boundary = small building (duplex/townhouse)
- Large boundary = can be bigger (but still within lines)

DESIGN STYLE:
- Crisp white render with timber accents
- Modern flat or skillion roof with solar panels
- Contemporary glazing and balconies with railings
- Street-facing entry and garage

🚨 SIZE CHECK - BEFORE YOU GENERATE:
1. The white boundary lines should be VISIBLE around your building (not hidden under it)
2. The building should NOT extend past any boundary line
3. If in doubt, make the building SMALLER
4. Think: "Would this building actually fit on a typical suburban lot of this size?"

Generate a realistic, proportionally-sized ${contextTitle.toLowerCase()} that fits WITHIN the marked boundary.`;
    } else {
      // RENOVATION: Keep structure, cosmetic updates only (Three Birds style)
      fullPrompt = `You are renovating an EXISTING building. This is a ${contextTitle.toLowerCase()}.

⛔⛔⛔ ABSOLUTE RULES - DO NOT BREAK THESE ⛔⛔⛔
1. KEEP THE EXACT SAME BUILDING - same shape, same walls, same roof line, same footprint
2. KEEP ALL WINDOWS in their EXACT current positions and sizes
3. KEEP ALL DOORS in their EXACT current positions
4. DO NOT add new windows, doors, or openings
5. DO NOT remove any windows, doors, or walls
6. DO NOT change the roof shape or building silhouette
7. DO NOT extend or modify the building structure in ANY way

WHAT YOU CAN CHANGE (cosmetic only):
- Paint colors and render finishes (prefer crisp white or soft grey)
- Roof material (Colorbond in Monument, Surfmist, or Basalt)
- Window frames color (black or white aluminum)
- Front door style and color
- Landscaping, garden beds, and plants
- Driveway and path surfaces
- Fencing and gates
- Lighting fixtures
- Deck/patio surfaces (timber or composite decking)
- Gutters and fascia color

DESIGN STYLE: Three Birds Renovations / coastal-luxe Australian
- Modern, bright, airy aesthetic
- Mediterranean pots with greenery
- Clean lines, quality finishes
- Magazine-worthy presentation

🚨 CRITICAL: The STRUCTURE must be IDENTICAL to the original photo. Only surface finishes change.
If the original has 3 windows, the result has 3 windows in the same positions.
If the original has a pitched roof, the result has the same pitched roof.

Generate a beautifully renovated version that keeps the EXACT same building but with premium finishes.`;
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
      context: contextTitle
    });

  } catch (error) {
    console.error('[GenerateRenovation] Error:', error.message);
    return res.status(500).json({ 
      error: 'Failed to generate visualisation',
      message: error.message
    });
  }
}
