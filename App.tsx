import React, { useState, useCallback, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import PropertyResults from './components/PropertyResults';
import Pricing from './components/Pricing';
import PhoneVerification from './components/PhoneVerification';
import PhoneRecoveryModal from './components/PhoneRecoveryModal';
import EmailAuth from './components/EmailAuth';
import TermsAndConditions from './components/TermsAndConditions';
import AccountSettings from './components/AccountSettings';
import InviteFriendsModal from './components/InviteFriendsModal';
import { AdminPage } from './components/AdminPage';
import { geminiService } from './services/geminiService';
import { stripeService } from './services/stripeService';
import { supabaseService } from './services/supabaseService';
import { billingService, calculateCreditState, getRemainingCredits, canAudit } from './services/billingService';
import { fingerprintService, checkDeviceSearchLimit, recordDeviceSearch } from './services/fingerprintService';
import { AppState, PropertyData, PlanType, CreditState } from './types';

const App: React.FC = () => {
  const [address, setAddress] = useState('');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [results, setResults] = useState<PropertyData | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const MAX_REFRESHES = 3;
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  
  // Address autocomplete state
  const [suggestions, setSuggestions] = useState<{ description: string; mainText: string; secondaryText: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isValidAddress, setIsValidAddress] = useState(false); // Must select from autocomplete
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Plan and credits - loaded from Supabase profile (no localStorage)
  const [plan, setPlan] = useState<PlanType>('FREE_TRIAL');
  
  // Credit state - calculated from Supabase profile
  const [creditState, setCreditState] = useState<CreditState>(() => calculateCreditState(null));
  const [remainingCredits, setRemainingCredits] = useState(0);
  
  // Device fingerprint state (for anonymous users)
  // Initialize from localStorage cache for instant display, then verify with Supabase
  const [deviceCanSearch, setDeviceCanSearch] = useState<boolean>(() => {
    const cached = localStorage.getItem('prop_device_searches');
    return !cached || parseInt(cached, 10) < 1; // Can search if no cache or searches < 1
  });
  const [deviceSearchesUsed, setDeviceSearchesUsed] = useState(() => {
    return parseInt(localStorage.getItem('prop_device_searches') || '0', 10);
  });
  
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [isProcessingUpgrade, setIsProcessingUpgrade] = useState(false);
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);
  const [lastPurchasedPlan, setLastPurchasedPlan] = useState<string | null>(null); // Track what was just bought
  const [showPricing, setShowPricing] = useState(false);
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [emailAuthMode, setEmailAuthMode] = useState<'signup' | 'login' | 'reset'>('signup');
  const [showTerms, setShowTerms] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showPhoneRecovery, setShowPhoneRecovery] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [searchHistory, setSearchHistory] = useState<{ address: string; created_at: string }[]>([]);
  
  // Referral system state
  const [showInviteFriends, setShowInviteFriends] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralLink, setReferralLink] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [referralCreditsEarned, setReferralCreditsEarned] = useState(0);
  const [isGeneratingReferralCode, setIsGeneratingReferralCode] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [pendingReferralCode, setPendingReferralCode] = useState<string | null>(null); // From URL ?ref=XXX
  
  // Admin dashboard state
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Auth state - derived from Supabase session (no localStorage)
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(false); // true = login, false = signup
  
  // Flag to prevent LIMIT_REACHED immediately after signup (race condition fix)
  const justSignedUpRef = useRef(false);
  
  // Derived from userProfile (Supabase is source of truth)
  const userEmail = userProfile?.email || '';
  const userPhone = userProfile?.phone || '';
  const isSignedUp = !!userProfile;
  
  // Progress tracking states
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initiating site audit...');
  const progressIntervalRef = useRef<number | null>(null);
  
  // Theme state (dark/light mode)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('prop_theme');
    if (saved) return saved === 'dark';
    // Default to light mode for new/incognito users
    return false;
  });
  
  // Apply theme to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('prop_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);
  
  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // Address autocomplete - fetch suggestions with debounce
  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      const response = await fetch(`/api/address-autocomplete?input=${encodeURIComponent(input)}`);
      const data = await response.json();
      
      if (data.predictions && data.predictions.length > 0) {
        setSuggestions(data.predictions);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      setSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  // Check if input looks like an Australian address (for paste support)
  const looksLikeAustralianAddress = useCallback((input: string): boolean => {
    const trimmed = input.trim();
    // Must have at least 3 words
    const hasMinWords = trimmed.split(/\s+/).length >= 3;
    // Has a 4-digit postcode
    const hasPostcode = /\b\d{4}\b/.test(trimmed);
    // Has a state abbreviation
    const hasState = /\b(NSW|VIC|QLD|WA|SA|TAS|NT|ACT)\b/i.test(trimmed);
    // Has street-like words
    const hasStreetWord = /\b(street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|place|pl|crescent|cres|way|parade|pde|highway|hwy|boulevard|blvd|terrace|tce)\b/i.test(trimmed);
    
    return hasMinWords && (hasPostcode || hasState) && hasStreetWord;
  }, []);

  // Debounced address input handler
  const handleAddressChange = useCallback((value: string) => {
    setAddress(value);
    
    // Auto-validate if it looks like a pasted Australian address
    if (looksLikeAustralianAddress(value)) {
      setIsValidAddress(true);
      setSuggestions([]);
      setShowSuggestions(false);
    } else {
      setIsValidAddress(false);
    }
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new debounced fetch (still show suggestions for partial inputs)
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  }, [fetchSuggestions, looksLikeAustralianAddress]);

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback((suggestion: { description: string }) => {
    setAddress(suggestion.description);
    setIsValidAddress(true); // Valid address selected from autocomplete
    setSuggestions([]);
    setShowSuggestions(false);
  }, []);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const checkKeySelection = useCallback(async () => {
    if (window.aistudio?.hasSelectedApiKey) {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasKey(selected);
    }
  }, []);

  useEffect(() => {
    checkKeySelection();
    const interval = setInterval(checkKeySelection, 3000);
    return () => clearInterval(interval);
  }, [checkKeySelection]);

  // Clear processing overlay when page is restored from bfcache (browser back button)
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      // event.persisted = true means page was restored from bfcache (back button)
      if (event.persisted && isProcessingUpgrade) {
        console.log('[Stripe] Page restored from bfcache, clearing processing state');
        setIsProcessingUpgrade(false);
      }
    };
    
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [isProcessingUpgrade]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.view === 'results') {
        // Forward navigation - try to restore results from sessionStorage
        console.log('[Navigation] Forward to results, restoring from cache');
        try {
          const cached = sessionStorage.getItem('upblock_last_results');
          const cachedAddress = sessionStorage.getItem('upblock_last_address');
          if (cached && cachedAddress) {
            setResults(JSON.parse(cached));
            setAddress(cachedAddress);
            setAppState(AppState.RESULTS);
            setIsValidAddress(true);
            setIsCached(true); // Mark as cached since restored from sessionStorage
          }
        } catch (e) {
          console.warn('[Navigation] Could not restore results:', e);
        }
      } else if (results !== null || appState === AppState.LIMIT_REACHED) {
        // Back navigation - clear results and go to home
        console.log('[Navigation] Back button pressed, returning to home');
        setResults(null);
        setAppState(AppState.IDLE);
        setError(null);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [results, appState]);

  // Check for referral code in URL on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      console.log('[Referral] Found referral code in URL:', refCode);
      setPendingReferralCode(refCode.toUpperCase());
      // Remove from URL to clean it up
      urlParams.delete('ref');
      const newUrl = urlParams.toString() 
        ? `${window.location.pathname}?${urlParams}` 
        : window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  // Check device fingerprint for anonymous users on page load
  useEffect(() => {
    const checkDevice = async () => {
      // Only check for anonymous users
      if (!isLoggedIn) {
        try {
          const { canSearch, searchesUsed } = await checkDeviceSearchLimit();
          setDeviceCanSearch(canSearch);
          setDeviceSearchesUsed(searchesUsed);
          // Also update localStorage for instant display on next load
          localStorage.setItem('prop_device_searches', searchesUsed.toString());
          console.log('[Fingerprint] Device check:', { canSearch, searchesUsed });
        } catch (error) {
          console.error('[Fingerprint] Error checking device:', error);
          // Check localStorage fallback
          const cached = parseInt(localStorage.getItem('prop_device_searches') || '0', 10);
          setDeviceCanSearch(cached < 1);
          setDeviceSearchesUsed(cached);
        }
      } else {
        // Logged in users don't need device fingerprint
        setDeviceCanSearch(true);
      }
    };
    checkDevice();
  }, [isLoggedIn]);

  useEffect(() => {
    if (appState === AppState.LOADING) {
      setProgress(0);
      setLoadingMessage('Canonicalising address...');
      
      progressIntervalRef.current = window.setInterval(() => {
        setProgress(prev => {
          if (prev >= 98) {
            if (prev > 99.8) return prev;
            setLoadingMessage('Performing deep intelligence synthesis...');
            return prev + 0.05;
          }
          
          const increment = prev < 30 ? 5 : prev < 60 ? 3 : prev < 85 ? 1 : 0.5;
          const next = prev + increment;

          if (next > 85) setLoadingMessage('Synthesizing value-add pathways...');
          else if (next > 70) setLoadingMessage('Analyzing market risk & watch-outs...');
          else if (next > 55) setLoadingMessage('Feasibility & uplift modelling...');
          else if (next > 40) setLoadingMessage('Cross-referencing comparable sales...');
          else if (next > 20) setLoadingMessage('Aggregating site & planning records...');
          
          return next;
        });
      }, 100);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [appState]);

  // Check auth state on mount and listen to changes
  useEffect(() => {
    // Skip if Supabase not configured
    if (!supabaseService.isConfigured()) {
      console.log('[Auth] Supabase not configured, skipping auth check');
      return;
    }

    const hasOAuthCallback = window.location.hash.includes('access_token');
    console.log('[Auth] Initializing - hasOAuthCallback:', hasOAuthCallback);
    
    // Helper function to handle successful session
    const handleSessionLogin = async (session: any, source: string) => {
      if (!session?.user) {
        console.log('[Auth] handleSessionLogin called but no user in session');
        return;
      }
      
      console.log('[Auth] Login successful from', source, 'for:', session.user.email);
      setIsLoggedIn(true);
      setShowEmailAuth(false);
      setShowPricing(false); // Close any open modals
      
      // Load user data from Supabase (sets userProfile which derives email/phone)
      // Pass access_token directly to avoid timing issues where getSession() returns null
      await loadUserData(session.user.id, session.access_token);
      refreshCreditState();
      
      // Clean up OAuth hash from URL if present
      if (window.location.hash.includes('access_token')) {
        console.log('[Auth] Cleaning OAuth hash from URL');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    // Handle session initialization
    const initAuth = async () => {
      if (hasOAuthCallback) {
        // OAuth callback detected - Supabase will handle this automatically via detectSessionInUrl
        // The onAuthStateChange listener below will fire when session is ready
        console.log('[Auth] OAuth callback detected - Supabase is processing tokens...');
        // Don't call any auth methods here - let Supabase finish processing first
        return;
      }
      
      // No OAuth callback - check for existing session
      console.log('[Auth] Checking for existing session...');
      try {
        const { data: { session }, error } = await supabaseService.supabase!.auth.getSession();
        console.log('[Auth] getSession result:', { hasSession: !!session, email: session?.user?.email, error: error?.message });
        
        if (session?.user) {
          await handleSessionLogin(session, 'getSession');
        }
      } catch (err: any) {
        console.error('[Auth] getSession error:', err?.message);
      }
    };
    
    // Set up auth state listener FIRST (before initAuth)
    // This ensures we catch the SIGNED_IN event from OAuth processing
    const { data: { subscription } } = supabaseService.supabase!.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] onAuthStateChange:', event, 'hasSession:', !!session, 'email:', session?.user?.email);
        
        // Handle OAuth callback completion or any sign in
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session) {
          // Clean up OAuth hash from URL if present
          if (window.location.hash.includes('access_token')) {
            console.log('[Auth] Cleaning OAuth hash from URL');
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          
          await handleSessionLogin(session, `onAuthStateChange:${event}`);
          
          // Return to idle if user has credits
          if (appState === AppState.LIMIT_REACHED && remainingCredits > 0) {
            setAppState(AppState.IDLE);
          }
          
          // Check for pending upgrade (from URL param set before Stripe redirect)
          if (event === 'SIGNED_IN') {
            const urlParams = new URLSearchParams(window.location.search);
            const pendingUpgrade = urlParams.get('pending_upgrade');
            if (pendingUpgrade) {
              // Clear from URL
              urlParams.delete('pending_upgrade');
              const newUrl = urlParams.toString() 
                ? `${window.location.pathname}?${urlParams}` 
                : window.location.pathname;
              window.history.replaceState({}, document.title, newUrl);
              
              setTimeout(() => {
                if (pendingUpgrade === 'STARTER_PACK') {
                  handleBuyStarterPack();
                } else {
                  handleUpgradeToPro();
                }
              }, 500);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('[Auth] Sign out event received');
          setIsLoggedIn(false);
          setUserProfile(null);
          setShowAdminDashboard(false);
          setIsAdmin(false);
        } else if (event === 'PASSWORD_RECOVERY') {
          // User clicked password reset link - show reset form
          setEmailAuthMode('reset');
          setShowEmailAuth(true);
        }
      }
    );
    
    // Now initialize - the listener is ready to catch events
    initAuth();

    return () => subscription.unsubscribe();
  }, []);

  // Handle Stripe payment success redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const sessionId = urlParams.get('session_id');
    const purchasedPlan = urlParams.get('plan') || 'PRO';

    if (paymentStatus === 'success' && sessionId) {
      // Clear URL params to prevent re-processing on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Payment was successful - the webhook handles adding credits reliably
      // This client-side code is for UI feedback and fallback
      const processPaymentSuccess = async () => {
        console.log('[Payment] Processing success redirect for plan:', purchasedPlan);
        setLastPurchasedPlan(purchasedPlan); // Track what was just purchased for notification
        setShowUpgradeSuccess(true);
        
        // Wait for session to be restored (retry a few times)
        let user = null;
        for (let attempt = 1; attempt <= 5; attempt++) {
          console.log('[Payment] Checking for user session, attempt:', attempt);
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          user = await supabaseService.getCurrentUser();
          if (user) {
            console.log('[Payment] User found:', user.email);
            break;
          }
        }
        
        if (user) {
          setIsLoggedIn(true);
          
          // Wait a bit for webhook to process, then load profile
          console.log('[Payment] Waiting for webhook to process...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Load latest profile data (webhook should have added credits)
          await loadUserData(user.id);
          
          // Verify credits were added - retry if not
          let retryCount = 0;
          const maxRetries = 5;
          while (retryCount < maxRetries) {
            const profile = await supabaseService.getCurrentProfile(user.id);
            console.log('[Payment] Checking profile after webhook, attempt:', retryCount + 1, 'credits:', profile?.credit_topups, 'plan:', profile?.plan_type);
            
            // If plan changed to STARTER_PACK or credits increased, we're good
            if (profile?.plan_type === 'STARTER_PACK' || profile?.plan_type === 'PRO' || (profile?.credit_topups && profile.credit_topups > 0)) {
              console.log('[Payment] Credits/plan updated successfully');
              // Update local state with fresh data
              await loadUserData(user.id);
              break;
            }
            
            retryCount++;
            if (retryCount < maxRetries) {
              console.log('[Payment] Credits not yet updated, retrying in 2 seconds...');
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
          
          if (retryCount === maxRetries) {
            console.warn('[Payment] Credits may not have been applied yet. Please refresh if credits are missing.');
          }
          
          // Show phone recovery modal if not already prompted (first purchase)
          const updatedProfile = await supabaseService.getCurrentProfile(user.id);
          if (updatedProfile && !updatedProfile.phone_recovery_prompted && !updatedProfile.phone_verified) {
            console.log('[Payment] Showing phone recovery modal (first purchase)');
            setTimeout(() => {
              setShowUpgradeSuccess(false);
              setShowPhoneRecovery(true);
            }, 3000);
          } else {
            setTimeout(() => setShowUpgradeSuccess(false), 5000);
          }
        } else {
          // User not found after retries - DON'T log them out!
          // The webhook will have added the credits, they just need to refresh/re-login
          console.log('[Payment] Could not restore session, but webhook should have processed credits');
          // Show success anyway - credits were added by webhook
          setTimeout(() => setShowUpgradeSuccess(false), 5000);
        }
      };
      
      processPaymentSuccess();
    } else if (paymentStatus === 'cancel') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Load user data from Supabase and sync credit state
  // Can optionally pass accessToken directly (for OAuth where session isn't synced yet)
  const loadUserData = async (userId?: string, accessToken?: string) => {
    console.log('[loadUserData] Called with userId:', userId, 'hasToken:', !!accessToken);
    
    // Using server-side API now, no delay needed
    
    try {
      // Pass userId and accessToken directly to avoid getUser() hanging during OAuth
      const profile = await supabaseService.getCurrentProfile(userId, accessToken);
      console.log('[loadUserData] Got profile:', profile ? { id: profile.id, search_count: profile.search_count, credit_topups: profile.credit_topups, plan_type: profile.plan_type } : null);
      
      if (profile) {
        setUserProfile(profile);
        
        // Check admin status
        setIsAdmin(profile.is_admin === true);
        
        // Use billingService for consistent credit calculation (single source of truth)
        const state = calculateCreditState(profile);
        const calculatedCredits = getRemainingCredits(state);
        
        console.log('[loadUserData] Calculated from Supabase:', {
          profile: { 
            search_count: profile.search_count, 
            credit_topups: profile.credit_topups,
            plan_type: profile.plan_type,
            pro_used: profile.pro_used,
            pro_month: profile.pro_month,
            is_admin: profile.is_admin
          },
          calculatedCredits,
          plan: state.plan
        });
        
        // IMPORTANT: Set ALL credit-related state immediately to avoid stale state issues
        setCreditState(state);  // This is what checkSearchLimit() uses!
        setRemainingCredits(calculatedCredits);
        setPlan(state.plan);
        
        // Return to home if was on limit reached screen and now has credits
        if (canAudit(state)) {
          setAppState(prev => prev === AppState.LIMIT_REACHED ? AppState.IDLE : prev);
        }
      } else {
        console.log('[loadUserData] No profile found - user may need to complete signup');
      }
    } catch (error) {
      console.error('[Credits] Error loading user data:', error);
    }
  };

  // Refresh credit state from userProfile (Supabase is source of truth)
  const refreshCreditState = useCallback(() => {
    const state = calculateCreditState(userProfile);
    setCreditState(state);
    setRemainingCredits(getRemainingCredits(state));
    // Also update plan from profile
    if (state.plan !== plan) {
      setPlan(state.plan);
    }
    console.log('[Credits] Refreshed:', { remaining: getRemainingCredits(state), plan: state.plan });
  }, [userProfile, plan]);

  // Auto-refresh credits when userProfile changes
  useEffect(() => {
    if (userProfile) {
      const state = calculateCreditState(userProfile);
      setCreditState(state);
      setRemainingCredits(getRemainingCredits(state));
      if (state.plan !== plan) {
        setPlan(state.plan);
      }
      
      // SAFETY NET: If logged in with credits but stuck on LIMIT_REACHED, go to IDLE
      // BUT: Don't do this if user just signed up (to prevent flash)
      if (isLoggedIn && canAudit(state) && appState === AppState.LIMIT_REACHED && !justSignedUpRef.current) {
        console.log('[Credits] Safety net: User has credits but stuck on LIMIT_REACHED, returning to IDLE');
        setAppState(AppState.IDLE);
      }
    }
  }, [userProfile, isLoggedIn, appState]);

  const checkSearchLimit = () => {
    // API key users bypass limits
    if (hasKey) return true;
    
    // Logged-in users use credit system (from Supabase profile)
    if (isLoggedIn) {
      return canAudit(creditState);
    }
    
    // Anonymous users: check device fingerprint
    // Only allow if deviceCanSearch is explicitly true
    return deviceCanSearch === true;
  };

  // Check if address was searched within the last 7 days (FREE re-search)
  const checkIfRecentSearch = (searchAddress: string): boolean => {
    const DAYS_FREE = 7;
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - DAYS_FREE * 24 * 60 * 60 * 1000);
    
    // Check searchHistory for this address
    const recentMatch = searchHistory.find(item => {
      const itemDate = new Date(item.created_at);
      const addressMatch = item.address.toLowerCase().trim() === searchAddress.toLowerCase().trim();
      const isRecent = itemDate >= cutoffDate;
      return addressMatch && isRecent;
    });
    
    console.log('[Search] Checking recent search:', { 
      address: searchAddress, 
      found: !!recentMatch,
      cutoffDate: cutoffDate.toISOString()
    });
    
    return !!recentMatch;
  };

  // Save search to history without consuming a credit (for free re-searches)
  const saveSearchWithoutCredit = async () => {
    const userId = userProfile?.id;
    if (!userId || !address) return;
    
    try {
      // Just save to history, don't update search_count or credit_topups
      const response = await supabaseService.authenticatedFetch('/api/save-search', {
        method: 'POST',
        body: JSON.stringify({ 
          userId, 
          address,
          skipCreditConsumption: true // New flag to skip credit changes
        })
      });
      
      if (response.ok) {
        console.log('[Search] Free re-search saved to history');
        // Refresh search history to show the new entry
        fetchSearchHistory();
      }
    } catch (error) {
      console.error('[Search] Failed to save free re-search:', error);
    }
  };

  const incrementSearchCount = async () => {
    console.log('[Search] incrementSearchCount called, isLoggedIn:', isLoggedIn, 'plan:', plan);
    
    // Logged-in users: consume credit via Supabase API
    if (isLoggedIn) {
      const userId = userProfile?.id;
      if (!userId || !address) {
        console.warn('[Search] No userId or address - cannot save');
        return;
      }
      
      // Calculate what credit to consume based on current state
      const currentState = calculateCreditState(userProfile);
      const consumption = billingService.calculateCreditConsumption(currentState);
      
      if (!consumption) {
        console.warn('[Search] No credits available to consume');
        return;
      }
      
      console.log('[Search] Consuming credit:', consumption);
      
      try {
        // Save search and consume credit via server API (updates Supabase)
        // SECURITY: Server calculates credits server-side, consumption hint is ignored
        const response = await supabaseService.authenticatedFetch('/api/save-search', {
          method: 'POST',
          body: JSON.stringify({ 
            userId, 
            address
            // Note: consumption calculated server-side for security
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('[Search] Save completed:', result);
          
          // Update userProfile with new values from Supabase
          setUserProfile((prev: any) => prev ? {
            ...prev,
            search_count: result.searchCount,
            credit_topups: result.creditTopups,
            pro_used: result.proUsed,
            pro_month: result.proMonth,
            plan_type: result.planType
          } : prev);
          // Credits will refresh when userProfile updates via useEffect
        } else {
          const errorData = await response.json();
          console.error('[Search] API error:', errorData.error);
        }
      } catch (error) {
        console.error('[Search] Failed to save search:', error);
      }
    } else {
      // Anonymous users: record device search via fingerprint
      try {
        await recordDeviceSearch();
        setDeviceCanSearch(false); // Used their 1 free search
        setDeviceSearchesUsed(prev => {
          const newCount = prev + 1;
          localStorage.setItem('prop_device_searches', newCount.toString());
          return newCount;
        });
        console.log('[Fingerprint] Device search recorded - no more free searches');
      } catch (error) {
        console.error('[Fingerprint] Error recording device search:', error);
        // Still update local state to block further searches
        setDeviceCanSearch(false);
        localStorage.setItem('prop_device_searches', '1');
      }
    }
  };

  const handleSignUp = () => {
    // Show email signup modal (for +1 bonus audit via account creation)
    setEmailAuthMode('signup');
    setShowEmailAuth(true);
  };

  // Handle "Create Account" CTA - grants bonus audits via account creation
  const handleCreateAccount = () => {
    // If already logged in, credits are already in Supabase
    if (isLoggedIn) {
      refreshCreditState();
      setAppState(AppState.IDLE);
      return;
    }
    // Otherwise show signup modal
    setEmailAuthMode('signup');
    setShowEmailAuth(true);
  };

  // Legacy alias - routes to new unified handler
  const handleBuyStarterPack = async () => {
    await handleBuyCreditPack('STARTER_PACK');
  };

  // Handle "Upgrade to Pro" CTA
  const handleUpgradeToPro = async () => {
    // Double-check login with Supabase
    let userLoggedIn = isLoggedIn;
    let email = userProfile?.email || '';
    
    if (!userLoggedIn) {
      const user = await supabaseService.getCurrentUser();
      if (user) {
        console.log('[Auth] Session recovered from Supabase:', user.email);
        setIsLoggedIn(true);
        await loadUserData(user.id);
        userLoggedIn = true;
        email = user.email || '';
      }
    }
    
    if (!userLoggedIn) {
      // Not logged in - show signup with pending upgrade in URL
      setShowPricing(false);
      setEmailAuthMode('signup');
      setShowEmailAuth(true);
      // Store pending upgrade in URL so it survives auth redirect
      const url = new URL(window.location.href);
      url.searchParams.set('pending_upgrade', 'PRO');
      window.history.replaceState({}, document.title, url.toString());
      return;
    }
    
    setIsProcessingUpgrade(true);
    setError(null);
    
    if (!email) {
      setIsProcessingUpgrade(false);
      setError("Unable to process payment. Please ensure you're logged in with a valid email.");
      return;
    }
    
    try {
      // Pass userId for reliable webhook lookup
      const userId = userProfile?.id || '';
      const response = await stripeService.createCheckoutSession('PRO', email, userId);
      
      if (response.success && response.url) {
        window.location.href = response.url;
        return;
      } else {
        console.error('Stripe checkout failed:', response);
        setIsProcessingUpgrade(false);
        setError(response.error || "Unable to initiate payment. Please check your connection and try again.");
        setAppState(AppState.ERROR);
        setShowPricing(false);
      }
    } catch (error: any) {
      console.error('Upgrade error:', error);
      setIsProcessingUpgrade(false);
      setError(error?.message || "Payment gateway unavailable. Please try again later.");
      setAppState(AppState.ERROR);
      setShowPricing(false);
    }
  };

  const handleLogin = () => {
    // Show email login modal
    setEmailAuthMode('login');
    setShowEmailAuth(true);
  };

  const handleLogout = async () => {
    console.log('Logout clicked');
    
    // Clear React state
    setIsLoggedIn(false);
    setUserProfile(null);
    setSearchHistory([]);
    setShowAccountSettings(false);
    setShowAdminDashboard(false); // Close admin dashboard on logout
    setIsAdmin(false);
    setPlan('FREE_TRIAL');
    
    // Refresh credit state
    refreshCreditState();
    
    // Sign out from Supabase
    try {
      await supabaseService.signOut();
    } catch (error) {
      console.log('Supabase signout error (ignored):', error);
    }
  };

  // Fetch search history from Supabase via server API (bypasses RLS)
  const fetchSearchHistory = async () => {
    const userId = userProfile?.id;
    console.log('Fetching search history...', { isLoggedIn, userId });
    
    if (!isLoggedIn || !userId) {
      console.log('Not fetching - not logged in or no userId');
      setSearchHistory([]);
      return;
    }
    
    try {
      const response = await supabaseService.authenticatedFetch('/api/get-search-history', {
        method: 'POST',
        body: JSON.stringify({ userId })
      });
      
      if (response.ok) {
        const { history } = await response.json();
        console.log('Fetched search history:', history);
        setSearchHistory(history || []);
      } else {
        const errorData = await response.json();
        console.error('Failed to fetch search history:', errorData.error);
        setSearchHistory([]);
      }
    } catch (error) {
      console.error('Failed to fetch search history:', error);
      setSearchHistory([]);
    }
  };

  // Handle searching an address from history
  const handleSearchFromHistory = (historyAddress: string) => {
    // Clear existing results and reset to home view
    setResults(null);
    setAppState(AppState.IDLE);
    setError(null);
    // Set the address from history
    setAddress(historyAddress);
    setIsValidAddress(true); // History addresses are valid
    // Close account settings to show home with preloaded address
    setShowAccountSettings(false);
  };

  // Fetch notifications from server
  const fetchNotifications = async () => {
    if (!isLoggedIn) return;
    
    try {
      const response = await supabaseService.authenticatedFetch('/api/notifications', {
        method: 'GET'
      });
      
      if (response.ok) {
        const { notifications: notifs, unreadCount } = await response.json();
        setNotifications(notifs || []);
        setUnreadNotificationCount(unreadCount || 0);
      }
    } catch (error) {
      console.error('[Notifications] Fetch error:', error);
    }
  };

  // Generate referral code
  const generateReferralCode = async () => {
    if (!isLoggedIn || referralCode) return;
    
    setIsGeneratingReferralCode(true);
    try {
      const response = await supabaseService.authenticatedFetch('/api/generate-referral-code', {
        method: 'POST'
      });
      
      if (response.ok) {
        const { referralCode: code, referralLink: link } = await response.json();
        setReferralCode(code);
        setReferralLink(link);
      } else {
        const errorData = await response.json();
        console.error('[Referral] Generate error:', errorData.error);
      }
    } catch (error) {
      console.error('[Referral] Generate error:', error);
    } finally {
      setIsGeneratingReferralCode(false);
    }
  };

  // Mark notification as read
  const markNotificationRead = async (notificationId: string) => {
    try {
      await supabaseService.authenticatedFetch('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({ action: 'markRead', notificationId })
      });
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadNotificationCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('[Notifications] Mark read error:', error);
    }
  };

  // Mark all notifications as read
  const markAllNotificationsRead = async () => {
    try {
      await supabaseService.authenticatedFetch('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({ action: 'markAllRead' })
      });
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadNotificationCount(0);
    } catch (error) {
      console.error('[Notifications] Mark all read error:', error);
    }
  };

  // Send referral invite email
  const sendReferralInvite = async (email: string, name?: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const response = await supabaseService.authenticatedFetch('/api/send-referral-invite', {
        method: 'POST',
        body: JSON.stringify({ friendEmail: email, friendName: name })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        return { success: true, message: data.message };
      } else {
        return { success: false, error: data.error || 'Failed to send invite' };
      }
    } catch (error) {
      console.error('[Referral] Send invite error:', error);
      return { success: false, error: 'Something went wrong. Please try again.' };
    }
  };

  // Track referral when new user signs up
  const trackReferral = async (newUserId: string) => {
    if (!pendingReferralCode) return;
    
    try {
      const response = await fetch('/api/track-referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          referralCode: pendingReferralCode,
          newUserId 
        })
      });
      
      if (response.ok) {
        console.log('[Referral] Tracked successfully');
      } else {
        const errorData = await response.json();
        console.log('[Referral] Track failed:', errorData.error);
      }
    } catch (error) {
      console.error('[Referral] Track error:', error);
    } finally {
      setPendingReferralCode(null);
    }
  };

  // Load referral stats from profile
  useEffect(() => {
    if (userProfile) {
      setReferralCode(userProfile.referral_code || null);
      setReferralLink(userProfile.referral_code ? `https://upblock.ai/?ref=${userProfile.referral_code}` : null);
      setReferralCount(userProfile.referral_count || 0);
      setReferralCreditsEarned(userProfile.referral_credits_earned || 0);
    }
  }, [userProfile]);

  // Fetch notifications when logged in
  useEffect(() => {
    if (isLoggedIn && userProfile) {
      fetchNotifications();
      // Refresh notifications every 2 minutes
      const interval = setInterval(fetchNotifications, 120000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, userProfile]);

  // Handle subscription cancellation
  const handleCancelSubscription = async () => {
    // TODO: Call Stripe to cancel subscription when connected
    if (!userProfile?.id) return;
    
    try {
      // Update Supabase - this is the source of truth
      await supabaseService.updateSubscription(userProfile.id, 'FREE_TRIAL');
      await supabaseService.updatePlanType(userProfile.id, 'FREE_TRIAL');
      
      // Update React state
      setPlan('FREE_TRIAL');
      setUserProfile((prev: any) => prev ? { ...prev, plan_type: 'FREE_TRIAL' } : prev);
      refreshCreditState();
      
      console.log('[Cancel] Subscription cancelled in Supabase');
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
    }
  };

  // Handle email auth success (both signup and login)
  const handleEmailAuthSuccess = async (email: string, isNewUser: boolean) => {
    console.log('[handleEmailAuthSuccess]', isNewUser ? 'New user signup' : 'Returning user login');
    
    // Set flag to prevent race conditions setting LIMIT_REACHED
    justSignedUpRef.current = true;
    
    // CRITICAL: Close modals and return to home FIRST
    // This ensures the user isn't stuck on LIMIT_REACHED regardless of data loading
    setShowEmailAuth(false);
    setAppState(AppState.IDLE);
    setIsLoggedIn(true);
    
    console.log('[handleEmailAuthSuccess] Set state to IDLE, now loading user data...');
    
    // Load user data from Supabase (sets userProfile)
    const user = await supabaseService.getCurrentUser();
    console.log('[handleEmailAuthSuccess] getCurrentUser result:', user?.id);
    
    if (user?.id) {
      // For new users, the profile might not exist yet (Supabase trigger timing)
      // Retry a few times with delay
      let retries = 3;
      let profileLoaded = false;
      
      while (retries > 0 && !profileLoaded) {
        await loadUserData(user.id);
        
        // Check if profile was loaded (userProfile will be set by loadUserData)
        const profile = await supabaseService.getCurrentProfile(user.id);
        if (profile) {
          profileLoaded = true;
          console.log('[handleEmailAuthSuccess] Profile loaded successfully');
        } else {
          retries--;
          if (retries > 0) {
            console.log('[handleEmailAuthSuccess] Profile not found, retrying...', retries, 'left');
            await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retry
          }
        }
      }
      
      refreshCreditState();
      
      // Force immediate credit state update to prevent stale state
      const profile = await supabaseService.getCurrentProfile(user.id);
      if (profile) {
        const freshState = calculateCreditState(profile);
        setCreditState(freshState);
        setRemainingCredits(getRemainingCredits(freshState));
        console.log('[handleEmailAuthSuccess] Credit state refreshed:', {
          remaining: getRemainingCredits(freshState),
          canAudit: canAudit(freshState),
          plan: freshState.plan
        });
      }
      
      // Track referral for new users
      if (isNewUser && pendingReferralCode) {
        console.log('[Referral] Tracking referral for new user:', user.id);
        trackReferral(user.id);
      }
    }
    
    // ENSURE we're on IDLE even after data loading
    // (in case something during loading tried to set LIMIT_REACHED)
    console.log('[handleEmailAuthSuccess] Complete - ensuring IDLE state, address:', address, 'isValidAddress:', isValidAddress);
    setAppState(AppState.IDLE);
    
    // Preserve address validation - if they had a valid address before signup, keep it valid
    // Only try to re-validate if currently invalid but address exists
    if (address && address.trim().length > 0 && !isValidAddress) {
      console.log('[handleEmailAuthSuccess] Address exists but not valid, attempting re-validation');
      if (looksLikeAustralianAddress(address)) {
        setIsValidAddress(true);
      }
    } else if (address && address.trim().length > 0 && isValidAddress) {
      // Address was already validated before signup - ensure it stays valid
      console.log('[handleEmailAuthSuccess] Address already validated, preserving state');
      setIsValidAddress(true); // Explicitly set to ensure React doesn't lose this state
    }
    
    // Clear the justSignedUp flag after a short delay (allow state to settle)
    setTimeout(() => {
      justSignedUpRef.current = false;
      console.log('[handleEmailAuthSuccess] Cleared justSignedUp flag');
    }, 2000);
    
    // Check for pending upgrade in URL
    const urlParams = new URLSearchParams(window.location.search);
    const pendingUpgrade = urlParams.get('pending_upgrade');
    if (pendingUpgrade) {
      urlParams.delete('pending_upgrade');
      const newUrl = urlParams.toString() 
        ? `${window.location.pathname}?${urlParams}` 
        : window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      setTimeout(() => {
        handleUpgrade(pendingUpgrade as PlanType);
      }, 500);
    }
  };

  // Handle phone verification success (for optional account security)
  const handlePhoneVerified = async (phone: string) => {
    // Update phone in Supabase profile
    const user = await supabaseService.getCurrentUser();
    if (user?.id) {
      await supabaseService.updatePhone(user.id, phone);
      await loadUserData(user.id);
      // IMPORTANT: Refresh credit state after phone verification
      // This picks up any referral bonus credits that were awarded
      refreshCreditState();
    }
    
    setShowPhoneVerification(false);
    setAppState(AppState.IDLE);
    
    // Check for pending upgrade in URL
    const urlParams = new URLSearchParams(window.location.search);
    const pendingUpgrade = urlParams.get('pending_upgrade');
    if (pendingUpgrade) {
      urlParams.delete('pending_upgrade');
      const newUrl = urlParams.toString() 
        ? `${window.location.pathname}?${urlParams}` 
        : window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      setTimeout(() => {
        if (pendingUpgrade === 'STARTER_PACK') {
          handleBuyStarterPack();
        } else {
          handleUpgradeToPro();
        }
      }, 500);
    }
  };

  // Check if user is on a mobile device (for GPS location feature)
  const isMobileDevice = useCallback(() => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }, []);

  const detectLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setError("GPS not available on this device");
      return;
    }
    
    setIsLocating(true);
    setError(null);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Reverse geocode to get street address using OpenStreetMap Nominatim
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
            { 
              headers: { 
                'User-Agent': 'upblock.ai/1.0',
                'Accept-Language': 'en-AU'
              } 
            }
          );
          const data = await response.json();
          
          if (data.address) {
            const addr = data.address;
            // Build Australian-style address: "123 Smith St, Suburb NSW 2000"
            const parts = [
              addr.house_number,
              addr.road,
              addr.suburb || addr.city || addr.town || addr.village,
              addr.state,
              addr.postcode
            ].filter(Boolean);
            
            const formattedAddress = parts.join(' ');
            setAddress(formattedAddress || data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            setIsValidAddress(true); // GPS location is valid
          } else {
            // Fallback to coordinates if geocoding fails
            setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            setIsValidAddress(true); // GPS coordinates are valid
          }
        } catch (err) {
          console.error('Reverse geocoding failed:', err);
          // Fallback to coordinates
          setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          setIsValidAddress(true); // GPS coordinates are valid
        }
        
        setIsLocating(false);
      },
      (err) => {
        console.error('Geolocation error:', err);
        if (err.code === 1) {
          setError("Please enable location access in your phone settings");
        } else if (err.code === 2) {
          setError("Unable to determine your location. Please try again.");
        } else {
          setError("Location request timed out. Please try again.");
        }
        setIsLocating(false);
      },
      { 
        enableHighAccuracy: true,  // Use GPS hardware, not cell towers
        timeout: 15000,            // 15 second timeout
        maximumAge: 60000          // Cache for 1 minute
      }
    );
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
      setIsQuotaError(false);
      setError(null);
      setAppState(AppState.IDLE);
    }
  };

  // Handle refreshing cached results without leaving the page (limited to 3 per property)
  const handleRefreshResults = async () => {
    if (!address || !results) return;
    
    // Check refresh limit
    if (refreshCount >= MAX_REFRESHES) {
      console.log('[handleRefreshResults] Refresh limit reached');
      return;
    }
    
    setIsRefreshingData(true);
    try {
      console.log('[handleRefreshResults] Force refreshing data for:', address.substring(0, 50), `(${refreshCount + 1}/${MAX_REFRESHES})`);
      const { data, cached } = await geminiService.fetchPropertyInsights(address, true);
      console.log('[handleRefreshResults] Received fresh data');
      setResults(data);
      setIsCached(cached);
      setRefreshCount(prev => prev + 1); // Increment refresh count
      // Update sessionStorage with fresh data
      try {
        sessionStorage.setItem('upblock_last_results', JSON.stringify(data));
      } catch (e) {
        console.warn('[handleRefreshResults] Could not update cache:', e);
      }
    } catch (err: any) {
      console.error('[handleRefreshResults] Error:', err.message || err);
      setError('Failed to refresh data. Please try again.');
    } finally {
      setIsRefreshingData(false);
    }
  };

  const handleHome = useCallback(() => {
    setAppState(AppState.IDLE);
    setResults(null);
    setIsCached(false);
    setRefreshCount(0); // Reset refresh count for new search
    setAddress('');
    setIsValidAddress(false); // Reset valid address
    // Close any open pages
    setShowTerms(false);
    setShowPricing(false);
    setShowAccountSettings(false);
    setError(null);
    setIsQuotaError(false);
    setShowUpgradeSuccess(false);
    setShowPricing(false);
    // Clear cached search from sessionStorage
    try {
      sessionStorage.removeItem('upblock_last_results');
      sessionStorage.removeItem('upblock_last_address');
    } catch (e) {
      // Ignore sessionStorage errors
    }
  }, []);

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!address.trim()) {
      console.log('[handleSearch] No address provided');
      return;
    }

    console.log('[handleSearch] Starting search', {
      address: address.substring(0, 50),
      justSignedUp: justSignedUpRef.current,
      isLoggedIn,
      remainingCredits,
      creditState: creditState ? { plan: creditState.plan, freeUsed: creditState.freeUsed, creditTopups: creditState.creditTopups } : null,
      canAudit: checkSearchLimit()
    });

    // Check search limit, but bypass if user just signed up (credits may still be loading)
    const canSearch = checkSearchLimit() || justSignedUpRef.current;
    
    if (!canSearch) {
      console.log('[handleSearch] Search blocked - no credits available');
      setAppState(AppState.LIMIT_REACHED);
      window.history.pushState({ view: 'limit' }, '', window.location.pathname);
      return;
    }
    
    if (justSignedUpRef.current) {
      console.log('[handleSearch] Bypassing limit check - user just signed up');
      // Force refresh credit state to ensure it's up to date
      if (userProfile) {
        const freshState = calculateCreditState(userProfile);
        setCreditState(freshState);
        setRemainingCredits(getRemainingCredits(freshState));
        console.log('[handleSearch] Refreshed credit state:', {
          remaining: getRemainingCredits(freshState),
          canAudit: canAudit(freshState)
        });
      }
    }

    console.log('[handleSearch] Proceeding with search...');
    setAppState(AppState.LOADING);
    setError(null);
    setIsQuotaError(false);

    try {
      console.log('[handleSearch] Calling fetchPropertyInsights for:', address.substring(0, 50));
      const { data, cached } = await geminiService.fetchPropertyInsights(address);
      console.log('[handleSearch] Received data, setting results...', cached ? '(cached)' : '(fresh)');
      setProgress(100);
      setLoadingMessage('Audit complete!');
      setTimeout(() => {
        setResults(data);
        setIsCached(cached);
        setAppState(AppState.RESULTS);
        // Save to sessionStorage for forward navigation
        try {
          sessionStorage.setItem('upblock_last_results', JSON.stringify(data));
          sessionStorage.setItem('upblock_last_address', address);
        } catch (e) {
          console.warn('[Navigation] Could not cache results:', e);
        }
        // Push history state so back button returns to home
        window.history.pushState({ view: 'results', address }, '', window.location.pathname);
        // Only consume credit on successful results
        // Check if this is a FREE re-search (searched within last 7 days)
        if (!hasKey) {
          const isRecentSearch = checkIfRecentSearch(address);
          if (isRecentSearch) {
            console.log('[Search] FREE re-search - address searched within 7 days');
            // Still save to history but don't consume credit
            saveSearchWithoutCredit();
          } else {
            incrementSearchCount();
          }
        }
      }, 200);
    } catch (err: any) {
      console.error("Audit Error:", err);
      const errorMsg = err.message || '';
      
      // DO NOT consume credits on errors
      if (errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota')) {
        setIsQuotaError(true);
        setError("The shared community quota has been reached. Please select your own API key to continue.");
        setAppState(AppState.ERROR);
      } else if (errorMsg.includes('Requested entity was not found')) {
        setHasKey(false);
        setIsQuotaError(true);
        setError("The selected key was invalid. Please re-select a valid API key.");
        setAppState(AppState.ERROR);
      } else {
        setError("Unable to complete audit. The search might have been too broad or the site data is restricted. Please try a different address.");
        setAppState(AppState.ERROR);
      }
    }
  }, [address, hasKey, isLoggedIn, creditState, userProfile, checkIfRecentSearch]);

  const handleUpgrade = async (planType: PlanType = 'PRO') => {
    // Route to appropriate handler based on plan type
    if (planType === 'STARTER_PACK' || planType === 'BULK_PACK') {
      // Credit packs use one-time payment flow
      await handleBuyCreditPack(planType);
      return;
    }
    // PRO uses subscription flow
    await handleUpgradeToPro();
  };
  
  // Handle buying credit packs (STARTER_PACK = 3 credits, BULK_PACK = 20 credits)
  const handleBuyCreditPack = async (packType: 'STARTER_PACK' | 'BULK_PACK') => {
    // REQUIRE LOGIN before payment
    let userLoggedIn = isLoggedIn;
    let email = userProfile?.email || '';
    
    if (!userLoggedIn) {
      const user = await supabaseService.getCurrentUser();
      if (user) {
        console.log('[Auth] Session recovered from Supabase:', user.email);
        setIsLoggedIn(true);
        await loadUserData(user.id);
        userLoggedIn = true;
        email = user.email || '';
      }
    }
    
    if (!userLoggedIn) {
      // Not logged in - show signup with pending upgrade
      setShowPricing(false);
      setEmailAuthMode('signup');
      setShowEmailAuth(true);
      const url = new URL(window.location.href);
      url.searchParams.set('pending_upgrade', packType);
      window.history.replaceState({}, document.title, url.toString());
      return;
    }
    
    setIsProcessingUpgrade(true);
    
    // Call Stripe checkout - pass userId for reliable webhook lookup
    const checkoutEmail = email || userProfile?.email || '';
    const checkoutUserId = userProfile?.id || '';
    console.log('[Checkout] Creating session for', packType, 'userId:', checkoutUserId);
    const result = await stripeService.createCheckoutSession(packType, checkoutEmail, checkoutUserId);
    
    if (result.success && result.url) {
      window.location.href = result.url;
      return;
    }
    
    // Handle error
    console.error('Stripe checkout error:', result.error);
    setIsProcessingUpgrade(false);
    setError(result.error || 'Failed to start checkout. Please try again.');
    setAppState(AppState.ERROR);
  };

  return (
    <div className="min-h-screen pb-20 selection:bg-[#C9A961] selection:text-white" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar 
        plan={plan} 
        remainingCredits={isLoggedIn ? remainingCredits : (deviceCanSearch ? 1 : 0)}
        onUpgrade={() => { setShowTerms(false); setShowAccountSettings(false); setShowPricing(true); }} 
        onHome={handleHome}
        onLogin={() => { setShowTerms(false); setShowPricing(false); setShowAccountSettings(false); handleLogin(); }}
        onLogout={handleLogout}
        onAccountSettings={() => { setShowTerms(false); setShowPricing(false); setShowAccountSettings(true); fetchSearchHistory(); }}
        onInviteFriends={() => setShowInviteFriends(true)}
        onAdminPanel={() => setShowAdminDashboard(true)}
        isLoggedIn={isLoggedIn}
        isAdmin={isAdmin}
        userName={userProfile?.full_name}
        userEmail={userEmail}
        userPhone={userPhone}
        phoneVerified={userProfile?.phone_verified}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        notifications={notifications}
        unreadCount={unreadNotificationCount}
        onMarkNotificationRead={markNotificationRead}
        onMarkAllRead={markAllNotificationsRead}
      />

      {/* Upgrade Processing Overlay */}
      {isProcessingUpgrade && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="w-16 h-16 border-4 border-[#C9A961]/20 border-t-[#C9A961] rounded-full animate-spin mb-6"></div>
          <h3 className="text-xl sm:text-2xl font-bold text-[#3A342D] tracking-tighter">Connecting to Secure Gateway</h3>
          <p className="text-[#3A342D]/40 font-medium text-xs sm:text-sm mt-2">Finalising your purchase...</p>
          <button 
            onClick={() => setIsProcessingUpgrade(false)}
            className="mt-8 text-sm text-[#3A342D]/50 hover:text-[#C9A961] transition-colors underline"
          >
            Cancel and go back
          </button>
        </div>
      )}

      {/* Upgrade Success Notification */}
      {showUpgradeSuccess && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10 fade-in duration-500">
          <div className="bg-[#3A342D] text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-[#C9A961]/20">
            <div className="w-8 h-8 bg-[#C9A961] rounded-full flex items-center justify-center text-xs">
              <i className={`fa-solid ${lastPurchasedPlan === 'STARTER_PACK' || lastPurchasedPlan === 'BULK_PACK' ? 'fa-bolt' : 'fa-crown'}`}></i>
            </div>
            <div>
              <p className="text-sm font-bold">
                {lastPurchasedPlan === 'STARTER_PACK' ? '3 Audits Added!' : lastPurchasedPlan === 'BULK_PACK' ? '20 Audits Added!' : 'Pro Access Activated'}
              </p>
              <p className="text-[10px] text-white/60">
                {lastPurchasedPlan === 'STARTER_PACK' 
                  ? 'You have 3 additional property audits.'
                  : lastPurchasedPlan === 'BULK_PACK'
                  ? 'You have 20 additional property audits.'
                  : '10 audits per month. Search confidently.'}
              </p>
            </div>
            <button onClick={() => { setShowUpgradeSuccess(false); setLastPurchasedPlan(null); }} className="ml-4 text-white/20 hover:text-white">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      )}

      {showAccountSettings ? (
        <AccountSettings
          plan={plan}
          creditState={creditState}
          remainingCredits={remainingCredits}
          userEmail={userEmail}
          userPhone={userProfile?.phone}
          phoneVerified={userProfile?.phone_verified}
          isLoggedIn={isLoggedIn}
          searchHistory={searchHistory}
          onBack={() => setShowAccountSettings(false)}
          onCancelSubscription={handleCancelSubscription}
          onLogout={handleLogout}
          onSearchAddress={handleSearchFromHistory}
          onSecureAccount={() => setShowPhoneRecovery(true)}
        />
      ) : showTerms ? (
        <TermsAndConditions onBack={() => setShowTerms(false)} />
      ) : showPricing ? (
        <Pricing 
          currentPlan={plan}
          onUpgrade={handleUpgrade}
          onBack={() => setShowPricing(false)}
          onShowTerms={() => { setShowPricing(false); setShowTerms(true); }}
          onSignUp={() => { setShowPricing(false); setEmailAuthMode('signup'); setShowEmailAuth(true); }}
          isLoggedIn={isLoggedIn}
          userId={userProfile?.id}
        />
      ) : (
        <main className="pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          {appState === AppState.IDLE && (
            <div className="max-w-4xl mx-auto text-center py-12 md:py-24 space-y-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest border" style={{ backgroundColor: 'var(--accent-gold-light)', borderColor: 'var(--border-input)' }}>
                <i className="fa-solid fa-file-contract"></i>
                <span>Professional Site Audit & Intelligence</span>
              </div>
              <h1 className="text-[3.25rem] sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.05]" style={{ color: 'var(--text-primary)' }}>
                Overpriced… <br/> <span className="text-[#C9A961] opacity-90">Or a Hidden Bargain?</span>
              </h1>
              <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-medium" style={{ color: 'var(--text-muted)' }}>
                A detailed AI-assisted property report that explains zoning, planning context, comparable sales, and potential value-uplift scenarios in <strong className="font-bold">Australia</strong>.
              </p>
              
              <div className="max-w-2xl mx-auto" ref={autocompleteRef}>
                 <form onSubmit={handleSearch} className="relative group">
                  <div className="absolute -inset-1 bg-[#C9A961] rounded-[2rem] blur opacity-5 group-hover:opacity-10 transition duration-1000"></div>
                  <div className="relative flex items-center p-2 rounded-[2rem] shadow-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                    <div className="flex-grow flex items-center px-6">
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => handleAddressChange(e.target.value)}
                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                        placeholder="Enter street address..."
                        className="w-full py-3 sm:py-4 bg-transparent text-base sm:text-lg font-medium focus:outline-none"
                        style={{ color: 'var(--text-primary)' }}
                        autoComplete="off"
                      />
                    </div>
                    <div className="flex items-center gap-2 pr-2">
                      {/* GPS Location button - only show on mobile devices */}
                      {isMobileDevice() && (
                        <button
                          type="button"
                          onClick={detectLocation}
                          disabled={isLocating}
                          className="w-12 h-12 text-[#B8C5A0] hover:text-[#C9A961] transition-all disabled:opacity-50"
                          title="Use my current location"
                        >
                          <i className={`fa-solid ${isLocating ? 'fa-spinner fa-spin' : 'fa-location-crosshairs'}`}></i>
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={!isValidAddress}
                        className="bg-[#C9A961] text-white px-6 sm:px-8 h-11 sm:h-12 rounded-xl font-bold hover:bg-[#3A342D] transition-all flex items-center gap-2 shadow-sm disabled:opacity-30 uppercase tracking-widest text-[11px] sm:text-[10px]"
                        title={!isValidAddress ? "Select an address from the dropdown" : ""}
                      >
                        Audit Block
                      </button>
                    </div>
                  </div>
                  
                  {/* Address Autocomplete Dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div 
                      className="absolute left-0 right-0 mt-2 rounded-2xl shadow-xl border overflow-hidden z-50"
                      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                    >
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleSelectSuggestion(suggestion)}
                          className="w-full px-6 py-3 text-left hover:bg-[#C9A961]/10 transition-colors flex items-center gap-3 border-b last:border-b-0"
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          <i className="fa-solid fa-location-dot text-[#C9A961] text-sm flex-shrink-0"></i>
                          <div className="min-w-0">
                            <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                              {suggestion.mainText}
                            </p>
                            {suggestion.secondaryText && (
                              <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
                                {suggestion.secondaryText}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {appState === AppState.LOADING && (
            <div className="max-w-xl mx-auto py-40 text-center space-y-12 animate-in fade-in duration-500">
               <div className="space-y-8">
                 <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4" style={{ backgroundColor: 'var(--accent-gold-light)' }}>
                    <i className="fa-solid fa-dna text-3xl text-[#C9A961] animate-pulse"></i>
                 </div>
                 
                 <div className="space-y-4">
                   <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tighter" style={{ color: 'var(--text-primary)' }}>Decoding Property DNA</h2>
                   <p className="text-sm font-medium italic" style={{ color: 'var(--text-muted)' }}>"{loadingMessage}"</p>
                 </div>

                 <div className="max-w-md mx-auto space-y-4">
                   <div className="relative pt-1">
                     <div className="flex mb-2 items-center justify-between">
                       <div>
                         <span className="text-[10px] font-black uppercase tracking-widest py-1 px-2 rounded-full text-[#C9A961] border" style={{ backgroundColor: 'var(--accent-gold-light)', borderColor: 'var(--border-input)' }}>
                           Audit Progress
                         </span>
                       </div>
                       <div className="text-right">
                         <span className="text-2xl font-black tracking-tighter" style={{ color: 'var(--text-primary)' }}>
                           {progress < 100 ? Math.floor(progress) : 100}%
                         </span>
                       </div>
                     </div>
                     <div className="overflow-hidden h-3 mb-4 text-xs flex rounded-full border" style={{ backgroundColor: 'var(--accent-gold-light)', borderColor: 'var(--border-input)' }}>
                       <div 
                         style={{ width: `${progress}%` }} 
                         className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-[#C9A961] transition-all duration-300 ease-out"
                       ></div>
                     </div>
                   </div>
                   <p className="text-[9px] font-bold uppercase tracking-[0.3em]" style={{ color: 'var(--text-muted)' }}>
                     Searching Planning Portals & Market Records
                   </p>
                 </div>
               </div>
            </div>
          )}

          {appState === AppState.RESULTS && results && (
            <PropertyResults 
              data={results} 
              address={address} 
              plan={plan} 
              onUpgrade={() => setShowPricing(true)}
              onHome={handleHome}
              isCached={isCached}
              isRefreshing={isRefreshingData}
              onRefresh={handleRefreshResults}
              refreshCount={refreshCount}
              maxRefreshes={MAX_REFRESHES}
            />
          )}

          {appState === AppState.LIMIT_REACHED && (
            <div className="max-w-3xl mx-auto py-24 text-center space-y-8">
              <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-4xl mx-auto border" style={{ backgroundColor: 'var(--accent-gold-light)', borderColor: 'var(--border-input)' }}>
                <i className="fa-solid fa-lock text-[#C9A961]"></i>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tighter leading-none" style={{ color: 'var(--text-primary)' }}>
                {isLoggedIn ? "You've Used Your Free Audits" : "Sign Up to Get Started"}
              </h2>
              <p className="text-base sm:text-lg max-w-md mx-auto font-medium leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {isLoggedIn 
                  ? "Get more credits, or upgrade to Pro for 10 audits per month."
                  : "Create a free account to unlock 2 property audits. No credit card required."}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
                {/* CTA 1: Create Account (if not logged in) - PRIMARY for anonymous users */}
                {!isLoggedIn && (
                  <button onClick={handleCreateAccount} className="bg-[#C9A961] text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold shadow-lg hover:bg-[#3A342D] transition-all text-[11px] sm:text-[10px] uppercase tracking-widest">
                    <i className="fa-solid fa-user-plus mr-2"></i>
                    Sign Up Free (2 Audits)
                  </button>
                )}
                {/* CTA 2: Buy Starter Pack */}
                <button onClick={handleBuyStarterPack} className="border-2 border-[#C9A961] px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold transition-all text-[11px] sm:text-[10px] uppercase tracking-widest text-[#C9A961] hover:bg-[#C9A961] hover:text-white" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <i className="fa-solid fa-bolt mr-2"></i>
                  Buy 3 Audits
                </button>
                {/* CTA 3: Upgrade to Pro */}
                <button onClick={handleUpgradeToPro} className="bg-[#3A342D] text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold shadow-lg hover:bg-[#C9A961] transition-all text-[11px] sm:text-[10px] uppercase tracking-widest">
                  <i className="fa-solid fa-crown mr-2"></i>
                  Pro (10/month) – $49
                </button>
              </div>
            </div>
          )}

          {appState === AppState.ERROR && (
            <div className="max-w-xl mx-auto border p-12 rounded-[2.5rem] text-center shadow-lg" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <div className="w-16 h-16 bg-red-500/10 text-red-500/70 rounded-full flex items-center justify-center text-2xl mx-auto mb-6">
                <i className={`fa-solid ${isQuotaError ? 'fa-key' : 'fa-triangle-exclamation'}`}></i>
              </div>
              <h3 className="text-2xl font-bold mb-3 tracking-tighter" style={{ color: 'var(--text-primary)' }}>
                {isQuotaError ? 'Action Required' : 'Audit Interrupted'}
              </h3>
              <div className="mb-8 font-medium text-sm leading-relaxed space-y-4" style={{ color: 'var(--text-muted)' }}>
                <p>{error}</p>
              </div>
              <div className="flex flex-col gap-3">
                {isQuotaError ? (
                  <button 
                    onClick={handleSelectKey} 
                    className="w-full py-4 bg-[#C9A961] text-white font-bold rounded-xl hover:bg-[#3A342D] transition-all uppercase tracking-widest text-[10px] shadow-lg"
                  >
                    Select API Key
                  </button>
                ) : (
                  <button 
                    onClick={() => setAppState(AppState.IDLE)} 
                    className="w-full py-4 bg-[#3A342D] text-white font-bold rounded-xl hover:bg-[#C9A961] transition-all uppercase tracking-widest text-[10px]"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      )}

      {/* Email Auth Modal */}
      {showEmailAuth && (
        <EmailAuth
          initialMode={emailAuthMode}
          onSuccess={handleEmailAuthSuccess}
          onCancel={() => setShowEmailAuth(false)}
          onShowTerms={() => { setShowEmailAuth(false); setShowTerms(true); }}
        />
      )}

      {/* Phone Verification Modal (after email signup) */}
      {showPhoneVerification && (
        <PhoneVerification
          onSuccess={handlePhoneVerified}
          onCancel={() => {
            setShowPhoneVerification(false);
            setAppState(AppState.IDLE);
            // Check for pending upgrade in URL
            const urlParams = new URLSearchParams(window.location.search);
            const pendingUpgrade = urlParams.get('pending_upgrade');
            if (pendingUpgrade) {
              urlParams.delete('pending_upgrade');
              const newUrl = urlParams.toString() 
                ? `${window.location.pathname}?${urlParams}` 
                : window.location.pathname;
              window.history.replaceState({}, document.title, newUrl);
              setTimeout(() => {
                if (pendingUpgrade === 'STARTER_PACK') {
                  handleBuyStarterPack();
                } else {
                  handleUpgradeToPro();
                }
              }, 500);
            }
          }}
        />
      )}

      {/* Phone Recovery Modal (after first purchase) */}
      {showPhoneRecovery && userProfile?.id && (
        <PhoneRecoveryModal
          isOpen={showPhoneRecovery}
          onClose={() => setShowPhoneRecovery(false)}
          onSkip={() => setShowPhoneRecovery(false)}
          onVerified={async (phone) => {
            console.log('[PhoneRecovery] Phone verified:', phone);
            setShowPhoneRecovery(false);
            // Refresh profile to get updated phone_verified status and credits
            // (referral credits are awarded after phone verification)
            if (userProfile?.id) {
              await loadUserData(userProfile.id);
              refreshCreditState();
            }
            // Return to home if was on limit screen
            if (appState === AppState.LIMIT_REACHED) {
              setAppState(AppState.IDLE);
            }
          }}
          userId={userProfile.id}
        />
      )}

      {/* Invite Friends Modal */}
      <InviteFriendsModal
        isOpen={showInviteFriends}
        onClose={() => setShowInviteFriends(false)}
        referralCode={referralCode}
        referralLink={referralLink}
        referralCount={referralCount}
        referralCreditsEarned={referralCreditsEarned}
        onGenerateCode={generateReferralCode}
        onSendInvite={sendReferralInvite}
        isLoading={isGeneratingReferralCode}
      />

      {/* Admin Page - Full Screen */}
      {showAdminDashboard && (
        <div className="fixed inset-0 z-[60] bg-[#FAF9F6] overflow-y-auto">
          <AdminPage onBack={() => setShowAdminDashboard(false)} />
        </div>
      )}

      {/* Footer - only show on main pages, not modals */}
      {!showTerms && !showPricing && !showAccountSettings && (
        <footer className="fixed bottom-0 left-0 right-0 py-3 sm:py-4 text-center px-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <div className="flex items-center justify-center gap-4 text-[9px] sm:text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span>© {new Date().getFullYear()} upblock.ai</span>
            <span>•</span>
            <button 
              onClick={() => setShowTerms(true)}
              className="hover:text-[#C9A961] transition-colors underline"
            >
              Terms & Conditions
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};

export default App;