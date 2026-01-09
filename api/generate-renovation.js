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
    
    // Simple design brief based on context
    let designBrief = isDevelopment 
      ? `Modern Australian ${contextTitle.toLowerCase()} with contemporary architecture, quality materials, and landscaping.`
      : `"Luxe for Less" ${contextTitle.toLowerCase()} with modern finishes, quality fixtures, and contemporary styling.`;

    // Build prompt (Three Birds style - simple and effective)
    const fullPrompt = `Transform this space into a Three Birds Renovations masterpiece (2026 Trend Edition).
BRIEF: ${designBrief}

STRICT VISUAL RULES:
- IF EXTERIOR: Enhance the facade with crisp white render or weatherboard. Install modern window frames and glass inserts. DO NOT show drapes or curtains on the exterior walls. Add a Colorbond roof, wide timber decking, and oversized Mediterranean pots.
- IF INTERIOR: Focus on the 'Cloud Bed' with oversized puffy quilts and pillows. Install floor-to-ceiling sheer linen drapes. Replace oyster lights with clean LED downlights and a sculptural pendant.
- Lighting Atmosphere: Magazine-quality, bright, airy, and coastal-luxe.
- Maintain the original structure but modernize all surface finishes, hardware, and textures.`;

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
