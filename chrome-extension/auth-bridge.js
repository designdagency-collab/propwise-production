// Auth Bridge - Listens for auth messages from upblock.ai
// Runs on upblock.ai to capture login and send to extension

console.log('[Upblock Auth Bridge] Loaded');

// Listen for auth message from main app
window.addEventListener('message', (event) => {
  // Only accept messages from upblock.ai
  if (event.origin !== 'https://upblock.ai' && 
      event.origin !== 'https://www.upblock.ai' &&
      event.origin !== 'http://localhost:5173') {
    return;
  }

  if (event.data.type === 'UPBLOCK_AUTH') {
    console.log('[Upblock Auth Bridge] Received auth token');
    
    // Store in chrome.storage
    chrome.storage.local.set({
      upblock_auth_token: event.data.token,
      upblock_user_email: event.data.email
    }, () => {
      console.log('[Upblock Auth Bridge] Token saved to extension storage');
      
      // Notify background script
      chrome.runtime.sendMessage({
        action: 'loggedIn',
        token: event.data.token,
        email: event.data.email
      });
    });
  }
});

console.log('[Upblock Auth Bridge] Listening for auth messages');
