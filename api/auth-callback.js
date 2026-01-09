import { createClient } from '@supabase/supabase-js';

/**
 * Server-side OAuth callback handler
 * This handles the OAuth callback and establishes the session
 */
export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[AuthCallback] Missing Supabase config');
    return res.redirect('/?error=config');
  }

  // Get the code from the URL (PKCE flow)
  const code = req.query.code;
  const error = req.query.error;
  const errorDescription = req.query.error_description;

  console.log('[AuthCallback] Received:', { 
    hasCode: !!code, 
    error, 
    errorDescription,
    query: Object.keys(req.query)
  });

  if (error) {
    console.error('[AuthCallback] OAuth error:', error, errorDescription);
    return res.redirect(`/?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription || '')}`);
  }

  if (!code) {
    console.error('[AuthCallback] No code received');
    return res.redirect('/?error=no_code');
  }

  try {
    // Create a Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });

    // Exchange the code for a session
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('[AuthCallback] Exchange error:', exchangeError);
      return res.redirect(`/?error=exchange&message=${encodeURIComponent(exchangeError.message)}`);
    }

    if (!data.session) {
      console.error('[AuthCallback] No session returned');
      return res.redirect('/?error=no_session');
    }

    console.log('[AuthCallback] Session established for:', data.session.user.email);

    // Redirect back to the app with the access token in the hash
    // This allows the client-side code to pick it up
    const accessToken = data.session.access_token;
    const refreshToken = data.session.refresh_token;
    const expiresIn = data.session.expires_in;
    const tokenType = data.session.token_type || 'bearer';

    // Construct the hash fragment like Supabase implicit flow would
    const hashParams = new URLSearchParams({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: String(expiresIn),
      token_type: tokenType,
      type: 'signup' // or 'magiclink' depending on the flow
    });

    const redirectUrl = `https://upblock.ai/#${hashParams.toString()}`;
    console.log('[AuthCallback] Redirecting to app with tokens');
    
    return res.redirect(redirectUrl);

  } catch (err) {
    console.error('[AuthCallback] Exception:', err);
    return res.redirect(`/?error=exception&message=${encodeURIComponent(err.message)}`);
  }
}

