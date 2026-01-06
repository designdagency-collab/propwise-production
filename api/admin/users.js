// Admin API - Search and manage users
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  // CORS
  const allowedOrigins = ['https://upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify the token and get user
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Check if user is an authorized admin email
  const { data: adminProfile, error: profileError } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single();

  // Authorized admin emails (hardcoded for security)
  const ADMIN_EMAILS = [
    'designd.agency@gmail.com'
  ];
  
  const isAuthorizedAdmin = ADMIN_EMAILS.includes(adminProfile?.email?.toLowerCase());
  if (profileError || !isAuthorizedAdmin) {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  
  console.log('[AdminUsers] Access granted for:', adminProfile?.email);

  try {
    // GET - Search users
    if (req.method === 'GET') {
      const { search, limit = 50, offset = 0 } = req.query;

      let query = supabase
        .from('profiles')
        .select(`
          id, email, full_name, phone, phone_verified,
          plan_type, search_count, credit_topups, pro_used, pro_month,
          referral_code, referral_count, referral_credits_earned,
          enterprise_waitlist, is_admin,
          created_at, updated_at, last_login_at
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply search filter
      if (search) {
        query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      const { data: users, error, count } = await query;

      if (error) {
        console.error('[AdminUsers] Search error:', error);
        return res.status(500).json({ error: 'Failed to search users' });
      }

      return res.status(200).json({ users, count });
    }

    // PATCH - Update user
    if (req.method === 'PATCH') {
      const { userId, updates } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      // Whitelist allowed fields for update
      const allowedFields = [
        'email', 'full_name', 'phone', 'phone_verified',
        'plan_type', 'credit_topups', 'pro_used', 'pro_month',
        'enterprise_waitlist', 'is_admin'
      ];

      const sanitizedUpdates = {};
      for (const [key, value] of Object.entries(updates || {})) {
        if (allowedFields.includes(key)) {
          sanitizedUpdates[key] = value;
        }
      }

      if (Object.keys(sanitizedUpdates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      // Add updated_at timestamp
      sanitizedUpdates.updated_at = new Date().toISOString();

      const { data: updatedUser, error: updateError } = await supabase
        .from('profiles')
        .update(sanitizedUpdates)
        .eq('id', userId)
        .select()
        .single();

      if (updateError) {
        console.error('[AdminUsers] Update error:', updateError);
        return res.status(500).json({ error: 'Failed to update user' });
      }

      console.log('[AdminUsers] User updated:', { userId, updates: sanitizedUpdates, by: user.id });

      return res.status(200).json({ user: updatedUser });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('[AdminUsers] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

