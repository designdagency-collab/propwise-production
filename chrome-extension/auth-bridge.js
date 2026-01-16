// Auth Bridge - Content Script that injects into page to read Supabase session
// Content scripts can't access page localStorage, so we inject a script

console.log('[Upblock Auth Bridge] ========================================');
console.log('[Upblock Auth Bridge] v1.2 Loaded on:', window.location.href);
console.log('[Upblock Auth Bridge] ========================================');

// Inject script into page context (can access real localStorage)
function injectAuthExtractor() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected-auth.js');
  script.onload = () => {
    console.log('[Upblock Auth Bridge] Injected auth extractor script');
  };
  (document.head || document.documentElement).appendChild(script);
}

// Listen for auth data from injected script
window.addEventListener('upblock_auth_ready', (event) => {
  const { token, email } = event.detail;
  
  console.log('[Upblock Auth Bridge] ✓ Received auth from page:', email);
  
  // Store in chrome.storage (extension-accessible)
  chrome.storage.local.set({
    upblock_auth_token: token,
    upblock_user_email: email
  }, () => {
    console.log('[Upblock Auth Bridge] ✅ Token saved to extension storage!');
    console.log('[Upblock Auth Bridge] ✅ Extension is now authenticated!');
    console.log('[Upblock Auth Bridge] ✅ Visit realestate.com.au to see scores');
    
    // Notify background script
    chrome.runtime.sendMessage({
      action: 'loggedIn',
      token: token,
      email: email
    });
  });
});

// Inject the script
injectAuthExtractor();

console.log('[Upblock Auth Bridge] Waiting for auth event from injected script...');
