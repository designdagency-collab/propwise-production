import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, updates } = req.body;

  if (!userId || !updates) {
    return res.status(400).json({ error: 'Missing userId or updates' });
  }

  // Only allow specific fields to be updated
  const allowedFields = [
    'phone_recovery_prompted',
    'phone',
    'phone_verified',
    'full_name'
  ];

  const sanitizedUpdates = {};
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      sanitizedUpdates[key] = value;
    }
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  try {
    sanitizedUpdates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('profiles')
      .update(sanitizedUpdates)
      .eq('id', userId);

    if (error) {
      console.error('[UpdateProfile] Error:', error);
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    console.log('[UpdateProfile] Updated for user:', userId, Object.keys(sanitizedUpdates));
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[UpdateProfile] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

