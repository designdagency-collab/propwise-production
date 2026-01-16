// Upblock Score - Popup Script
// Handles user login and extension status

console.log('[Upblock Popup] Script loaded');

// Check login status on popup open
async function checkLoginStatus() {
  chrome.storage.local.get(['upblock_auth_token', 'upblock_user_email'], (result) => {
    updateUI(result.upblock_auth_token, result.upblock_user_email);
  });
}

function updateUI(token, email) {
  const loggedOutEl = document.getElementById('logged-out');
  const loggedInEl = document.getElementById('logged-in');
  const loginBtn = document.getElementById('login-btn');
  const accountBtn = document.getElementById('account-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const userEmailEl = document.getElementById('user-email');

  if (token) {
    // User is logged in
    loggedOutEl.style.display = 'none';
    loggedInEl.style.display = 'block';
    loginBtn.style.display = 'none';
    accountBtn.style.display = 'block';
    logoutBtn.style.display = 'block';
    
    if (email) {
      userEmailEl.textContent = email;
      userEmailEl.style.display = 'block';
    }
  } else {
    // User is logged out
    loggedOutEl.style.display = 'block';
    loggedInEl.style.display = 'none';
    loginBtn.style.display = 'block';
    accountBtn.style.display = 'none';
    logoutBtn.style.display = 'none';
    userEmailEl.style.display = 'none';
  }
}

// Login button handler - redirect to login page
document.getElementById('login-btn').addEventListener('click', () => {
  // Open Upblock login page with extension auth callback
  chrome.tabs.create({
    url: 'https://upblock.ai/?extension=login'
  });
  window.close();
});

// Account button handler - go to account settings
document.getElementById('account-btn').addEventListener('click', () => {
  chrome.tabs.create({
    url: 'https://upblock.ai/?view=account'
  });
  window.close();
});

// Logout button handler
document.getElementById('logout-btn').addEventListener('click', () => {
  chrome.storage.local.remove(['upblock_auth_token', 'upblock_user_email'], () => {
    // Notify background script
    chrome.runtime.sendMessage({ action: 'logout' });
    
    // Update UI
    checkLoginStatus();
    
    console.log('[Upblock Popup] Logged out');
  });
});

// Check status on load
checkLoginStatus();

// Listen for storage changes (in case user logs in from another tab)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.upblock_auth_token || changes.upblock_user_email)) {
    checkLoginStatus();
  }
});
