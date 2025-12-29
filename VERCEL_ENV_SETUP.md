# Vercel Environment Variables Setup

## Where to Add Environment Variables

### ✅ Vercel Dashboard (Production)
Go to: **Your Project → Settings → Environment Variables**

Add these variables for **Production, Preview, and Development** environments:

### Frontend Variables (VITE_* - Available in Browser)
```
VITE_SUPABASE_URL=https://caakxchypohlpvpoxchg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhYWt4Y2h5cG9obHB2cG94Y2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2MjA4NjEsImV4cCI6MjA3MjE5Njg2MX0.qV-Xwc2HtRg8EpfbcZijqfluNDT1rBzMU5UCOpb5Zr8
```

### Server-Side Variables (API Routes - Server Only)
```
SUPABASE_URL=https://caakxchypohlpvpoxchg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_from_supabase_dashboard
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
GEMINI_API_KEY=your_gemini_api_key
FRONTEND_URL=https://your-vercel-app.vercel.app
```

### ⚠️ Important Notes:

1. **VITE_* variables** are exposed to the browser - only use for public keys (like Supabase anon key)
2. **Non-VITE variables** are server-only - use for secrets (Stripe secret, service role key, etc.)
3. **FRONTEND_URL** should be your Vercel deployment URL (e.g., `https://propwise.vercel.app`)
4. **Never commit** `.env.local` to git (it's in .gitignore)

### 🔐 Getting Your Keys:

- **Supabase Service Role Key**: https://supabase.com/dashboard/project/caakxchypohlpvpoxchg/settings/api
- **Stripe Keys**: https://dashboard.stripe.com/apikeys
- **Gemini API Key**: https://aistudio.google.com/app/apikey

### 📝 Local Development

For local development, create `.env.local` file (copy from `env.example`):
```bash
cp env.example .env.local
# Then edit .env.local with your actual keys
```

---

## Vercel Deployment Checklist

- [ ] Add all environment variables in Vercel Dashboard
- [ ] Set FRONTEND_URL to your Vercel app URL
- [ ] Configure Stripe webhook endpoint in Stripe Dashboard
- [ ] Enable Phone Auth in Supabase Dashboard
- [ ] Test deployment

