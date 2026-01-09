// API endpoint for AI-powered renovation and development visualization
// Uses @google/genai with gemini-2.5-flash-image model (same as Three Birds)

import { GoogleGenAI } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '' });

// ========== IMAGE VALIDATION RULES ==========
// Each strategy type requires a specific kind of photo

const VALIDATION_RULES = {
  kitchen: {
    keywords: ['kitchen', 'cooking', 'benchtop', 'counter', 'cabinet', 'sink', 'stove', 'oven', 'cooktop', 'rangehood', 'pantry', 'splashback'],
    description: 'a kitchen interior',
    errorMessage: 'Please upload a photo of a kitchen interior (showing benchtops, cabinets, appliances, etc.)'
  },
  bathroom: {
    keywords: ['bathroom', 'ensuite', 'toilet', 'shower', 'bath', 'bathtub', 'vanity', 'basin', 'tiles', 'washroom', 'powder room'],
    description: 'a bathroom interior',
    errorMessage: 'Please upload a photo of a bathroom interior (showing shower, vanity, toilet, etc.)'
  },
  facade: {
    keywords: ['front', 'facade', 'exterior', 'street', 'entry', 'entrance', 'driveway', 'front door', 'house front', 'street view'],
    description: 'the front exterior of a house',
    errorMessage: 'Please upload a photo of the front/street-facing exterior of the house'
  },
  landscaping: {
    keywords: ['backyard', 'garden', 'outdoor', 'yard', 'patio', 'deck', 'lawn', 'rear', 'courtyard', 'alfresco', 'entertaining', 'pool area', 'grass'],
    description: 'a backyard or outdoor entertaining area',
    errorMessage: 'Please upload a photo of the backyard, garden, or outdoor entertaining area'
  },
  flooring: {
    keywords: ['interior', 'floor', 'room', 'living', 'bedroom', 'hallway', 'lounge', 'dining', 'carpet', 'timber floor', 'tiles'],
    description: 'an interior room showing the floor',
    errorMessage: 'Please upload a photo of an interior room where the flooring is visible'
  },
  energy: {
    keywords: ['roof', 'rooftop', 'aerial', 'ceiling', 'solar', 'roofline', 'tiles', 'colorbond', 'gutters'],
    description: 'a view showing the roof',
    errorMessage: 'Please upload a photo where the roof is clearly visible (aerial view or exterior showing roofline)'
  },
  development: {
    keywords: ['aerial', 'drone', 'land', 'lot', 'property', 'site', 'block', 'overhead', 'birds eye', 'vacant', 'plot', 'boundary'],
    description: 'an aerial/drone view of the property',
    errorMessage: 'Please upload an aerial or drone photo showing the land/property from above'
  }
};

// Validate that uploaded image matches the strategy type
async function validateImage(ai, base64Data, validationType) {
  // Skip validation for general renovations
  if (!validationType || validationType === 'general') {
    return { valid: true };
  }

  const rule = VALIDATION_RULES[validationType];
  if (!rule) {
    return { valid: true }; // No specific rule, allow
  }

  console.log(`[GenerateRenovation] Validating image for type: ${validationType}`);

  const validationPrompt = `Analyze this image and answer these questions:

1. What type of space or area does this image show? Be specific (e.g., "kitchen interior", "front facade of house", "backyard with lawn", "aerial view of property").

2. List the main elements visible in the image.

Keep your response concise - just 2-3 sentences maximum.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
          { text: validationPrompt }
        ]
      }
    });

    const analysis = (response.text || '').toLowerCase();
    console.log(`[GenerateRenovation] Image analysis: ${analysis.substring(0, 200)}...`);

    // Check if any of the required keywords are present in the analysis
    const matches = rule.keywords.some(keyword => analysis.includes(keyword.toLowerCase()));

    if (!matches) {
      console.log(`[GenerateRenovation] Validation FAILED - expected ${rule.description}`);
      return {
        valid: false,
        analysis: response.text,
        expected: rule.description,
        errorMessage: rule.errorMessage
      };
    }

    console.log(`[GenerateRenovation] Validation PASSED`);
    return { valid: true, analysis: response.text };

  } catch (err) {
    console.error(`[GenerateRenovation] Validation error:`, err.message);
    // If validation fails due to error, allow the request to proceed
    return { valid: true, error: err.message };
  }
}

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
- IF EXTERIOR: Enhance the facade with crisp white render or weatherboard. Install modern window frames. Add Colorbond roof and landscaped gardens. DO NOT show interior drapes on exterior.
- IF INTERIOR: Focus on modern finishes, quality fixtures, LED downlights, and contemporary styling.
- Lighting Atmosphere: Magazine-quality, bright, airy, and contemporary Australian.
- Maintain the original structure and camera angle but modernize all surface finishes, hardware, and textures.
- Do NOT add any text, watermarks, or labels.

AUSTRALIAN DESIGN SAFETY RULES (CRITICAL):
- NEVER place swimming pools in front yards - pools go in backyards only
- NEVER show BBQs, outdoor kitchens, or entertainment areas in front yards
- NEVER show air conditioning units visible from the street/front facade
- ALL balconies and elevated decks MUST have safety railings/balustrades
- NO large entertainment decking in front yards - front areas should have landscaping, paths, and driveways only
- Outdoor entertaining areas belong in backyards or side courtyards, not street-facing areas
- Front yards should feature: lawn/garden beds, driveway, entry path, and appropriate landscaping`;

    console.log(`[GenerateRenovation] Generating ${isDevelopment ? 'development' : 'renovation'} visualization for: ${contextTitle}`);

    // Extract base64 data from data URL
    const base64Data = image.includes(',') ? image.split(',')[1] : image;

    // Initialize AI (same pattern as Three Birds)
    const ai = getAI();

    // ========== VALIDATE IMAGE MATCHES STRATEGY TYPE ==========
    // Determine validation type based on strategy/scenario title
    let validationType = 'general';
    const titleLower = contextTitle.toLowerCase();

    if (titleLower.includes('kitchen')) {
      validationType = 'kitchen';
    } else if (titleLower.includes('bath') || titleLower.includes('ensuite')) {
      validationType = 'bathroom';
    } else if (titleLower.includes('facade') || titleLower.includes('exterior') || titleLower.includes('street appeal') || titleLower.includes('front')) {
      validationType = 'facade';
    } else if (titleLower.includes('landscap') || titleLower.includes('outdoor') || titleLower.includes('deck') || titleLower.includes('entertainment') || titleLower.includes('backyard') || titleLower.includes('alfresco') || titleLower.includes('patio')) {
      validationType = 'landscaping';
    } else if (titleLower.includes('energy') || titleLower.includes('solar') || titleLower.includes('roof')) {
      validationType = 'energy';
    } else if (titleLower.includes('floor')) {
      validationType = 'flooring';
    } else if (isDevelopment) {
      validationType = 'development';
    }

    // Validate the image
    const validation = await validateImage(ai, base64Data, validationType);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Image does not match strategy',
        message: validation.errorMessage || `This strategy requires ${validation.expected}. Please upload an appropriate photo.`,
        validationFailed: true,
        expected: validation.expected,
        analysis: validation.analysis
      });
    }

    // ========== GENERATE VISUALIZATION ==========
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
      description: `AI-generated ${isDevelopment ? 'development' : 'renovation'} visualisation for ${contextTitle}`
    });

  } catch (error) {
    console.error('[GenerateRenovation] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate visualisation',
      message: error.message 
    });
  }
}
