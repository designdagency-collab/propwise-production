// API endpoint for AI-powered renovation and development visualisation
// Uses @google/genai with gemini-2.5-flash-image model (same as Three Birds)

import { GoogleGenAI } from "@google/genai";

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
  // TEMPORARILY DISABLED - skip all validation to debug generation issues
  // Re-enable once generation is confirmed working
  console.log(`[GenerateRenovation] Validation SKIPPED (temporarily disabled) for type: ${validationType}`);
  return { valid: true };
  
  /* VALIDATION DISABLED FOR DEBUGGING
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
    // Use gemini-2.0-flash-exp for validation (confirmed to work with this SDK)
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
          { text: validationPrompt }
        ]
      }
    });

    // Extract text from response - handle different response formats
    let analysisText = '';
    if (response.text) {
      analysisText = response.text;
    } else if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.text) {
          analysisText = part.text;
          break;
        }
      }
    }
    
    const analysis = analysisText.toLowerCase();
    console.log(`[GenerateRenovation] Image analysis: ${analysis.substring(0, 200)}...`);

    // Check if any of the required keywords are present in the analysis
    const matches = rule.keywords.some(keyword => analysis.includes(keyword.toLowerCase()));

    if (!matches) {
      console.log(`[GenerateRenovation] Validation FAILED - expected ${rule.description}`);
      return {
        valid: false,
        analysis: analysisText,
        expected: rule.description,
        errorMessage: rule.errorMessage
      };
    }

    console.log(`[GenerateRenovation] Validation PASSED`);
    return { valid: true, analysis: analysisText };

  } catch (err) {
    console.error(`[GenerateRenovation] Validation error:`, err.message);
    // If validation fails due to error, allow the request to proceed
    return { valid: true, error: err.message };
  }
  VALIDATION DISABLED FOR DEBUGGING */
}

// Strategy-specific design briefs (Three Birds style - simple and focused)
const RENOVATION_BRIEFS = {
  kitchen: `Modern Australian kitchen with stone benchtops, integrated appliances, pendant lighting, neutral cabinetry, and engineered timber floors.`,
  
  bathroom: `Spa-like bathroom retreat with walk-in rain shower, floating vanity, large format tiles, matte black fixtures, and ambient LED lighting.`,
  
  facade: `Modern Australian facade with crisp white render, Colorbond roof, slim-line window frames, timber accents, and landscaped front garden.`,
  
  landscaping: `Premium outdoor entertaining with timber decking, outdoor kitchen area, lush native plantings, and architectural lighting.`,
  
  flooring: `Premium wide-plank engineered timber flooring in warm oak, modern skirting boards, light-filled contemporary interior.`,
  
  energy: `Energy efficient home with solar panels on roof, modern double-glazed windows, LED downlights, sustainable upgrades.`,
  
  outdoor: `Resort-style outdoor living with quality decking, comfortable seating area, modern lighting, lush greenery, and shade structure.`,
  
  general: `"Luxe for Less" renovation with modern neutral palette, quality fixtures, LED downlights, fresh paint, and contemporary styling.`
};

