// Injected Script - Runs in page context (not extension context)
// Can access actual localStorage and Supabase session

(function() {
  console.log('[Upblock Injected] Script running in page context');
  
  function extractToken() {
    try {
      console.log('[Upblock Injected] Searching for Supabase session...');
      
      // Try localStorage first
      const localKeys = Object.keys(localStorage);
      console.log('[Upblock Injected] localStorage keys:', localKeys);
      let supabaseKey = localKeys.find(k => k.includes('supabase') || k.includes('auth'));
      
      // Try sessionStorage if not in localStorage
      if (!supabaseKey) {
        const sessionKeys = Object.keys(sessionStorage);
        console.log('[Upblock Injected] sessionStorage keys:', sessionKeys);
        supabaseKey = sessionKeys.find(k => k.includes('supabase') || k.includes('auth'));
        
        if (supabaseKey) {
          const sessionData = JSON.parse(sessionStorage.getItem(supabaseKey));
          const token = sessionData?.access_token;
          const email = sessionData?.user?.email;
          console.log('[Upblock Injected] ✓ Found in sessionStorage:', email);
          return { token, email };
        }
      } else {
        const sessionData = JSON.parse(localStorage.getItem(supabaseKey));
        const token = sessionData?.access_token;
        const email = sessionData?.user?.email;
        console.log('[Upblock Injected] ✓ Found in localStorage:', email);
        return { token, email };
      }
      
      // Last resort: check if there's a global window variable with session
      if (window.supabase?.auth) {
        console.log('[Upblock Injected] Trying window.supabase.auth...');
        // Can't directly call async getSession from here, so return null
      }
      
      console.log('[Upblock Injected] ❌ No Supabase session found in localStorage or sessionStorage');
      return null;
      
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
