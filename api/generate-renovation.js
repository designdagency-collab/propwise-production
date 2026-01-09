// API endpoint for AI-powered renovation and development visualisation
// Uses @google/genai with gemini-2.5-flash-image model (same as Three Birds)

import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  // CORS
  const allowedOrigins = ['https://upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
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
      // DEVELOPMENT: Analyze site and camera position, then show brand new luxury development
      fullPrompt = `⚠️⚠️⚠️ BEFORE ANYTHING ELSE - LOOK FOR A BOUNDARY BOX/LINE ⚠️⚠️⚠️

There may be a RECTANGLE, SQUARE, or OUTLINE drawn on this image marking the property boundary.
- Look for: colored lines, boxes, rectangles, highlighted areas, borders
- Colors could be: red, yellow, blue, white, green, or any color
- It might be: solid line, dotted line, or shaded area

🚨 IF YOU SEE A BOUNDARY BOX/LINE:
- The building FOOTPRINT (base/ground floor) must fit WITHIN the marked area
- Do NOT extend the building footprint beyond the drawn lines
- You CAN build UP (height) - multi-story buildings are fine
- The boundary defines the land area, not height restrictions
- Fill the marked area with the development footprint

NOTE ON 3D PERSPECTIVE: When building tall structures, the 3D building will naturally COVER some of the 2D boundary lines drawn on the ground (the lines "behind" the building from camera view). This is OK - the building obscures those lines. But the VISIBLE boundary lines (front/sides you can still see) must still show the building respects them.

Now create a ${contextTitle.toLowerCase()} development:

STEP 2 - WHERE IS THE STREET?
Look for these clues to find the street:
- Driveways (they connect TO the street)
- Road surface, kerbs, footpaths
- Power poles, street lights, mailboxes
- How neighboring houses are oriented (their fronts face the street)

STEP 3 - WHERE IS THE CAMERA?
- If AERIAL looking down: the street edge has driveways connecting to it
- If street is at BOTTOM of image: camera is viewing from backyard/rear
- If street is at TOP of image: camera is viewing from street
- If street is LEFT or RIGHT: camera is viewing from side

STEP 4 - SHOW THE CORRECT SIDE OF THE BUILDING:
⚠️ DO NOT automatically show the pretty facade toward the camera!

- If viewing FROM THE REAR/BACKYARD: Show the BACK of the house (fences, back doors, clotheslines area, pool if any, rear landscaping, NO grand entrance)
- If viewing FROM THE STREET: Show the FRONT facade (entry, garage doors, front landscaping)
- If viewing FROM THE SIDE: Show the SIDE of the house (side fence, side windows)

The facade with the grand entry and garage doors ONLY faces the street. If camera is not on the street, you will NOT see the main facade.

STEP 5 - DESIGN:
- REMOVE existing structure
- NEW ${contextTitle} - luxury contemporary Australian architecture
- Crisp white render, timber accents, Colorbond roof
- Orient correctly based on steps above
- FIT WITHIN the property boundary lines if marked

DUPLEX SPECIFIC RULES:
- If block is WIDE (15m+ frontage): Use TWO SEPARATE driveways, one for each dwelling
- If block is NARROW: Use ONE SHARED driveway down the middle or side
- Each dwelling needs its own garage (single or double)
- Side-by-side duplex OR front-back configuration based on block shape
- Separate front entries for each dwelling

🚨 FINAL CHECK:
- Is there a boundary box/line drawn? Keep footprint INSIDE it. Height is OK.
- Facade faces street, camera might see back/side
- For apartments/multi-story: build tall within the boundary footprint`;
    } else {
      // RENOVATION: Keep structure, cosmetic updates only (Three Birds style)
      fullPrompt = `Transform this space into a Three Birds Renovations masterpiece (2026 Trend Edition).
BRIEF: "Luxe for Less" ${contextTitle.toLowerCase()} with modern finishes, quality fixtures, and contemporary styling.

STRICT VISUAL RULES:
- IF EXTERIOR: Enhance the facade with crisp white render or weatherboard. Install modern window frames and glass inserts. DO NOT show drapes or curtains on the exterior walls. Add a Colorbond roof, wide timber decking, and oversized Mediterranean pots.
- IF INTERIOR: Focus on the 'Cloud Bed' with oversized puffy quilts and pillows. Install floor-to-ceiling sheer linen drapes. Replace oyster lights with clean LED downlights and a sculptural pendant.
- Lighting Atmosphere: Magazine-quality, bright, airy, and coastal-luxe.
- Maintain the original structure but modernize all surface finishes, hardware, and textures.
- Keep the same building shape, windows, and doors in their current positions.`;
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