// Development-specific design briefs
const DEVELOPMENT_BRIEFS = {
  duplex: `Modern Australian duplex with two contemporary dwellings, Colorbond roofing, rendered facades, landscaped front yards.`,
  
  townhouse: `Contemporary townhouse development with 2-4 attached dwellings, mixed cladding, modern rooflines, landscaped entries.`,
  
  knockdown: `New contemporary family home with clean architectural lines, large windows, double garage, landscaped gardens.`,
  
  subdivision: `Subdivision with 2-3 modern homes on separate lots, individual driveways, quality landscaping.`,
  
  grannyflat: `Secondary dwelling/granny flat addition - compact modern 1-2 bedroom dwelling with separate entry and private courtyard.`,
  
  apartment: `Boutique apartment building 3-4 stories with balconies, quality facade materials, street landscaping.`,
  
  mixed: `Mixed-use development with ground floor retail/commercial, apartments above, modern facade.`,
    
  general: `Modern residential development appropriate for the site with contemporary architecture and quality landscaping.`
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
    // Validate API key first
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[GenerateRenovation] GEMINI_API_KEY not configured');
      return res.status(500).json({ 
        error: 'API configuration error',
        message: 'Server is not properly configured. Please contact support.'
      });
    }

    const { image, type, strategyTitle, scenarioTitle, propertyAddress } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Initialize AI client with validated API key
    const ai = new GoogleGenAI({ apiKey });

    // Determine if this is a renovation or development visualisation
    const isDevelopment = type === 'development';
    
    // Get the appropriate prompt based on context
    let basePrompt;
    let contextTitle;
    
    // Get the design brief based on type
    let designBrief;
    
    if (isDevelopment) {
      contextTitle = scenarioTitle || 'Development';
      const scenarioLower = contextTitle.toLowerCase();
      if (scenarioLower.includes('duplex')) {
        designBrief = DEVELOPMENT_BRIEFS.duplex;
      } else if (scenarioLower.includes('townhouse') || scenarioLower.includes('town house')) {
        designBrief = DEVELOPMENT_BRIEFS.townhouse;
      } else if (scenarioLower.includes('knock') || scenarioLower.includes('rebuild') || scenarioLower.includes('new build')) {
        designBrief = DEVELOPMENT_BRIEFS.knockdown;
      } else if (scenarioLower.includes('subdiv')) {
        designBrief = DEVELOPMENT_BRIEFS.subdivision;
      } else if (scenarioLower.includes('granny') || scenarioLower.includes('secondary') || scenarioLower.includes('ancillary')) {
        designBrief = DEVELOPMENT_BRIEFS.grannyflat;
      } else if (scenarioLower.includes('apartment') || scenarioLower.includes('unit')) {
        designBrief = DEVELOPMENT_BRIEFS.apartment;
      } else if (scenarioLower.includes('mixed')) {
        designBrief = DEVELOPMENT_BRIEFS.mixed;
      } else {
        designBrief = DEVELOPMENT_BRIEFS.general;
      }
    } else {
      contextTitle = strategyTitle || 'Renovation';
      const strategyLower = contextTitle.toLowerCase();
      if (strategyLower.includes('kitchen')) {
        designBrief = RENOVATION_BRIEFS.kitchen;
      } else if (strategyLower.includes('bath') || strategyLower.includes('ensuite')) {
        designBrief = RENOVATION_BRIEFS.bathroom;
      } else if (strategyLower.includes('facade') || strategyLower.includes('exterior') || strategyLower.includes('street') || strategyLower.includes('curb')) {
        designBrief = RENOVATION_BRIEFS.facade;
      } else if (strategyLower.includes('energy') || strategyLower.includes('solar') || strategyLower.includes('efficiency') || strategyLower.includes('sustainable')) {
        designBrief = RENOVATION_BRIEFS.energy;
      } else if (strategyLower.includes('outdoor') || strategyLower.includes('living') || strategyLower.includes('entertainment') || strategyLower.includes('alfresco') || strategyLower.includes('deck') || strategyLower.includes('patio')) {
        designBrief = RENOVATION_BRIEFS.outdoor;
      } else if (strategyLower.includes('landscap') || strategyLower.includes('garden') || strategyLower.includes('backyard') || strategyLower.includes('yard')) {
        designBrief = RENOVATION_BRIEFS.landscaping;
      } else if (strategyLower.includes('floor')) {
        designBrief = RENOVATION_BRIEFS.flooring;
      } else {
        designBrief = RENOVATION_BRIEFS.general;
      }
    }

    // Build the full prompt (Three Birds style - simple and effective)
    const fullPrompt = `Transform this space into a premium Australian ${isDevelopment ? 'development' : 'renovation'} (2026 Trend Edition).
BRIEF: ${designBrief}

STRICT VISUAL RULES:
- IF EXTERIOR: Enhance the facade with crisp white render or weatherboard. Install modern window frames and glass inserts. DO NOT show drapes or curtains on the exterior walls. Add a Colorbond roof, wide timber decking, and landscaped gardens.
- IF INTERIOR: Focus on modern finishes, quality fixtures, LED downlights, and contemporary styling. Install floor-to-ceiling sheer linen drapes if windows visible.
- Lighting Atmosphere: Magazine-quality, bright, airy, and coastal-luxe.
- Maintain the original structure but modernize all surface finishes, hardware, and textures.`;

    console.log(`[GenerateRenovation] Generating ${isDevelopment ? 'development' : 'renovation'} visualization for: ${contextTitle}`);

    // Extract base64 data from data URL
    const base64Data = image.includes(',') ? image.split(',')[1] : image;

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
    console.log(`[GenerateRenovation] Calling Gemini API with model: gemini-2.5-flash-image`);
    console.log(`[GenerateRenovation] Image data length: ${base64Data.length} characters`);
    
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

    console.log(`[GenerateRenovation] Response received, candidates: ${response.candidates?.length || 0}`);
    if (response.candidates?.[0]?.content?.parts) {
      console.log(`[GenerateRenovation] Response parts: ${response.candidates[0].content.parts.length}`);
      response.candidates[0].content.parts.forEach((part, i) => {
        console.log(`[GenerateRenovation] Part ${i}: hasInlineData=${!!part.inlineData}, hasText=${!!part.text}`);
      });
    }

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
    console.error('[GenerateRenovation] Error name:', error.name);
    console.error('[GenerateRenovation] Error message:', error.message);
    console.error('[GenerateRenovation] Error stack:', error.stack);
    if (error.response) {
      console.error('[GenerateRenovation] Error response:', JSON.stringify(error.response, null, 2));
    }
    return res.status(500).json({ 
      error: 'Failed to generate visualisation',
      message: error.message,
      details: error.name || 'Unknown error'
    });
  }
}
