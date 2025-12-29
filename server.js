
import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

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

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Propwise server running on port ${PORT}`);
});
