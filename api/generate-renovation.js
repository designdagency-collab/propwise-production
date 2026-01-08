// API endpoint for AI-powered renovation and development visualization
// Uses @google/genai with gemini-2.5-flash-image model (same as Three Birds)

import { GoogleGenAI } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '' });

// Strategy-specific prompts for renovations
const RENOVATION_PROMPTS = {
  kitchen: `Transform this kitchen into a luxurious modern Australian kitchen. 
    Include: stone benchtops, integrated appliances, pendant lighting, 
    soft-close cabinetry in a neutral palette, subway tile splashback, 
    and engineered timber flooring. Magazine-quality, bright and airy.`,
  
  bathroom: `Transform this bathroom into a spa-like retreat. 
    Include: freestanding bath or walk-in rain shower, floating vanity, 
    large format tiles, brushed brass or matte black fixtures, 
    frameless glass, and ambient LED lighting. Luxe hotel aesthetic.`,
  
  facade: `Transform this home's exterior facade into a modern Australian design. 
    Include: crisp white render or weatherboard, Colorbond roofing, 
    slim-line window frames, architectural timber accents, 
    landscaped front yard with native plants, and statement front door. 
    Magazine-quality street appeal.`,
  
  landscaping: `Transform this outdoor space into a premium entertaining area. 
    Include: timber or composite decking, outdoor kitchen/BBQ area, 
    lush native plantings, architectural lighting, 
    modern fencing, and seamless indoor-outdoor flow. 
    Resort-style Australian landscape design.`,
  
  flooring: `Transform this interior with premium flooring throughout. 
    Include: wide-plank engineered timber in a warm oak tone, 
    consistent throughout living areas, with plush carpet in bedrooms. 
    Modern skirting boards, and cohesive color palette. 
    Light-filled and contemporary.`,
  
  general: `Transform this space into a "Luxe for Less" renovation masterpiece. 
    Include: modern neutral palette, quality fixtures and fittings, 
    improved lighting with LED downlights, fresh paint, 
    updated flooring, and contemporary styling. 
    Bright, airy, and magazine-worthy.`
};

