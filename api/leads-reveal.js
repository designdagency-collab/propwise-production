// POST /api/leads-reveal
// Body: { leadId: string }
// Behavior:
//   - If the subscriber has already revealed this lead → return its full PII.
//   - Else if they have free reveals remaining (< 5) → record a free reveal, return PII.
//   - Else → create a Stripe Checkout session for the configured price and return { stripeUrl }.
//     On payment success, the webhook (api/webhook.js) inserts the lead_reveals row.
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const FREE_REVEALS = 5;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'Server configuration error' });

  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  const { leadId } = req.body || {};
  if (!leadId) return res.status(400).json({ error: 'leadId is required' });

  // Gate: subscriber or admin
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, role, is_admin')
    .eq('id', user.id)
    .single();
  if (profileError || !profile) return res.status(403).json({ error: 'Profile not found' });
  if (profile.role !== 'subscriber' && profile.role !== 'admin' && !profile.is_admin) {
    return res.status(403).json({ error: 'Subscriber access required' });
  }

  try {
    // Fetch the lead first (404 if it doesn't exist)
    const { data: lead, error: leadError } = await supabase
      .from('seller_interest')
      .select('id, property_address, target_price, name, phone, email, notes, created_at')
      .eq('id', leadId)
      .single();
    if (leadError || !lead) return res.status(404).json({ error: 'Lead not found' });

    // Already revealed? Just return it.
    const { data: existingReveal } = await supabase
      .from('lead_reveals')
      .select('id')
      .eq('subscriber_id', user.id)
      .eq('lead_id', leadId)
      .maybeSingle();

    if (existingReveal) {
      return res.status(200).json({ revealed: true, lead, alreadyRevealed: true });
    }

    // Check free quota
    const { data: freeReveals } = await supabase
      .from('lead_reveals')
      .select('id', { count: 'exact' })
      .eq('subscriber_id', user.id)
      .eq('is_free', true);

    const freeUsed = freeReveals?.length || 0;

    if (freeUsed < FREE_REVEALS) {
      // Use a free reveal
      const { error: insertError } = await supabase
        .from('lead_reveals')
        .insert({
          subscriber_id: user.id,
          lead_id: leadId,
          is_free: true,
          amount_cents: 0,
        });
      if (insertError) {
        console.error('[LeadsReveal] Free-reveal insert error:', insertError);
        return res.status(500).json({ error: 'Failed to record reveal' });
      }
      return res.status(200).json({
        revealed: true,
        lead,
        usedFreeReveal: true,
        free_reveals_remaining: Math.max(0, FREE_REVEALS - (freeUsed + 1)),
      });
    }

    // Out of free reveals — create Stripe Checkout session
    const { data: priceConfig } = await supabase
      .from('billing_calibration')
      .select('lead_reveal_price_cents')
      .eq('id', 'main')
      .maybeSingle();
    const priceCents = priceConfig?.lead_reveal_price_cents ?? 4900;

    const baseUrl = 'https://upblock.ai';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: {
              name: 'upblock.ai Lead Reveal',
              description: 'Unlock seller contact details for one property lead.',
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}?leads=revealed&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}?leads=cancel`,
      customer_email: profile.email,
      metadata: {
        type: 'lead_reveal',
        leadId,
        subscriberId: user.id,
        priceCents: String(priceCents),
      },
    });

    return res.status(402).json({
      revealed: false,
      paymentRequired: true,
      stripeUrl: session.url,
      sessionId: session.id,
      lead_reveal_price_cents: priceCents,
    });
  } catch (error) {
    console.error('[LeadsReveal] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process reveal' });
  }
}
