# Upblock Score Chrome Extension

See Upblock investment scores on every property listing on realestate.com.au and domain.com.au.

## Features

- 🏠 **Instant Scores**: Shows Upblock score (0-100) on every listing
- ⚡ **Smart Caching**: Scores cached for 7 days to minimize API costs
- 🎨 **Color-Coded**: Green (80+), Yellow (60-79), Purple (40-59), Red (<40)
- 📱 **Progressive Loading**: Scores visible listings first, lazy loads the rest
- 🔒 **Secure**: Uses your existing Upblock account authentication

## Installation (Development)

1. **Enable Chrome Developer Mode**:
   - Open Chrome → Extensions (`chrome://extensions/`)
   - Toggle "Developer mode" (top right)

2. **Load Extension**:
   - Click "Load unpacked"
   - Select the `chrome-extension` folder

3. **Login**:
   - Click the Upblock extension icon
   - Click "Login to Upblock"
   - Login on upblock.ai
   - Extension will auto-detect your session

## Usage

1. Login to the extension (one-time setup)
2. Visit realestate.com.au or domain.com.au
3. Browse property listings
4. See Upblock scores appear automatically on each card
5. Click a score badge to see full report on Upblock

## Cost per User

With 7-day caching and progressive loading:
- **Light user** (10 pages/month): ~$0.35/month
- **Regular user** (50 pages/month): ~$1.75/month
- **Power user** (150 pages/month): ~$5.25/month

## Database Setup

Run this SQL in your Supabase database:

\`\`\`sql
-- Create quick scores cache table
CREATE TABLE IF NOT EXISTS quick_scores_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  address_key TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_score CHECK (score >= 0 AND score <= 100)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quick_scores_address ON quick_scores_cache(address_key);
CREATE INDEX IF NOT EXISTS idx_quick_scores_user ON quick_scores_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_quick_scores_cached ON quick_scores_cache(cached_at);

-- RLS
ALTER TABLE quick_scores_cache ENABLE ROW LEVEL SECURITY;

-- Users can read their own scores
CREATE POLICY "Users can read own scores" ON quick_scores_cache
  FOR SELECT USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access" ON quick_scores_cache
  FOR ALL USING (true);
\`\`\`

## Publishing to Chrome Web Store

1. **Create Icons** (16x16, 48x48, 128x128):
   - Replace placeholder PNG files with actual Upblock branded icons

2. **Zip Extension**:
   \`\`\`bash
   cd chrome-extension
   zip -r upblock-extension.zip ./*
   \`\`\`

3. **Submit to Chrome Web Store**:
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Pay $5 one-time fee (if first extension)
   - Upload `upblock-extension.zip`
   - Fill in store listing (description, screenshots, privacy policy)
   - Submit for review (1-3 days)

4. **Privacy Policy Required**:
   Create a page at `upblock.ai/privacy` that explains:
   - What data the extension collects (property addresses, auth tokens)
   - How it's used (to calculate investment scores)
   - That data is not shared with third parties

## File Structure

\`\`\`
chrome-extension/
├── manifest.json       # Extension configuration
├── content-script.js   # Runs on REA/Domain pages
├── background.js       # Service worker for auth
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic
├── styles.css          # Score badge styles
├── icon16.png          # Extension icon (16x16)
├── icon48.png          # Extension icon (48x48)
├── icon128.png         # Extension icon (128x128)
└── README.md           # This file
\`\`\`

## Troubleshooting

### No scores appearing:
1. Check if you're logged in (click extension icon)
2. Open DevTools Console and look for `[Upblock]` logs
3. Verify auth token in `chrome://extensions` → Upblock → Service worker → Console

### Scores not updating:
- Scores are cached for 7 days
- Clear cache: Right-click extension → "Inspect popup" → Console → `chrome.storage.local.clear()`

### API errors:
- Check Vercel logs for `/api/quick-score` endpoint
- Verify `DATABASE_URL` environment variable is set
- Ensure `quick_scores_cache` table exists in Supabase

## Support

For issues or questions:
- Email: support@upblock.ai
- Web: https://upblock.ai

## Version History

### 1.0.0 (Current)
- Initial release
- Support for realestate.com.au and domain.com.au
- Color-coded scores with 7-day caching
- Progressive loading for performance
