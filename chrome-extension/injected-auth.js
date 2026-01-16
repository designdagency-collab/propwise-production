// Injected Script - Runs in page context (not extension context)
// Can access actual localStorage and Supabase session

(function() {
  console.log('[Upblock Injected] Script running in page context');
  
  function extractToken() {
    try {
      // Find Supabase auth key in localStorage
      const keys = Object.keys(localStorage);
      console.log('[Upblock Injected] localStorage keys:', keys.filter(k => k.includes('supabase')));
      
      const supabaseKey = keys.find(k => k.includes('supabase.auth.token'));
      
      if (!supabaseKey) {
        console.log('[Upblock Injected] No Supabase key found');
        return null;
      }
      
      const sessionData = JSON.parse(localStorage.getItem(supabaseKey));
      const token = sessionData?.access_token;
      const email = sessionData?.user?.email;
      
      console.log('[Upblock Injected] Found session for:', email);
      
      return { token, email };
    } catch (e) {
      console.error('[Upblock Injected] Error:', e);
      return null;
    }
  }
  
  // Extract token and send to content script via DOM event
  const authData = extractToken();
  
  if (authData) {
    console.log('[Upblock Injected] Sending token to extension...');
    window.dispatchEvent(new CustomEvent('upblock_auth_ready', {
      detail: authData
    }));
  } else {
    console.log('[Upblock Injected] No auth data found, will retry...');
    
    // Retry every 2 seconds for 10 seconds
    let attempts = 0;
    const retryInterval = setInterval(() => {
      attempts++;
      console.log('[Upblock Injected] Retry', attempts, '/5');
      
      const retryData = extractToken();
      if (retryData) {
        console.log('[Upblock Injected] ✓ Token found on retry!');
        window.dispatchEvent(new CustomEvent('upblock_auth_ready', {
          detail: retryData
        }));
        clearInterval(retryInterval);
      }
      
      if (attempts >= 5) {
        clearInterval(retryInterval);
        console.log('[Upblock Injected] Stopped retrying');
      }
    }, 2000);
  }
})();
