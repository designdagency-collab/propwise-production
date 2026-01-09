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
      // DEVELOPMENT: Analyze site first, then show brand new luxury development
      fullPrompt = `Analyze this property image and create a brand new contemporary Australian ${contextTitle.toLowerCase()} development.

STEP 1 - ANALYZE THE SITE:
- Identify where the STREET/ROAD is in the image
- Determine the block orientation and shape
- Note any slopes, trees, or features to work with
- Identify the front boundary (street side)

STEP 2 - ORIENT THE DEVELOPMENT:
- Face the main entry and facade TOWARD the street
- Place driveway connecting to the street
- Position garages with logical street access
- Ensure the building sits correctly on the block

STEP 3 - DESIGN THE DEVELOPMENT:
- REMOVE the existing structure completely
- Show a NEW ${contextTitle} with luxury contemporary Australian architecture
- Clean modern lines, large windows, quality materials
- Crisp white render or weatherboard with timber/stone accents
- Colorbond roofing in modern charcoal or monument
- Landscaped front yard facing street, private backyard behind
- Premium finishes throughout

REQUIREMENTS:
- Building must face the correct direction (toward street)
- Driveway must connect logically to street access
- Modern architectural style suitable for 2024-2026
- High-end architectural visualization quality
- Magazine-worthy luxury development render`;
    } else {
      // RENOVATION: Keep structure, cosmetic updates only
      fullPrompt = `Transform this space into a Three Birds Renovations masterpiece (2026 Trend Edition).
BRIEF: "Luxe for Less" ${contextTitle.toLowerCase()} with modern finishes, quality fixtures, and contemporary styling.

CRITICAL - PRESERVE STRUCTURE:
- DO NOT change the building structure, shape, roofline, or layout
- Keep the EXACT same windows, doors, and architectural features in the same positions
- Only update surface finishes, paint, textures, fixtures, and styling
- The "bones" of the building must remain identical

VISUAL RULES:
- IF EXTERIOR: Update render/paint to crisp white, modern window frames, fresh Colorbond roof color, updated landscaping. Keep same building shape.
- IF INTERIOR: Update wall colors, flooring, light fixtures, window treatments, furniture styling. Keep same room layout.
- Lighting Atmosphere: Magazine-quality, bright, airy, and coastal-luxe.
- This is a COSMETIC renovation only - no structural changes.`;
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
