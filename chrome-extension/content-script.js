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

// Parse price text into numeric value (handles $2.65m, $850k, $2,650,000 formats)
function parsePriceText(priceText) {
  if (!priceText) return null;
  
  const text = priceText.toLowerCase().trim();
  
  // Match price with optional decimal and suffix: $2.65m, $850k, $2,650,000
  const match = text.match(/\$\s*([\d,]+\.?\d*)\s*(m|mil|million|k|thousand)?/i);
  
  if (!match) return null;
  
  let value = parseFloat(match[1].replace(/,/g, ''));
  const suffix = match[2];
  
  if (suffix) {
    if (suffix.startsWith('m')) {
      value *= 1000000; // million
    } else if (suffix.startsWith('k') || suffix.startsWith('t')) {
      value *= 1000; // thousand
    }
  }
  
  return Math.round(value);
}

// Extract comparable prices from other listings on the page
function extractComparablePrices() {
  const site = getCurrentSite();
  if (!site) return [];
  
  const selectors = SELECTORS[site];
  const cards = document.querySelectorAll(selectors.card);
  const comparables = [];
  
  cards.forEach((card, index) => {
    if (index >= 20) return; // Only extract first 20 for context
    
    const priceEl = card.querySelector('.property-price, [class*="price"], [data-testid*="price"]');
    const priceText = priceEl?.textContent?.trim();
    const priceNum = parsePriceText(priceText);
    
    if (priceNum && priceNum > 0) {
      comparables.push(priceNum);
    }
  });
  
  console.log('[Upblock] Extracted', comparables.length, 'comparable prices from page');
  return comparables;
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
    
    let reaPrice = null;
    let reaPriceNumeric = null; // Store numeric value for API calculations
    let priceType = 'exact'; // 'exact', 'range', 'contact', 'auction'
    
    if (reaPriceText) {
      // Check for non-standard price formats
      const lowerPrice = reaPriceText.toLowerCase();
      
      if (lowerPrice.includes('contact') || lowerPrice.includes('express your interest')) {
        priceType = 'contact';
        reaPrice = null; // Don't show price, will fall back to AI estimate
        reaPriceNumeric = null;
      } else if (lowerPrice.includes('auction')) {
        // Check if auction has a guide price (e.g., "Auction - $2.65m guide")
        const guidePrice = parsePriceText(reaPriceText);
        if (guidePrice) {
          // Auction with guide price - treat as range
          priceType = 'range';
          reaPrice = `${formatPrice(guidePrice)}+`;
          reaPriceNumeric = guidePrice;
        } else {
          // Auction with no guide price
          priceType = 'auction';
          reaPrice = null;
          reaPriceNumeric = null;
        }
      } else if (lowerPrice.includes('over') || lowerPrice.includes('from') || lowerPrice.includes('interest')) {
        // "Buyers Interest over $550,000" or "From $750,000" or "From $2.65m"
        priceType = 'range';
        const numValue = parsePriceText(reaPriceText);
        if (numValue) {
          reaPrice = `${formatPrice(numValue)}+`;
          reaPriceNumeric = numValue; // Store for calculations
        }
      } else {
        // Standard price format: "$2,650,000" or "$2.65m" or "$850k"
        const numValue = parsePriceText(reaPriceText);
        if (numValue) {
          reaPrice = formatPrice(numValue);
          reaPriceNumeric = numValue; // Store for calculations
        }
      }
    }
    
    // Debug: Log price extraction
    if (index < 3) {
      console.log(`[Upblock] Card ${index} price extraction:`, {
        found: !!priceEl,
        text: reaPriceText,
        extracted: reaPrice,
        type: priceType
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
      reaPriceNumeric, // Numeric value for API calculations
      priceType, // 'exact', 'range', 'contact', 'auction'
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
async function fetchScore(address, token, comparables = [], askingPrice = null) {
  try {
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ address, comparables, askingPrice })
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.error('[Upblock] Unauthorized - please login at upblock.ai');
        return null;
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('[Upblock] API Response:', data);
    
    return {
      score: data.score,
      interestStars: data.interestStars,
      isCombinedLot: data.isCombinedLot || false,
      estimatedValue: data.estimatedValue,
      confidence: data.confidence,
      verified: data.verified || false,
      source: data.source || 'unknown'
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
  
  // Handle if value is already a formatted string (e.g., "$1,140,000")
  if (typeof value === 'string') {
    value = parseInt(value.replace(/[$,]/g, ''));
  }
  
  // Ensure it's a valid number
  if (isNaN(value) || value <= 0) return null;
  
  if (value >= 1000000) {
    const millions = value / 1000000;
    return millions % 1 === 0 ? `$${millions}M` : `$${millions.toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${Math.round(value / 1000)}k`;
  }
  return `$${value.toLocaleString()}`;
}

// Generate star display HTML
function generateStars(stars, verified) {
  const fullStar = '★';
  const emptyStar = '☆';
  let starHTML = '';
  for (let i = 1; i <= 5; i++) {
    starHTML += i <= stars ? fullStar : emptyStar;
  }
  return `<span class="upblock-stars">${starHTML}</span>`;
}

// Inject score badge into property card
function injectScoreBadge(listing, data) {
  const { card, selectors, reaPrice, priceType } = listing;
  let { score, interestStars, estimatedValue, confidence, verified, source, isCombinedLot } = data;
  
  // FALLBACK: If interestStars is missing, calculate from score (aligned with API)
  if (!interestStars && score !== undefined) {
    if (score >= 75) interestStars = 5;      // 75-100: Exceptional
    else if (score >= 60) interestStars = 4;  // 60-74: Good
    else if (score >= 40) interestStars = 3;  // 40-59: Average (most common)
    else if (score >= 20) interestStars = 2;  // 20-39: Below average
    else interestStars = 1;                   // 0-19: Poor
    console.log('[Upblock] Calculated fallback stars from score:', score, '→', interestStars);
  }
  
  // Safety check
  if (!interestStars || interestStars < 1 || interestStars > 5) {
    interestStars = 3; // default to middle rating
    console.warn('[Upblock] Invalid interestStars, defaulting to 3');
  }

  // CRITICAL: Remove any existing badges on this card first (prevents doubling)
  const existingBadges = card.querySelectorAll('.upblock-score-badge');
  existingBadges.forEach(b => b.remove());

  // Determine what price to show
  let priceDisplay = null;
  let priceLabel = '';
  
  // Build tooltip and label based on stars and verification
  let tooltipText = '';
  let badgeLabel = '';
  
  if (verified && score) {
    // Property has been fully audited - show true score
    if (isCombinedLot) {
      tooltipText = `Combined Lot - Development Opportunity!\nInterest Rating: ${interestStars}/5 ★\nUpblock Score: ${score}/100\nFully audited - click to view details`;
      badgeLabel = 'DEV OPP';
    } else {
      tooltipText = `Interest Rating: ${interestStars}/5 ★\nUpblock Score: ${score}/100\nFully audited - click to view details`;
      badgeLabel = 'VERIFIED';
    }
  } else {
    // AI estimate for browsing - dynamic punchy labels
    if (isCombinedLot) {
      tooltipText = `🔥 Combined Lot Detected!\nInterest Rating: ${interestStars}/5 ★\nMajor development potential - dual occupancy, duplex, or townhouses.\n\nClick for full development analysis.`;
      badgeLabel = 'DEV OPP!';
    } else {
      tooltipText = `Interest Rating: ${interestStars}/5 ★\nBased on location, property type, and development potential.\n\nClick for full investment analysis and true Upblock Score.`;
      
      // Dynamic punchy labels based on star rating
      if (interestStars === 5) badgeLabel = 'LOOK!';
      else if (interestStars === 4) badgeLabel = 'KEEN';
      else if (interestStars === 3) badgeLabel = 'MAYBE';
      else if (interestStars === 2) badgeLabel = 'PASS';
      else badgeLabel = 'NAH';
    }
  }
  
  // Debug logging
  console.log(`[Upblock] Badge for ${listing.address.substring(0, 40)}:`, {
    stars: interestStars,
    verified,
    score,
    source,
    isCombinedLot,
    reaPrice,
    estimatedValue: estimatedValue ? `$${(estimatedValue/1000).toFixed(0)}k` : 'none',
    priceToShow: priceDisplay
  });
  
  if (reaPrice) {
    // REA shows actual price - use it
    priceDisplay = reaPrice;
    priceLabel = '';
  } else if (estimatedValue) {
    // REA hides price - show AI estimate
    priceDisplay = formatPrice(estimatedValue);
    priceLabel = 'Est. ';
  }

  // Determine badge color class (use stars for coloring now)
  let colorClass = 'average';
  if (interestStars >= 4) colorClass = 'excellent';
  else if (interestStars >= 3) colorClass = 'good';
  else if (interestStars >= 2) colorClass = 'average';
  else colorClass = 'below-average';
  
  // Combined lots get special emphasis
  if (isCombinedLot) {
    colorClass = 'excellent'; // Always use gold/excellent color for combined lots
  }

  // Create badge element
  const badge = document.createElement('div');
  badge.className = `upblock-score-badge ${colorClass} ${verified ? 'verified' : 'preview'} ${isCombinedLot ? 'combined-lot' : ''}`;
  badge.title = tooltipText;
  badge.setAttribute('data-upblock-address', listing.address);
  badge.setAttribute('data-upblock-stars', interestStars);
  badge.setAttribute('data-upblock-verified', verified);
  badge.setAttribute('data-upblock-combined', isCombinedLot);
  
  badge.innerHTML = `
    <div class="upblock-score-content">
      <div class="upblock-score-top">
        ${generateStars(interestStars, verified)}
        <span class="upblock-star-count">${interestStars}/5</span>
      </div>
      <div class="upblock-score-middle">
        <img src="${chrome.runtime.getURL('upblock-logo.png')}" class="upblock-logo-img" alt="upblock" />
        <span class="upblock-score-text">${badgeLabel}</span>
      </div>
      ${priceDisplay ? `
      <div class="upblock-price-row">
        <span class="upblock-price">${priceLabel}${priceDisplay}</span>
      </div>
      ` : ''}
      ${verified && score ? `
      <div class="upblock-verified-score">
        <span class="upblock-verified-label">Score: ${score}</span>
      </div>
      ` : ''}
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

  // CONSISTENT INSERTION: Always insert at card level for consistent positioning
  card.style.position = 'relative';
  card.insertBefore(badge, card.firstChild);

  // Mark this address as processed
  processedAddresses.add(listing.address);
  
  console.log(`[Upblock] Injected ${interestStars}★ badge for:`, listing.address);
}

// Show loading indicator
function showLoadingBadge(card) {
  // Remove any existing badges first
  const existingBadges = card.querySelectorAll('.upblock-score-badge');
  existingBadges.forEach(b => b.remove());
  
  const badge = document.createElement('div');
  badge.className = 'upblock-score-badge loading';
  badge.title = 'Loading Interest Rating...';
  badge.innerHTML = `
    <div class="upblock-score-content">
      <div class="upblock-score-top">
        <span class="upblock-score-spinner">●</span>
      </div>
      <div class="upblock-score-middle">
        <img src="${chrome.runtime.getURL('upblock-logo.png')}" class="upblock-logo-img" alt="upblock" />
        <span class="upblock-score-text">LOADING</span>
      </div>
    </div>
  `;
  
  // CONSISTENT INSERTION: Use card level, not nested container
  card.style.position = 'relative';
  card.insertBefore(badge, card.firstChild);
  
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
      <span class="upblock-banner-count">0/${total}</span>
    </div>
  `;
  document.body.appendChild(banner);
  return banner;
}

// Update loading banner count and show summary when complete
function updateLoadingBanner(loaded, total, allScoresData = null) {
  const banner = document.getElementById('upblock-loading-banner');
  if (banner) {
    const countEl = banner.querySelector('.upblock-banner-count');
    const content = banner.querySelector('.upblock-banner-content');
    
    if (countEl) {
      countEl.textContent = `${loaded}/${total}`;
    }
    
    // Show simple average when complete
    if (loaded >= total && allScoresData && allScoresData.length > 0) {
      const validScores = allScoresData.filter(d => d.interestStars);
      
      if (validScores.length > 0) {
        const avgStars = (validScores.reduce((sum, d) => sum + d.interestStars, 0) / validScores.length).toFixed(1);
        
        // Replace with simple average display
        if (content) {
          content.innerHTML = `
            <span class="upblock-banner-average">Average: ${avgStars}★</span>
          `;
        }
      }
      
      // Keep visible - user can reference while browsing
      // Don't auto-hide anymore
    }
  }
}

// Process listings in batches
async function processListings(listings, token) {
  if (!token) {
    console.log('[Upblock] No auth token - user needs to login');
    return;
  }

  // Extract comparable prices from page ONCE for all listings
  const comparables = extractComparablePrices();
  console.log('[Upblock] Using', comparables.length, 'comparables for price context');

  // Show loading banner
  const banner = showLoadingBanner(listings.length);
  let loadedCount = 0;
  const allScoresData = []; // Track all scores for summary

  // Process visible listings first
  const visibleListings = listings.slice(0, CONFIG.BATCH_SIZE);
  
  console.log('[Upblock] Loading scores for first', visibleListings.length, 'visible listings...');
  
  for (const listing of visibleListings) {
    const loadingBadge = showLoadingBadge(listing.card);
    
    const data = await fetchScore(listing.address, token, comparables, listing.reaPriceNumeric);
    
    // Remove loading badge
    if (loadingBadge) {
      loadingBadge.remove();
    }
    
    if (data !== null) {
      injectScoreBadge(listing, data);
      loadedCount++;
      allScoresData.push(data); // Store for summary
      updateLoadingBanner(loadedCount, listings.length, allScoresData);
      console.log(`[Upblock] ✓ Loaded ${loadedCount}/${listings.length} - ${listing.address.substring(0,30)} - Stars: ${data.interestStars}★, Value: ${data.estimatedValue ? formatPrice(data.estimatedValue) : 'N/A'}`);
    }
  }

  // Process remaining listings lazily (when user scrolls)
  if (listings.length > CONFIG.BATCH_SIZE) {
    console.log('[Upblock] Remaining', listings.length - CONFIG.BATCH_SIZE, 'listings will load on scroll');
    observeScroll(listings.slice(CONFIG.BATCH_SIZE), token, loadedCount, listings.length, comparables, allScoresData);
  }
}

// Observe scroll to load scores for listings as they come into view
function observeScroll(remainingListings, token, initialLoadedCount, totalCount, comparables = [], allScoresData = []) {
  let loadedCount = initialLoadedCount;
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(async (entry) => {
      if (entry.isIntersecting) {
        const listing = remainingListings.find(l => l.card === entry.target);
        if (listing && !listing.processed) {
          listing.processed = true;
          const loadingBadge = showLoadingBadge(listing.card);
          const data = await fetchScore(listing.address, token, comparables, listing.reaPriceNumeric);
          if (loadingBadge) loadingBadge.remove();
          if (data !== null) {
            injectScoreBadge(listing, data);
            loadedCount++;
            allScoresData.push(data); // Store for summary
            updateLoadingBanner(loadedCount, totalCount, allScoresData);
            console.log(`[Upblock] ✓ Loaded ${loadedCount}/${totalCount} (on scroll) - Stars: ${data.interestStars}★, Value: ${data.estimatedValue ? formatPrice(data.estimatedValue) : 'N/A'}`);
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
      
      // Wait even longer for REA to finish rendering new content (pagination can be slow)
      setTimeout(() => {
        console.log('[Upblock] Reprocessing after pagination/navigation (3.5s delay)');
        init();
        
        // Sometimes REA lazy-loads, so retry again if no listings found
        setTimeout(() => {
          const listings = findListings();
          console.log('[Upblock] Pagination double-check: found', listings.length, 'listings');
          if (listings.length > 0) {
            init();
          }
        }, 2000); // Check again 2s later
      }, 3500); // Increased to 3500ms for pagination
    }, 1000); // Wait 1000ms for URL to stabilize
  }
}, 500); // Check every 500ms

// Re-run when new listings are loaded (infinite scroll)
let mutationTimeout = null;
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
    // Debounce to avoid multiple rapid init calls
    if (mutationTimeout) {
      clearTimeout(mutationTimeout);
    }
    mutationTimeout = setTimeout(() => {
      console.log('[Upblock] New listings detected (infinite scroll/pagination), processing...');
      init();
    }, 1000); // Increased debounce
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log('[Upblock] Content script initialized');
