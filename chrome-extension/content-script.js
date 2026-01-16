// Upblock Score - Content Script
// Runs on realestate.com.au and domain.com.au
// Extracts property listings and injects score badges

console.log('[Upblock] ========================================');
console.log('[Upblock] Content script loaded - v1.0.1');
console.log('[Upblock] Current URL:', window.location.href);
console.log('[Upblock] ========================================');

// Configuration
const CONFIG = {
  API_URL: 'https://upblock.ai/api/quick-score',
  BATCH_SIZE: 8, // Process 8 listings at a time
  RETRY_ATTEMPTS: 2,
  CACHE_DURATION: 7 * 24 * 60 * 60 * 1000 // 7 days
};

// Site-specific selectors (updated Jan 2026)
const SELECTORS = {
  'realestate.com.au': {
    card: '[data-testid="ResidentialCard"], article[data-testid="residential-card"], div.residential-card',
    address: '[data-testid="address-line1"], .residential-card__address, .property-card__address',
    priceArea: '[data-testid="price"], .property-price',
    badgeContainer: '[data-testid="ResidentialCard"]'
  },
  'domain.com.au': {
    card: '[data-testid="listing-card-wrapper"], .css-qrqvdp',
    address: '[data-testid="address-line1"], .address',
    priceArea: '[data-testid="listing-card-price"], .price',
    badgeContainer: '.listing-card__details, .css-1qp9106'
  },
  'realcommercial.com.au': {
    card: '[data-testid="property-card"], article.property-card, .commercial-card',
    address: '[data-testid="address"], .property-address, .address',
    priceArea: '[data-testid="price"], .property-price, .price',
    badgeContainer: '.property-card'
  },
  'commercialrealestate.com.au': {
    card: '.property-card, .listing-card, article.property',
    address: '.property-address, .address, [itemprop="address"]',
    priceArea: '.price, .property-price',
    badgeContainer: '.property-card'
  }
};

// Get current site
function getCurrentSite() {
  const hostname = window.location.hostname;
  if (hostname.includes('realcommercial.com.au')) return 'realcommercial.com.au';
  if (hostname.includes('commercialrealestate.com.au')) return 'commercialrealestate.com.au';
  if (hostname.includes('realestate.com.au')) return 'realestate.com.au';
  if (hostname.includes('domain.com.au')) return 'domain.com.au';
  return null;
}

