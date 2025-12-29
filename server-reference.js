
/**
 * PROPWISE BACKEND REFERENCE (Node.js/Express)
 * This file contains the actual backend logic needed to run Stripe securely.
 * To use: 
 * 1. Initialize a Node project: `npm init -y`
 * 2. Install dependencies: `npm install express stripe dotenv cors`
 * 3. Add your Stripe Secret Key to a .env file: `STRIPE_SECRET_KEY=sk_test_...`
 */

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Main endpoint to create the Stripe Checkout Session
app.post('/api/create-checkout-session', async (req, res) => {
  const { plan } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'au_becs_debit'], // becs is popular in AU for subscriptions
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: {
              name: 'Propwise Buyer Pack',
              description: 'Unlimited property intelligence audits for 30 days.',
            },
            unit_amount: 4500, // $45.00 AUD
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // Redirect back to your app after success/cancel
      success_url: `${process.env.FRONTEND_URL}?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}?payment=cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Secure Stripe backend running on port ${PORT}`));
