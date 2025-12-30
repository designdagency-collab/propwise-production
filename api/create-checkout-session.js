import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Supabase client (optional)
let supabase = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
} catch (error) {
  console.log('Supabase not configured');
}

const PLAN_CONFIGS = {
  STARTER_PACK: {
    amount: 1900, // $19.00 AUD in cents
    currency: 'aud',
    name: 'upblock.ai Starter Pack',
    description: '3 property audit credits - one-time purchase',
    mode: 'payment', // One-time payment
  },
  PRO: {
    amount: 4900, // $49.00 AUD in cents
    currency: 'aud',
    name: 'upblock.ai Pro',
    description: '10 property audits per month',
    mode: 'subscription', // Monthly subscription
    interval: 'month',
  },
  // Legacy support
  BUYER_PACK: {
    amount: 4900,
    currency: 'aud',
    name: 'upblock.ai Pro',
    description: '10 property audits per month',
    mode: 'subscription',
    interval: 'month',
  }
};

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Hardcoded production URL - don't use env var to avoid misconfiguration
  const baseUrl = 'https://propwise-production.vercel.app';

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', baseUrl);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { plan, email } = req.body;

    if (!plan || !PLAN_CONFIGS[plan]) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    const planConfig = PLAN_CONFIGS[plan];

    // Build line items based on payment mode
    const lineItem = {
      price_data: {
        currency: planConfig.currency,
        product_data: {
          name: planConfig.name,
          description: planConfig.description,
        },
        unit_amount: planConfig.amount,
      },
      quantity: 1,
    };

    // Add recurring info for subscriptions
    if (planConfig.mode === 'subscription') {
      lineItem.price_data.recurring = {
        interval: planConfig.interval,
      };
    }

    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: [lineItem],
      mode: planConfig.mode,
      success_url: `${baseUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
      cancel_url: `${baseUrl}?payment=cancel`,
      metadata: {
        plan: plan,
      },
    };

    // Add customer email if provided
    if (email) {
      sessionConfig.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ error: error.message || 'Failed to create checkout session' });
  }
}