// Development-specific prompts for aerial/drone images
const DEVELOPMENT_PROMPTS = {
  duplex: `Render a modern Australian duplex development on this land. 
    Show: two contemporary 2-story dwellings side-by-side or front-back configuration, 
    individual driveways and garages, Colorbond roofing, 
    rendered facades with timber accents, landscaped front yards, 
    and clear property boundaries. Architectural visualization quality.`,
  
  townhouse: `Render a modern townhouse development on this land. 
    Show: 3-4 contemporary attached townhouses in a row, 
    individual entries and small courtyards, 
    mixed cladding (render, timber, brick), flat or skillion roofs, 
    visitor parking, and landscaped common areas. 
    High-end architectural render style.`,
  
  knockdown: `Render a new contemporary home on this cleared residential lot. 
    Show: a modern single or two-story family home, 
    double garage, landscaped gardens, 
    clean architectural lines, large windows, 
    outdoor entertaining area, and quality finishes. 
    Architectural visualization of a premium new build.`,
  
  subdivision: `Render a small subdivision development on this land. 
    Show: 2-3 separate modern dwellings on subdivided lots, 
    individual driveways and access, 
    contemporary Australian architectural style, 
    landscaping between properties, and clear lot boundaries. 
    Town planning visualization quality.`,
  
  grannyflat: `Render a secondary dwelling/granny flat addition to this property. 
    Show: a compact modern 1-2 bedroom dwelling in the backyard, 
    separate entry path, small private courtyard, 
    complementary design to main house, 
    and integrated landscaping. Architectural visualization.`,
  
  apartment: `Render a boutique apartment development on this site. 
    Show: a 3-4 story contemporary apartment building, 
    balconies on each unit, basement or undercroft parking, 
    quality facade materials, rooftop garden or amenities, 
    and landscaped street frontage. Architectural render quality.`,
  
  mixed: `Render a mixed-use development on this site. 
    Show: ground floor retail/commercial space with apartments above, 
    2-4 stories total, modern facade with varied materials, 
    street-level activation, and residential balconies. 
    Urban infill architectural visualization.`
};

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
    const { image, type, strategyTitle, scenarioTitle, propertyAddress } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Determine if this is a renovation or development visualization
    const isDevelopment = type === 'development';
    
    // Get the appropriate prompt based on context
    let basePrompt;
    let contextTitle;
    
    if (isDevelopment) {
      contextTitle = scenarioTitle || 'Development';
      const scenarioLower = contextTitle.toLowerCase();
      if (scenarioLower.includes('duplex')) {
        basePrompt = DEVELOPMENT_PROMPTS.duplex;
      } else if (scenarioLower.includes('townhouse') || scenarioLower.includes('town house')) {
        basePrompt = DEVELOPMENT_PROMPTS.townhouse;
      } else if (scenarioLower.includes('knock') || scenarioLower.includes('rebuild') || scenarioLower.includes('new build')) {
        basePrompt = DEVELOPMENT_PROMPTS.knockdown;
      } else if (scenarioLower.includes('subdiv')) {
        basePrompt = DEVELOPMENT_PROMPTS.subdivision;
      } else if (scenarioLower.includes('granny') || scenarioLower.includes('secondary') || scenarioLower.includes('ancillary')) {
        basePrompt = DEVELOPMENT_PROMPTS.grannyflat;
      } else if (scenarioLower.includes('apartment') || scenarioLower.includes('unit')) {
        basePrompt = DEVELOPMENT_PROMPTS.apartment;
      } else if (scenarioLower.includes('mixed')) {
        basePrompt = DEVELOPMENT_PROMPTS.mixed;
      } else {
        basePrompt = DEVELOPMENT_PROMPTS.duplex;
      }
    } else {
      contextTitle = strategyTitle || 'Renovation';
      const strategyLower = contextTitle.toLowerCase();
      if (strategyLower.includes('kitchen')) {
        basePrompt = RENOVATION_PROMPTS.kitchen;
      } else if (strategyLower.includes('bath')) {
        basePrompt = RENOVATION_PROMPTS.bathroom;
      } else if (strategyLower.includes('facade') || strategyLower.includes('exterior') || strategyLower.includes('street')) {
        basePrompt = RENOVATION_PROMPTS.facade;
      } else if (strategyLower.includes('landscap') || strategyLower.includes('outdoor') || strategyLower.includes('garden')) {
        basePrompt = RENOVATION_PROMPTS.landscaping;
      } else if (strategyLower.includes('floor')) {
        basePrompt = RENOVATION_PROMPTS.flooring;
      } else {
        basePrompt = RENOVATION_PROMPTS.general;
      }
    }

    // Build the full prompt (Three Birds style)
    const fullPrompt = `Transform this property image. ${basePrompt}

Property: ${propertyAddress || 'Australian residential property'}

STRICT VISUAL RULES:
- IF EXTERIOR: Enhance the facade with crisp white render or weatherboard. Install modern window frames. Add Colorbond roof, timber decking, and landscaped gardens. DO NOT show interior drapes on exterior.
- IF INTERIOR: Focus on modern finishes, quality fixtures, LED downlights, and contemporary styling.
- Lighting Atmosphere: Magazine-quality, bright, airy, and contemporary Australian.
- Maintain the original structure and camera angle but modernize all surface finishes, hardware, and textures.
- Do NOT add any text, watermarks, or labels.`;

    console.log(`[GenerateRenovation] Generating ${isDevelopment ? 'development' : 'renovation'} visualization for: ${contextTitle}`);

    // Extract base64 data from data URL
    const base64Data = image.includes(',') ? image.split(',')[1] : image;

    // Initialize AI (same pattern as Three Birds)
    const ai = getAI();

    // Generate image using gemini-2.5-flash-image (same as Three Birds)
    const response = await ai.models.generateContent({
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

    // Extract the generated image from the response (same pattern as Three Birds)
    let generatedImage = null;
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        generatedImage = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!generatedImage) {
      console.error('[GenerateRenovation] No image generated in response');
      return res.status(500).json({ 
        error: 'Failed to generate image',
        message: 'The AI model did not return an image. Please try again.'
      });
    }

    console.log(`[GenerateRenovation] Successfully generated ${isDevelopment ? 'development' : 'renovation'} image`);

    return res.status(200).json({
      success: true,
      generatedImage,
      type: isDevelopment ? 'development' : 'renovation',
      context: contextTitle,
      description: `AI-generated ${isDevelopment ? 'development' : 'renovation'} visualization for ${contextTitle}`
    });

  } catch (error) {
    console.error('[GenerateRenovation] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate visualization',
      message: error.message 
    });
  }
}
