// Upblock Score - Background Service Worker
// Handles authentication state and listens for messages

console.log('[Upblock Background] Service worker started');

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Upblock Background] Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // Open welcome page
    chrome.tabs.create({
      url: 'https://upblock.ai/?extension=installed'
    });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Upblock Background] Message received:', request);

  if (request.action === 'needsLogin') {
    // User needs to login - set badge to remind them
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
    chrome.action.setTitle({ title: 'Upblock Score - Login Required' });
  }

  if (request.action === 'loggedIn') {
    // Clear badge
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setTitle({ title: 'Upblock Score' });
    
    // Store token
    if (request.token) {
      chrome.storage.local.set({ upblock_auth_token: request.token });
      console.log('[Upblock Background] Auth token stored');
    }
  }

  if (request.action === 'logout') {
    // Clear auth token
    chrome.storage.local.remove('upblock_auth_token');
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
    console.log('[Upblock Background] Logged out');
  }

  sendResponse({ success: true });
  return true;
});

// Check auth status on startup
chrome.storage.local.get(['upblock_auth_token'], (result) => {
  if (!result.upblock_auth_token) {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
    console.log('[Upblock Background] No auth token found');
  } else {
    console.log('[Upblock Background] Auth token exists');
  }
});
