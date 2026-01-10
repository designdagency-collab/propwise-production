// API endpoint for saving and loading AI visualizations per user per property
// Prevents abuse by caching generated images in Supabase

import { createClient } from '@supabase/supabase-js';

// Normalize address for consistent cache keys
function normalizeAddress(address) {
  return address.toLowerCase().trim().replace(/\s+/g, ' ');
}

export default async function handler(req, res) {
  // CORS
  const allowedOrigins = ['https://upblock.ai', 'https://www.upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[VisualizationCache] Missing Supabase credentials');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify user from auth header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const userId = user.id;

  // GET: Load cached visualizations for a property
  if (req.method === 'GET') {
    const { address } = req.query;
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const addressKey = normalizeAddress(address);

    try {
      const { data: cached, error } = await supabase
        .from('visualization_cache')
        .select('strategy_key, strategy_name, strategy_type, generated_image, created_at')
        .eq('user_id', userId)
        .eq('address_key', addressKey)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[VisualizationCache] Load error:', error);
        return res.status(500).json({ error: 'Failed to load cached visualizations' });
      }

      // Transform to the format expected by frontend
      const visualizations = {};
      if (cached && cached.length > 0) {
        cached.forEach(item => {
          if (!visualizations[item.strategy_key]) {
            visualizations[item.strategy_key] = [];
          }
          visualizations[item.strategy_key].push({
            beforeImage: '', // Original images are not stored
            afterImage: item.generated_image,
            title: item.strategy_name,
            type: item.strategy_type
          });
        });
      }

      console.log(`[VisualizationCache] Loaded ${cached?.length || 0} visualizations for user ${userId.substring(0, 8)}...`);
      return res.status(200).json({ visualizations, count: cached?.length || 0 });

    } catch (err) {
      console.error('[VisualizationCache] Error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // POST: Save a new visualization
  if (req.method === 'POST') {
    const { address, strategyKey, strategyName, strategyType, generatedImage } = req.body;

    if (!address || !strategyKey || !strategyName || !strategyType || !generatedImage) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const addressKey = normalizeAddress(address);

    try {
      // Check if visualization already exists for this user/property/strategy
      const { data: existing } = await supabase
        .from('visualization_cache')
        .select('id')
        .eq('user_id', userId)
        .eq('address_key', addressKey)
        .eq('strategy_key', strategyKey)
        .maybeSingle();

      if (existing) {
        // Update existing visualization
        const { error: updateError } = await supabase
          .from('visualization_cache')
          .update({
            generated_image: generatedImage,
            strategy_name: strategyName,
            strategy_type: strategyType,
            created_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error('[VisualizationCache] Update error:', updateError);
          return res.status(500).json({ error: 'Failed to update visualization' });
        }

        console.log(`[VisualizationCache] Updated visualization for ${strategyKey}`);
        return res.status(200).json({ success: true, updated: true });
      }

      // Insert new visualization
      const { error: insertError } = await supabase
        .from('visualization_cache')
        .insert({
          user_id: userId,
          address_key: addressKey,
          strategy_key: strategyKey,
          strategy_name: strategyName,
          strategy_type: strategyType,
          generated_image: generatedImage
        });

      if (insertError) {
        console.error('[VisualizationCache] Insert error:', insertError);
        return res.status(500).json({ error: 'Failed to save visualization' });
      }

      console.log(`[VisualizationCache] Saved visualization for ${strategyKey} by user ${userId.substring(0, 8)}...`);
      return res.status(200).json({ success: true, inserted: true });

    } catch (err) {
      console.error('[VisualizationCache] Error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

