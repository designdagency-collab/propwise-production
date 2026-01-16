// Upblock Score - Content Script
// Runs on realestate.com.au and domain.com.au
// Extracts property listings and injects score badges

console.log('[Upblock] Content script loaded');

// Configuration
const CONFIG = {
  API_URL: 'https://upblock.ai/api/quick-score',
  BATCH_SIZE: 8, // Process 8 listings at a time
  RETRY_ATTEMPTS: 2,
  CACHE_DURATION: 7 * 24 * 60 * 60 * 1000 // 7 days
};

// Site-specific selectors
const SELECTORS = {
  'realestate.com.au': {
    card: 'article[data-testid="residential-card"], div.residential-card',
    address: '.residential-card__address, [data-testid="address-line1"], .property-card__address',
    priceArea: '.property-price, [data-testid="price"]',
    badgeContainer: '.residential-card__details, .property-card__details'
  },
  'domain.com.au': {
    card: '[data-testid="listing-card-wrapper"], .css-qrqvdp',
    address: '[data-testid="address-line1"], .address',
    priceArea: '[data-testid="listing-card-price"], .price',
    badgeContainer: '.listing-card__details, .css-1qp9106'
  }
};

// Get current site
function getCurrentSite() {
  const hostname = window.location.hostname;
  if (hostname.includes('realestate.com.au')) return 'realestate.com.au';
  if (hostname.includes('domain.com.au')) return 'domain.com.au';
  return null;
}

// Extract property listings from page
function extractListings() {
  const site = getCurrentSite();
  if (!site) return [];

  const selectors = SELECTORS[site];
  const cards = document.querySelectorAll(selectors.card);
  
  console.log(`[Upblock] Found ${cards.length} property cards on ${site}`);

  return Array.from(cards).map((card, index) => {
    const addressEl = card.querySelector(selectors.address);
    const address = addressEl?.textContent?.trim();
    
    // Skip if already processed
    if (card.querySelector('.upblock-score-badge')) {
      return null;
    }

    return {
      index,
      card,
      address,
      selectors
    };
  }).filter(item => item && item.address);
}

// Get auth token from chrome.storage
async function getAuthToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['upblock_auth_token'], (result) => {
      if (result.upblock_auth_token) {
        console.log('[Upblock] Found auth token in storage');
      } else {
        console.log('[Upblock] No auth token found - please login at upblock.ai');
      }
      resolve(result.upblock_auth_token || null);
    });
  });
}

// Fetch score from API
async function fetchScore(address, token) {
  try {
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ address })
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.error('[Upblock] Unauthorized - please login at upblock.ai');
        return null;
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.score;
  } catch (error) {
    console.error('[Upblock] Error fetching score:', error);
    return null;
  }
}

// Get score color class
function getScoreClass(score) {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'average';
  if (score >= 20) return 'below-average';
  return 'poor';
}

// Inject score badge into property card
function injectScoreBadge(listing, score) {
  const { card, selectors } = listing;

  // Create badge element
  const badge = document.createElement('div');
  badge.className = `upblock-score-badge ${getScoreClass(score)}`;
  badge.innerHTML = `
    <div class="upblock-score-content">
      <span class="upblock-score-value">${score}</span>
      <span class="upblock-score-label">Upblock</span>
    </div>
  `;

  // Add click handler to open full report
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    window.open(`https://upblock.ai/?address=${encodeURIComponent(listing.address)}`, '_blank');
  });

  // Find insertion point
  const container = card.querySelector(selectors.badgeContainer) || card;
  
  // Insert badge at the top
  if (container) {
    container.style.position = 'relative';
    container.insertBefore(badge, container.firstChild);
  }

  console.log(`[Upblock] Injected score ${score} for:`, listing.address);
}

// Show loading indicator
function showLoadingBadge(card) {
  const badge = document.createElement('div');
  badge.className = 'upblock-score-badge loading';
  badge.innerHTML = `
    <div class="upblock-score-content">
      <span class="upblock-score-spinner">●</span>
    </div>
  `;
  
  const container = card.querySelector('.residential-card__details, .property-card__details, .listing-card__details') || card;
  if (container) {
    container.style.position = 'relative';
    container.insertBefore(badge, container.firstChild);
  }
  
  return badge;
}

// Process listings in batches
async function processListings(listings, token) {
  if (!token) {
    console.log('[Upblock] No auth token - user needs to login');
    return;
  }

  // Process visible listings first
  const visibleListings = listings.slice(0, CONFIG.BATCH_SIZE);
  
  for (const listing of visibleListings) {
    const loadingBadge = showLoadingBadge(listing.card);
    
    const score = await fetchScore(listing.address, token);
    
    // Remove loading badge
    if (loadingBadge) {
      loadingBadge.remove();
    }
    
    if (score !== null) {
      injectScoreBadge(listing, score);
    }
  }

  // Process remaining listings lazily (when user scrolls)
  if (listings.length > CONFIG.BATCH_SIZE) {
    observeScroll(listings.slice(CONFIG.BATCH_SIZE), token);
  }
}

// Observe scroll to load scores for listings as they come into view
function observeScroll(remainingListings, token) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(async (entry) => {
      if (entry.isIntersecting) {
        const listing = remainingListings.find(l => l.card === entry.target);
        if (listing && !listing.processed) {
          listing.processed = true;
          const loadingBadge = showLoadingBadge(listing.card);
          const score = await fetchScore(listing.address, token);
          if (loadingBadge) loadingBadge.remove();
          if (score !== null) {
            injectScoreBadge(listing, score);
          }
        }
      }
    });
  }, { rootMargin: '200px' });

  remainingListings.forEach(listing => {
    observer.observe(listing.card);
  });
}

// Main initialization
async function init() {
  const site = getCurrentSite();
  if (!site) {
    console.log('[Upblock] Not on a supported site');
    return;
  }

  console.log('[Upblock] Initializing on:', site);

  // Get auth token
  const token = await getAuthToken();
  if (!token) {
    console.log('[Upblock] No auth token found - please login at upblock.ai');
    // Show login prompt in extension popup
    chrome.runtime.sendMessage({ action: 'needsLogin' });
    return;
  }

  // Extract listings
  const listings = extractListings();
  if (listings.length === 0) {
    console.log('[Upblock] No listings found on page');
    return;
  }

  console.log(`[Upblock] Processing ${listings.length} listings`);

  // Process listings
  await processListings(listings, token);
}

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Re-run when new listings are loaded (infinite scroll / pagination)
const observer = new MutationObserver((mutations) => {
  const hasNewListings = mutations.some(mutation => 
    Array.from(mutation.addedNodes).some(node => 
      node.nodeType === 1 && (
        node.matches?.('article[data-testid="residential-card"]') ||
        node.matches?.('[data-testid="listing-card-wrapper"]') ||
        node.querySelector?.('article[data-testid="residential-card"]') ||
        node.querySelector?.('[data-testid="listing-card-wrapper"]')
      )
    )
  );

  if (hasNewListings) {
    console.log('[Upblock] New listings detected, processing...');
    setTimeout(init, 500); // Debounce
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log('[Upblock] Content script initialized');
