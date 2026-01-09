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
      fullPrompt = `🚨🚨🚨 CRITICAL: BOUNDARY LINES DETECTED 🚨🚨🚨

THIS IMAGE HAS PROPERTY BOUNDARY LINES DRAWN ON IT.
- Look carefully: there are WHITE/CREAM colored lines forming a SHAPE on this aerial view
- These lines mark the EXACT property boundary
- The lines may be: rectangles, irregular polygons, or outlined areas

⛔ ABSOLUTE RULE - NON-NEGOTIABLE:
The new building FOOTPRINT must be SMALLER than or EQUAL to the marked boundary area.
- DO NOT let any part of the building extend beyond the boundary lines
- The building must fit COMPLETELY INSIDE the drawn shape
- If the boundary is small, build a SMALLER building that fits
- If the boundary shows combined lots, you can build larger but STILL WITHIN the lines
- SHRINK the building if needed to fit - NEVER exceed the boundary
- Leave some SETBACK space from the boundary lines (don't build right to the edge)

✅ WHAT IS ALLOWED:
- Building UP (height/stories) - multi-story is fine within the footprint
- Using 70-85% of the marked area (leave setbacks from edges)
- Contemporary design that works within the space constraint

Now create a ${contextTitle.toLowerCase()} development:

SITE ANALYSIS:
1. Identify the BOUNDARY LINES first (white/colored lines marking property edge)
2. Measure mentally: how big is the boundary? Build SMALLER than that.
3. Find the STREET (driveways connect to it, power poles, neighboring house orientations)
4. Determine CAMERA POSITION relative to street

BUILDING ORIENTATION:
- Main facade with entry/garage faces the STREET
- If viewing from rear: show BACK of building (fences, rear doors, pool area)
- If viewing from side: show SIDE of building
- DO NOT show front facade if camera is not on street side

DESIGN BRIEF:
- REMOVE existing structures completely
- NEW ${contextTitle} - luxury contemporary Australian architecture
- Crisp white render, timber accents, Colorbond roof
- Make the building PROPORTIONAL to fit the boundary
- SMALLER boundary = SMALLER building footprint

DUPLEX RULES:
- Wide block (15m+): Two separate driveways
- Narrow block: One shared driveway
- Each dwelling gets own garage and separate entry

🔴 FINAL CHECK - MOST IMPORTANT:
1. Does the building footprint fit ENTIRELY within the boundary lines? If NO, SHRINK IT.
2. Is any wall, corner, or edge extending past the boundary? If YES, pull it back INSIDE.
3. Can you still see the boundary lines around the building edges? Good - that means it fits.
4. The building should look CONTAINED within the property lines, not overflowing them.`;
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
