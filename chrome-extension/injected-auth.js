// Injected Script - Runs in page context (not extension context)
// Can access actual localStorage and Supabase session

(function() {
  console.log('[Upblock Injected] Script running in page context');
  
  function extractToken() {
    try {
      console.log('[Upblock Injected] === SEARCHING FOR AUTH ===');
      
      // METHOD 1: Check window.__upblock_auth (set by main app)
      if (window.__upblock_auth) {
        const { token, email } = window.__upblock_auth;
        console.log('[Upblock Injected] ✓ Found window.__upblock_auth:', email);
        return { token, email };
      }
      
      // METHOD 2: Check localStorage (direct from main app)
      const directToken = localStorage.getItem('upblock_extension_token');
      const directEmail = localStorage.getItem('upblock_extension_email');
      if (directToken) {
        console.log('[Upblock Injected] ✓ Found direct localStorage token:', directEmail);
        return { token: directToken, email: directEmail };
      }
      
      // METHOD 3: Check all localStorage keys
      const localKeys = Object.keys(localStorage);
      console.log('[Upblock Injected] All localStorage keys:', localKeys);
      console.log('[Upblock Injected] Detailed localStorage contents:');
      localKeys.forEach(key => {
        console.log(`  - ${key}: ${localStorage.getItem(key)?.substring(0, 50)}...`);
      });
      
      // METHOD 4: Check all sessionStorage keys
      const sessionKeys = Object.keys(sessionStorage);
      console.log('[Upblock Injected] All sessionStorage keys:', sessionKeys);
      
      // METHOD 5: Look for Supabase-specific keys
      const supabaseLocalKey = localKeys.find(k => 
        k.includes('supabase') && k.includes('auth')
      );
      const supabaseSessionKey = sessionKeys.find(k => 
        k.includes('supabase') && k.includes('auth')
      );
      
      if (supabaseLocalKey) {
        const data = JSON.parse(localStorage.getItem(supabaseLocalKey));
        console.log('[Upblock Injected] Supabase localStorage data:', data);
        return { token: data?.access_token, email: data?.user?.email };
      }
      
      if (supabaseSessionKey) {
        const data = JSON.parse(sessionStorage.getItem(supabaseSessionKey));
        console.log('[Upblock Injected] Supabase sessionStorage data:', data);
        return { token: data?.access_token, email: data?.user?.email };
      }
      
      console.log('[Upblock Injected] ❌ No auth found');
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
