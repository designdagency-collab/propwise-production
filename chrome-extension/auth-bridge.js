// Auth Bridge - Automatically detects login on upblock.ai
// Runs on upblock.ai to capture Supabase session and send to extension

console.log('[Upblock Auth Bridge] ========================================');
console.log('[Upblock Auth Bridge] v1.1 Loaded on:', window.location.href);
console.log('[Upblock Auth Bridge] ========================================');

// Function to check for Supabase session and extract token
async function checkAndSendToken() {
  try {
    console.log('[Upblock Auth Bridge] Checking for Supabase session...');
    
    // Look for Supabase session in localStorage
    const storageKeys = Object.keys(localStorage);
    const supabaseKey = storageKeys.find(k => k.includes('supabase.auth.token'));
    
    if (!supabaseKey) {
      console.log('[Upblock Auth Bridge] No Supabase auth key found in localStorage');
      return;
    }
    
    const sessionData = JSON.parse(localStorage.getItem(supabaseKey));
    const token = sessionData?.access_token;
    const email = sessionData?.user?.email;
    
    if (!token) {
      console.log('[Upblock Auth Bridge] No access token in session data');
      return;
    }
    
    console.log('[Upblock Auth Bridge] ✓ Found token for:', email);
    
    // Store in chrome.storage
    chrome.storage.local.set({
      upblock_auth_token: token,
      upblock_user_email: email
    }, () => {
      console.log('[Upblock Auth Bridge] ✅ Token saved to extension storage');
      
      // Notify background script
      chrome.runtime.sendMessage({
        action: 'loggedIn',
        token: token,
        email: email
      });
      
      // Show success notification
      console.log('[Upblock Auth Bridge] ✅ Extension is now authenticated!');
      console.log('[Upblock Auth Bridge] ✅ Visit realestate.com.au to see scores');
    });
    
  } catch (error) {
    console.error('[Upblock Auth Bridge] Error:', error);
  }
}

// Check immediately on load
checkAndSendToken();

// Also check every 2 seconds for 10 seconds (in case session loads late)
let checkCount = 0;
const checkInterval = setInterval(() => {
  checkCount++;
  console.log('[Upblock Auth Bridge] Periodic check', checkCount, '/5');
  checkAndSendToken();
  
  if (checkCount >= 5) {
    clearInterval(checkInterval);
    console.log('[Upblock Auth Bridge] Stopped periodic checking');
  }
}, 2000);

// Also listen for postMessage (backup method)
window.addEventListener('message', (event) => {
  if (event.data.type === 'UPBLOCK_AUTH') {
    console.log('[Upblock Auth Bridge] Received postMessage auth');
    chrome.storage.local.set({
      upblock_auth_token: event.data.token,
      upblock_user_email: event.data.email
    });
  }
});

console.log('[Upblock Auth Bridge] Initialized - will check session every 2s for 10s');
