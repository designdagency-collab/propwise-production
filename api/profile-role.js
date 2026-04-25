// POST /api/profile-role
// Body: { role: 'homeowner' | 'subscriber' }
// Lets a logged-in user self-serve their own role between homeowner and
// subscriber (Developer / Buyers Agent). Admin role is never assignable
// from this endpoint — admins are flipped manually via SQL.
import { createClient } from '@supabase/supabase-js';

const ALLOWED_SELF_ROLES = ['homeowner', 'subscriber'];

export default async function handler(req, res) {
  const allowedOrigins = ['https://upblock.ai', 'https://www.upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.slice('Bearer '.length);

  const { role } = req.body || {};
  if (!role || !ALLOWED_SELF_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of ${ALLOWED_SELF_ROLES.join(', ')}` });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'Server configuration error' });

  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  // Don't downgrade an admin — admin keeps admin
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single();
  if (fetchError || !profile) return res.status(404).json({ error: 'Profile not found' });

  if (profile.role === 'admin' || profile.is_admin) {
    return res.status(200).json({ role: profile.role, message: 'Admins keep admin role; no change applied.' });
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (updateError) {
    console.error('[ProfileRole] Update error:', updateError);
    return res.status(500).json({ error: 'Failed to update role' });
  }

  console.log('[ProfileRole] Updated role for user', user.id.substring(0, 8), 'to', role);
  return res.status(200).json({ role });
}