// Extract property listings from page
function extractListings() {
  const site = getCurrentSite();
  if (!site) return [];

  const selectors = SELECTORS[site];
  console.log('[Upblock] Using selectors for', site, ':', selectors);
  
  const cards = document.querySelectorAll(selectors.card);
  console.log(`[Upblock] Found ${cards.length} property cards using selector:`, selectors.card);
  
  if (cards.length === 0) {
    console.log('[Upblock] ⚠️ No cards found. Trying alternative selectors...');
    // Try broader selector
    const altCards = document.querySelectorAll('article, [class*="listing"], [class*="property"], [class*="card"]');
    console.log('[Upblock] Found', altCards.length, 'elements with alternative selector');
  }

  return Array.from(cards).map((card, index) => {
    // Try multiple methods to extract address
    let address = null;
    
    // Method 1: aria-label on card itself (REA current structure)
    address = card.getAttribute('aria-label');
    
    // Method 2: Child element with address selector
    if (!address) {
      const addressEl = card.querySelector(selectors.address);
      address = addressEl?.textContent?.trim();
    }
    
    // Method 3: Find any element with state abbreviation (NSW, VIC, etc)
    if (!address) {
      const textEls = Array.from(card.querySelectorAll('*'));
      const addressEl = textEls.find(el => {
        const text = el.textContent || '';
        return text.includes(', NSW') || text.includes(', VIC') || 
               text.includes(', QLD') || text.includes(', SA') ||
               text.includes(', WA') || text.includes(', TAS') ||
               text.includes(', NT') || text.includes(', ACT');
      });
      address = addressEl?.textContent?.trim();
    }
    
    // Extract actual price from REA (if shown)
    const priceEl = card.querySelector('.property-price, [class*="price"], [data-testid*="price"]');
    const reaPriceText = priceEl?.textContent?.trim();
    const reaPriceMatch = reaPriceText?.match(/\$[\d,]+/);
    const reaPrice = reaPriceMatch ? reaPriceMatch[0] : null;
    
    // Debug: Log price extraction
    if (index < 3) {
      console.log(`[Upblock] Card ${index} price extraction:`, {
        found: !!priceEl,
        text: reaPriceText,
        extracted: reaPrice
      });
    }
    
    if (!address) {
      console.log('[Upblock] Card', index, 'has no address');
    }
    
    // Skip if already processed (check both badge and address set)
    if (card.querySelector('.upblock-score-badge')) {
      return null;
    }
    
    // Skip if we've already processed this address (prevents duplicates)
    if (processedAddresses.has(address)) {
      return null;
    }

    return {
      index,
      card,
      address,
      reaPrice,  // Actual price from REA (or null if hidden)
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

// Fetch score and value from API
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
    return {
      score: data.score,
      estimatedValue: data.estimatedValue,
      confidence: data.confidence
    };
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

// Format price for display
function formatPrice(value) {
  if (!value) return null;
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

// Inject score badge into property card
function injectScoreBadge(listing, data) {
  const { card, selectors, reaPrice } = listing;
  const { score, estimatedValue, confidence } = data;

  // Determine what price to show
  let priceDisplay = null;
  let priceLabel = '';
  let tooltipText = `Upblock Score: ${score}/100\nClick for full analysis`;
  
  // Debug logging
  console.log(`[Upblock] Badge for ${listing.address}:`, {
    reaPrice,
    estimatedValue,
    willShow: reaPrice || formatPrice(estimatedValue)
  });
  
  if (reaPrice) {
    // REA shows actual price - use it
    priceDisplay = reaPrice;
    priceLabel = '';  // No "Est." label
    tooltipText = `Upblock Score: ${score}/100\nListed: ${reaPrice}\nClick for full analysis`;
  } else if (estimatedValue) {
    // REA hides price - show AI estimate with disclaimer
    priceDisplay = formatPrice(estimatedValue);
    priceLabel = 'Est. ';  // "Est. $1.2M"
    tooltipText = `Upblock Score: ${score}/100\nEst. Value: ${priceDisplay} (${confidence} confidence)\nPrice not public - AI estimate\nClick for full analysis`;
  }

  // Create badge element
  const badge = document.createElement('div');
  badge.className = `upblock-score-badge ${getScoreClass(score)}`;
  badge.title = tooltipText;
  
  badge.innerHTML = `
    <div class="upblock-score-content">
      <div class="upblock-score-top">
        <span class="upblock-score-value">${score}</span>
      </div>
      ${priceDisplay ? `
      <div class="upblock-price-row">
        <span class="upblock-price">${priceLabel}${priceDisplay}</span>
      </div>
      ` : ''}
      <div class="upblock-score-bottom">
        <svg class="upblock-icon" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
        </svg>
        <span class="upblock-label">upblock</span>
      </div>
    </div>
  `;

  // Add click handler to open full report with address pre-filled
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const url = `https://upblock.ai/?prefill=${encodeURIComponent(listing.address)}`;
    console.log('[Upblock] Opening full report for:', listing.address);
    window.open(url, '_blank');
  });

  // Find insertion point
  const container = card.querySelector(selectors.badgeContainer) || card;
  
  // Insert badge at the top
  if (container) {
    container.style.position = 'relative';
    container.insertBefore(badge, container.firstChild);
  }

  // Mark this address as processed
  processedAddresses.add(listing.address);
  
  console.log(`[Upblock] Injected score ${score} for:`, listing.address);
}

// Show loading indicator
function showLoadingBadge(card) {
  const badge = document.createElement('div');
  badge.className = 'upblock-score-badge loading';
  badge.title = 'Loading Upblock Score...';
  badge.innerHTML = `
    <div class="upblock-score-content">
      <div class="upblock-score-top">
        <span class="upblock-score-spinner">●</span>
      </div>
      <div class="upblock-score-bottom">
        <svg class="upblock-icon" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
        </svg>
        <span class="upblock-label">upblock</span>
      </div>
    </div>
  `;
  
  const container = card.querySelector('.residential-card__details, .property-card__details, .listing-card__details') || card;
  if (container) {
    container.style.position = 'relative';
    container.insertBefore(badge, container.firstChild);
  }
  
  return badge;
}

// Show page-level loading banner
function showLoadingBanner(total) {
  const banner = document.createElement('div');
  banner.id = 'upblock-loading-banner';
  banner.className = 'upblock-loading-banner';
  banner.innerHTML = `
    <div class="upblock-banner-content">
      <i class="upblock-spinner">⏳</i>
      <span class="upblock-banner-text">Loading Upblock Scores...</span>
      <span class="upblock-banner-count">0/${total}</span>
    </div>
  `;
  document.body.appendChild(banner);
  return banner;
}

// Update loading banner count
function updateLoadingBanner(loaded, total) {
  const banner = document.getElementById('upblock-loading-banner');
  if (banner) {
    const countEl = banner.querySelector('.upblock-banner-count');
    if (countEl) {
      countEl.textContent = `${loaded}/${total}`;
    }
    
    // Remove banner when complete
    if (loaded >= total) {
      setTimeout(() => {
        banner.style.opacity = '0';
        setTimeout(() => banner.remove(), 300);
      }, 500);
    }
  }
}

// Process listings in batches
async function processListings(listings, token) {
  if (!token) {
    console.log('[Upblock] No auth token - user needs to login');
    return;
  }

  // Show loading banner
  const banner = showLoadingBanner(listings.length);
  let loadedCount = 0;

  // Process visible listings first
  const visibleListings = listings.slice(0, CONFIG.BATCH_SIZE);
  
  console.log('[Upblock] Loading scores for first', visibleListings.length, 'visible listings...');
  
  for (const listing of visibleListings) {
    const loadingBadge = showLoadingBadge(listing.card);
    
    const data = await fetchScore(listing.address, token);
    
    // Remove loading badge
    if (loadingBadge) {
      loadingBadge.remove();
    }
    
    if (data !== null) {
      injectScoreBadge(listing, data);
      loadedCount++;
      updateLoadingBanner(loadedCount, listings.length);
      console.log(`[Upblock] ✓ Loaded ${loadedCount}/${listings.length} - Score: ${data.score}, Value: ${data.estimatedValue ? formatPrice(data.estimatedValue) : 'N/A'}`);
    }
  }

  // Process remaining listings lazily (when user scrolls)
  if (listings.length > CONFIG.BATCH_SIZE) {
    console.log('[Upblock] Remaining', listings.length - CONFIG.BATCH_SIZE, 'listings will load on scroll');
    observeScroll(listings.slice(CONFIG.BATCH_SIZE), token, loadedCount, listings.length);
  }
}

// Observe scroll to load scores for listings as they come into view
function observeScroll(remainingListings, token, initialLoadedCount, totalCount) {
  let loadedCount = initialLoadedCount;
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(async (entry) => {
      if (entry.isIntersecting) {
        const listing = remainingListings.find(l => l.card === entry.target);
        if (listing && !listing.processed) {
          listing.processed = true;
          const loadingBadge = showLoadingBadge(listing.card);
          const data = await fetchScore(listing.address, token);
          if (loadingBadge) loadingBadge.remove();
          if (data !== null) {
            injectScoreBadge(listing, data);
            loadedCount++;
            updateLoadingBanner(loadedCount, totalCount);
            console.log(`[Upblock] ✓ Loaded ${loadedCount}/${totalCount} (on scroll) - Score: ${data.score}, Value: ${data.estimatedValue ? formatPrice(data.estimatedValue) : 'N/A'}`);
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
  console.log('[Upblock] ========== INIT START ==========');
  
  // Clear any existing badges from previous page
  const oldBadges = document.querySelectorAll('.upblock-score-badge, .upblock-loading-banner');
  if (oldBadges.length > 0) {
    console.log('[Upblock] Clearing', oldBadges.length, 'old badges from previous page');
    oldBadges.forEach(badge => badge.remove());
  }
  
  const site = getCurrentSite();
  console.log('[Upblock] Current site:', site);
  
  if (!site) {
    console.log('[Upblock] ❌ Not on a supported site');
    return;
  }

  console.log('[Upblock] ✓ Site recognized:', site);

  // Get auth token
  console.log('[Upblock] Checking for auth token...');
  const token = await getAuthToken();
  
  if (!token) {
    console.log('[Upblock] ❌ No auth token found');
    console.log('[Upblock] → Please login: Click extension icon → "Login to Upblock"');
    chrome.runtime.sendMessage({ action: 'needsLogin' });
    return;
  }

  console.log('[Upblock] ✓ Auth token found');

  // Extract listings
  console.log('[Upblock] Extracting property listings...');
  const listings = extractListings();
  
  console.log('[Upblock] Found', listings.length, 'listings');
  
  if (listings.length === 0) {
    console.log('[Upblock] ⚠️ No listings found on page');
    console.log('[Upblock] → Make sure you\'re on a property search page');
    return;
  }

  console.log(`[Upblock] ✓ Processing ${listings.length} listings`);
  console.log('[Upblock] First 3 addresses:', listings.slice(0, 3).map(l => l.address));

  // Process listings
  await processListings(listings, token);
  
  console.log('[Upblock] ========== INIT COMPLETE ==========');
}

// Track which addresses we've processed to avoid duplicates
const processedAddresses = new Set();

// Track last URL to detect navigation (pagination, filters, etc)
let lastUrl = window.location.href;

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Monitor URL changes (for SPA navigation like pagination/sorting)
let urlChangeTimeout = null;
setInterval(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    console.log('[Upblock] URL changed (pagination/filter/sort)');
    lastUrl = currentUrl;
    
    // Clear any pending reload
    if (urlChangeTimeout) {
      clearTimeout(urlChangeTimeout);
    }
    
    // Debounce: Wait for URL to stop changing (handles multiple rapid changes during sort)
    urlChangeTimeout = setTimeout(() => {
      console.log('[Upblock] URL stable, clearing old data and reprocessing...');
      
      // Clear processed addresses set
      processedAddresses.clear();
      
      // Wait longer for REA to finish rendering new content
      setTimeout(() => {
        console.log('[Upblock] Reprocessing after navigation');
        init();
      }, 1500); // Increased from 1000ms to 1500ms
    }, 800); // Wait 800ms for URL to stabilize
  }
}, 500); // Check every 500ms

// Re-run when new listings are loaded (infinite scroll)
const observer = new MutationObserver((mutations) => {
  const hasNewListings = mutations.some(mutation => 
    Array.from(mutation.addedNodes).some(node => 
      node.nodeType === 1 && (
        node.matches?.('[data-testid="ResidentialCard"]') ||
        node.matches?.('article[data-testid="residential-card"]') ||
        node.matches?.('[data-testid="listing-card-wrapper"]') ||
        node.querySelector?.('[data-testid="ResidentialCard"]') ||
        node.querySelector?.('article[data-testid="residential-card"]') ||
        node.querySelector?.('[data-testid="listing-card-wrapper"]')
      )
    )
  );

  if (hasNewListings) {
    console.log('[Upblock] New listings detected (infinite scroll), processing...');
    setTimeout(init, 500); // Debounce
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log('[Upblock] Content script initialized');
