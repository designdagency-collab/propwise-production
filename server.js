
import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// Initialize Supabase client (optional - fails gracefully if not configured)
let supabase = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
} catch (error) {
  console.log('Supabase not configured, continuing without it');
}

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));
app.use(express.json());

// Single plan configuration
const PLAN_PRICES = {
  BUYER_PACK: {
    amount: 4900, // $49.00 AUD in cents
    currency: 'aud'
  }
};

// Create checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { plan } = req.body;

    if (!plan || !PLAN_PRICES[plan]) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    const planConfig = PLAN_PRICES[plan];
    const customerEmail = req.body.email || undefined;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'apple_pay'], // Added Apple Pay for AU convenience
      line_items: [
        {
          price_data: {
            currency: planConfig.currency,
            product_data: {
              name: 'Propwise Unlimited Access',
              description: 'Unlimited property intelligence audits and deep dive reports for one month.',
            },
            unit_amount: planConfig.amount,
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}?payment=cancel`,
      customer_email: customerEmail,
      metadata: {
        plan: plan,
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify session
app.get('/api/verify-session', async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status === 'paid') {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      
      res.json({
        success: true,
        plan: session.metadata.plan,
        subscriptionId: subscription.id,
        customerId: session.customer,
        status: subscription.status,
      });
    } else {
      res.json({
        success: false,
        payment_status: session.payment_status,
      });
    }
  } catch (error) {
    console.error('Session verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Capture email endpoint (optional - for future use)
app.post('/api/capture-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    // Store in Supabase if configured
    if (supabase) {
      // Could store email in a separate table or use Supabase Auth
      console.log('Email captured (Supabase configured):', email);
    } else {
      console.log('Email captured:', email);
    }
    res.json({ success: true, email });
  } catch (error) {
    console.error('Email capture error:', error);
    res.status(500).json({ error: 'Failed to capture email' });
  }
});

// Enhanced webhook handler for Stripe events
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_email;
    
    // Update subscription in Supabase if configured
    if (supabase && customerEmail) {
      try {
        // Try to find user by email in profiles table
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', customerEmail)
          .single();

        if (profile) {
          // Deactivate old subscriptions
          await supabase
            .from('subscriptions')
            .update({ status: 'inactive' })
            .eq('user_id', profile.id)
            .eq('status', 'active');

          // Create new subscription
          await supabase
            .from('subscriptions')
            .insert({
              user_id: profile.id,
              plan_type: session.metadata?.plan || 'BUYER_PACK',
              status: 'active',
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription
            });
        }
      } catch (error) {
        console.error('Supabase subscription update error:', error);
        // Continue - don't fail the webhook
      }
    }
  }

  res.json({ received: true });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Propwise server running on port ${PORT}`);
});
