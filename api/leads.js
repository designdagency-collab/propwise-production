// GET /api/leads — paginated list of seller_interest leads for subscriber dashboard.
// PII is blurred unless the requesting subscriber has previously revealed the lead.
import { createClient } from '@supabase/supabase-js';

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 100;
const FREE_REVEALS = 5;

// Privacy helper — turns "42 Main St, Bondi NSW 2026" into "Bondi NSW".
function extractSuburb(fullAddress) {
  if (!fullAddress) return 'Unknown';
  const parts = fullAddress.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return fullAddress;
  // Drop street (first segment), drop trailing 4-digit postcode
  return parts.slice(1).join(', ').replace(/\s*\b\d{4}\b\s*$/, '').trim();
}

// Bands target price into $250k buckets so the exact figure isn't leaked.
function priceBand(targetPrice) {
  const dollars = Number(targetPrice);
  if (!dollars || isNaN(dollars)) return 'Price on enquiry';
  const bucket = 250_000;
  const low = Math.floor(dollars / bucket) * bucket;
  const high = low + bucket;
  return `$${(low / 1_000_000).toFixed(2)}M – $${(high / 1_000_000).toFixed(2)}M`;
}

function blur(lead) {
  return {
    id: lead.id,
    revealed: false,
    suburb: extractSuburb(lead.property_address),
    target_price_band: priceBand(lead.target_price),
    notes_preview: lead.notes ? String(lead.notes).slice(0, 60) + (lead.notes.length > 60 ? '…' : '') : null,
    created_at: lead.created_at,
  };
}

function unblur(lead) {
  return {
    id: lead.id,
    revealed: true,
    suburb: extractSuburb(lead.property_address),
    target_price_band: priceBand(lead.target_price),
    property_address: lead.property_address,
    target_price: lead.target_price,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    notes: lead.notes,
    created_at: lead.created_at,
  };
}

export default async function handler(req, res) {
  const allowedOrigins = ['https://upblock.ai', 'https://www.upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.slice('Bearer '.length);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'Server configuration error' });

  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  // Gate: subscriber role OR is_admin
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single();
  if (profileError || !profile) return res.status(403).json({ error: 'Profile not found' });
  if (profile.role !== 'subscriber' && profile.role !== 'admin' && !profile.is_admin) {
    return res.status(403).json({ error: 'Subscriber access required' });
  }

  // Pagination
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(PAGE_SIZE_MAX, Math.max(1, parseInt(req.query.limit || String(PAGE_SIZE_DEFAULT), 10)));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // ?revealedOnly=true returns only leads this subscriber has revealed
  // (used by the account settings page; lighter than fetching the full list).
  const revealedOnly = req.query.revealedOnly === 'true';

  try {
    // Resolve which lead IDs this subscriber has revealed (always needed)
    const { data: revealsData, error: revealsErr } = await supabase
      .from('lead_reveals')
      .select('lead_id, is_free, created_at')
      .eq('subscriber_id', user.id);
    if (revealsErr) throw revealsErr;

    const revealedIds = new Set((revealsData || []).map((r) => r.lead_id));

    // If revealedOnly: only fetch the leads in that set
    if (revealedOnly) {
      if (revealedIds.size === 0) {
        return res.status(200).json({
          items: [],
          total: 0,
          page: 1,
          limit: 0,
          free_reveals_total: FREE_REVEALS,
          free_reveals_remaining: FREE_REVEALS,
          lead_reveal_price_cents: 4900,
        });
      }
      const { data: ownedLeads, error: ownedErr } = await supabase
        .from('seller_interest')
        .select('id, property_address, target_price, name, phone, email, notes, created_at')
        .in('id', Array.from(revealedIds))
        .order('created_at', { ascending: false });
      if (ownedErr) throw ownedErr;

      const items = (ownedLeads || []).map(unblur);
      return res.status(200).json({
        items,
        total: items.length,
        page: 1,
        limit: items.length,
        free_reveals_total: FREE_REVEALS,
        free_reveals_remaining: Math.max(0, FREE_REVEALS - (revealsData || []).filter((r) => r.is_free).length),
        lead_reveal_price_cents: 4900,
      });
    }

    // Concurrent: leads page, total count, current price config (reveals already loaded above)
    const [leadsResult, countResult, priceResult] = await Promise.all([
      supabase
        .from('seller_interest')
        .select('id, property_address, target_price, name, phone, email, notes, created_at')
        .order('created_at', { ascending: false })
        .range(from, to),
      supabase
        .from('seller_interest')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('billing_calibration')
        .select('lead_reveal_price_cents')
        .eq('id', 'main')
        .maybeSingle(),
    ]);

    if (leadsResult.error) throw leadsResult.error;

    const freeRevealsUsed = (revealsData || []).filter((r) => r.is_free).length;
    const freeRevealsRemaining = Math.max(0, FREE_REVEALS - freeRevealsUsed);
    const priceCents = priceResult.data?.lead_reveal_price_cents ?? 4900;

    const items = (leadsResult.data || []).map((lead) =>
      revealedIds.has(lead.id) ? unblur(lead) : blur(lead)
    );

    return res.status(200).json({
      items,
      total: countResult.count || 0,
      page,
      limit,
      free_reveals_total: FREE_REVEALS,
      free_reveals_remaining: freeRevealsRemaining,
      lead_reveal_price_cents: priceCents,
    });
  } catch (error) {
    console.error('[Leads] List error:', error);
    return res.status(500).json({ error: 'Failed to fetch leads' });
  }
}
