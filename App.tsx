import React, { useState, useCallback, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import PropertyResults from './components/PropertyResults';
import Pricing from './components/Pricing';
import PhoneVerification from './components/PhoneVerification';
import EmailAuth from './components/EmailAuth';
import TermsAndConditions from './components/TermsAndConditions';
import AccountSettings from './components/AccountSettings';
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
  const [showPricing, setShowPricing] = useState(false);
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [emailAuthMode, setEmailAuthMode] = useState<'signup' | 'login' | 'reset'>('signup');
  const [showTerms, setShowTerms] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [searchHistory, setSearchHistory] = useState<{ address: string; created_at: string }[]>([]);
  
  // Auth state - derived from Supabase session (no localStorage)
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(false); // true = login, false = signup
  
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
    // Default to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
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

  // Detect combined/amalgamated lot patterns (e.g., "2-4", "1 & 3")
  const isCombinedLotAddress = useCallback((addr: string): boolean => {
    const patterns = [
      /^\d+\s*-\s*\d+\s+/,           // "2-6 Smith St"
      /^\d+\s*&\s*\d+\s+/,           // "2 & 4 Smith St"
      /^\d+\s*,\s*\d+/,              // "2, 4 Smith St"
      /lots?\s*\d+\s*(&|,|-)\s*\d+/i // "Lot 1 & 2"
    ];
    return patterns.some(pattern => pattern.test(addr.trim()));
  }, []);

  // Debounced address input handler
  const handleAddressChange = useCallback((value: string) => {
    setAddress(value);
    
    // Allow combined lot addresses without autocomplete selection
    if (isCombinedLotAddress(value) && value.length > 15) {
      setIsValidAddress(true); // Combined lot address is valid
    } else {
      setIsValidAddress(false); // Reset - must select from autocomplete
    }
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new debounced fetch
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  }, [fetchSuggestions, isCombinedLotAddress]);

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

  // Clear processing overlay on page load (handles browser back from Stripe)
  useEffect(() => {
    // Small delay to allow payment success check to run first
    const timeout = setTimeout(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const isPaymentRedirect = urlParams.get('payment') === 'success';
      // Only clear if NOT a payment success redirect
      if (!isPaymentRedirect && isProcessingUpgrade) {
        console.log('[Stripe] Clearing stale processing state (browser back detected)');
        setIsProcessingUpgrade(false);
      }
    }, 500);
    return () => clearTimeout(timeout);
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

    console.log('[Auth] Initializing - Supabase will auto-handle OAuth hash via detectSessionInUrl');
    
    // Helper function to handle successful session
    const handleSessionLogin = async (session: any) => {
      if (!session?.user) return;
      
      console.log('[Auth] Login successful for:', session.user.email);
      setIsLoggedIn(true);
      setShowEmailAuth(false);
      
      // Load user data from Supabase (sets userProfile which derives email/phone)
      await loadUserData(session.user.id);
      refreshCreditState();
      
      // Clean up OAuth hash from URL if present
      if (window.location.hash.includes('access_token')) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    // Check for existing session or handle OAuth callback
    const initAuth = async () => {
      // First check if we have an OAuth callback with tokens in hash
      if (window.location.hash.includes('access_token')) {
        console.log('[Auth] OAuth callback detected - extracting tokens from hash');
        
        try {
          // Parse hash manually - save it before any potential modification
          const hash = window.location.hash.substring(1);
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token') || '';
          
          console.log('[Auth] Tokens extracted:', { 
            hasAccessToken: !!accessToken, 
            accessTokenLength: accessToken?.length,
            hasRefreshToken: !!refreshToken 
          });
          
          if (accessToken) {
            // Clear hash immediately
            window.history.replaceState({}, document.title, window.location.pathname);
            
            console.log('[Auth] Setting session with tokens...');
            
            // Set the session FIRST - this is required for persistence
            const { data: sessionData, error: sessionError } = await supabaseService.supabase!.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            console.log('[Auth] setSession result:', { 
              hasSession: !!sessionData.session, 
              email: sessionData.session?.user?.email,
              error: sessionError?.message 
            });
            
            if (sessionData.session?.user) {
              console.log('[Auth] Session established for:', sessionData.session.user.email);
              setIsLoggedIn(true);
              setShowEmailAuth(false);
              
              // Load user data from Supabase (sets userProfile)
              await loadUserData(sessionData.session.user.id);
              refreshCreditState();
              console.log('[Auth] OAuth flow complete');
              return;
            } else {
              console.error('[Auth] setSession failed:', sessionError?.message);
              
              // Fallback: try getUser
              const { data: userData } = await supabaseService.supabase!.auth.getUser(accessToken);
              if (userData.user) {
                console.log('[Auth] User verified via fallback:', userData.user.email);
                setIsLoggedIn(true);
                setShowEmailAuth(false);
                await loadUserData(userData.user.id);
                refreshCreditState();
              }
            }
          }
        } catch (err: any) {
          console.error('[Auth] Error processing OAuth callback:', err?.message || err);
        }
      }
      
      // Normal session check (no OAuth hash or OAuth failed)
      const { data: { session }, error } = await supabaseService.supabase!.auth.getSession();
      console.log('[Auth] getSession:', { hasSession: !!session, email: session?.user?.email, error: error?.message });
      
      if (session?.user) {
        handleSessionLogin(session);
      }
      // No localStorage fallback - Supabase session is the only source of truth
    };
    
    initAuth();

    // Track if OAuth is being processed to avoid race condition
    let oauthInProgress = window.location.hash.includes('access_token');
    
    // Listen to auth changes
    const { data: { subscription } } = supabaseService.supabase!.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] Event:', event, 'Has session:', !!session, 'Email:', session?.user?.email, 'oauthInProgress:', oauthInProgress);
        
        // CRITICAL: Skip loadUserData if OAuth is in progress
        // The OAuth code will call loadUserData AFTER setSession completes
        if (oauthInProgress && event === 'SIGNED_IN') {
          console.log('[Auth] Skipping loadUserData in event handler - OAuth flow will handle it');
          setIsLoggedIn(true);
          setShowEmailAuth(false);
          return; // Let OAuth code handle the rest
        }
        
        // Handle session restore on page load (INITIAL_SESSION) or sign in
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session) {
          setIsLoggedIn(true);
          setShowEmailAuth(false);
          
          // Load user data from Supabase (sets userProfile which derives email/phone)
          await loadUserData(session.user?.id);
          
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
          // Verify session is actually gone (browser back can trigger spurious events)
          const { data: { session: currentSession } } = await supabaseService.supabase!.auth.getSession();
          
          if (currentSession?.user) {
            console.log('SIGNED_OUT event but session still exists - ignoring');
            return;
          }
          
          setIsLoggedIn(false);
          setUserProfile(null);
        } else if (event === 'PASSWORD_RECOVERY') {
          // User clicked password reset link - show reset form
          setEmailAuthMode('reset');
          setShowEmailAuth(true);
        }
      }
    );

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
      
      // Payment was successful - process via Supabase
      const processPaymentSuccess = async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setShowUpgradeSuccess(true);
        
        const user = await supabaseService.getCurrentUser();
        if (user) {
          setIsLoggedIn(true);
          
          // Check if this session was already processed (prevent duplicates)
          const existingSub = await supabaseService.getActiveSubscription(user.id);
          if (existingSub?.stripe_session_id === sessionId) {
            console.log('[Payment] Session already processed');
            await loadUserData(user.id);
            setTimeout(() => setShowUpgradeSuccess(false), 5000);
            return;
          }
          
          // Update subscription in Supabase
          await supabaseService.updateSubscription(user.id, purchasedPlan as PlanType, sessionId);
          await supabaseService.updatePlanType(user.id, purchasedPlan as string);
          
          // Update credits in Supabase
          if (purchasedPlan === 'STARTER_PACK') {
            const currentProfile = await supabaseService.getCurrentProfile(user.id);
            const currentCredits = currentProfile?.credit_topups || 0;
            const newCredits = currentCredits + 3;
            console.log('[Payment] Adding 3 credits:', currentCredits, '->', newCredits);
            await supabaseService.updateCreditTopups(user.id, newCredits);
          } else if (purchasedPlan === 'BULK_PACK') {
            const currentProfile = await supabaseService.getCurrentProfile(user.id);
            const currentCredits = currentProfile?.credit_topups || 0;
            const newCredits = currentCredits + 20;
            console.log('[Payment] Adding 20 credits:', currentCredits, '->', newCredits);
            await supabaseService.updateCreditTopups(user.id, newCredits);
          } else if (purchasedPlan === 'PRO') {
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            console.log('[Payment] Initializing PRO quota:', currentMonth);
            await supabaseService.updateProUsage(user.id, currentMonth, 0);
          }
          
          // Reload profile to get updated state
          await loadUserData(user.id);
        } else {
          setIsLoggedIn(false);
        }
        
        setTimeout(() => setShowUpgradeSuccess(false), 5000);
      };
      
      processPaymentSuccess();
    } else if (paymentStatus === 'cancel') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Load user data from Supabase and sync credit state
  const loadUserData = async (userId?: string) => {
    console.log('[loadUserData] Called with userId:', userId);
    
    // Using server-side API now, no delay needed
    
    try {
      // Pass userId directly to avoid getUser() hanging during OAuth
      const profile = await supabaseService.getCurrentProfile(userId);
      console.log('[loadUserData] Got profile:', profile ? { id: profile.id, search_count: profile.search_count, credit_topups: profile.credit_topups, plan_type: profile.plan_type } : null);
      
      if (profile) {
        setUserProfile(profile);
        
        // Use billingService for consistent credit calculation (single source of truth)
        const state = calculateCreditState(profile);
        const calculatedCredits = getRemainingCredits(state);
        
        console.log('[loadUserData] Calculated from Supabase:', {
          profile: { 
            search_count: profile.search_count, 
            credit_topups: profile.credit_topups,
            plan_type: profile.plan_type,
            pro_used: profile.pro_used,
            pro_month: profile.pro_month
          },
          calculatedCredits,
          plan: state.plan
        });
        
        setRemainingCredits(calculatedCredits);
        setPlan(state.plan);
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
    }
  }, [userProfile]);

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
      const response = await fetch('/api/save-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        const response = await fetch('/api/save-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId, 
            address,
            consumption // Tell server what to update
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

  // Handle "Buy Starter Pack" CTA - calls Stripe checkout
  const handleBuyStarterPack = async () => {
    // REQUIRE LOGIN before payment - double-check with Supabase to avoid stale state
    let userLoggedIn = isLoggedIn;
    let email = userProfile?.email || '';
    
    if (!userLoggedIn) {
      // Verify with Supabase directly
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
      const url = new URL(window.location.href);
      url.searchParams.set('pending_upgrade', 'STARTER_PACK');
      window.history.replaceState({}, document.title, url.toString());
      return;
    }
    
    setIsProcessingUpgrade(true);
    
    // Call Stripe checkout for Starter Pack
    const checkoutEmail = email || userProfile?.email || '';
    const result = await stripeService.createCheckoutSession('STARTER_PACK', checkoutEmail);
    
    if (result.success && result.url) {
      // Redirect to Stripe checkout
      window.location.href = result.url;
      return;
    }
    
    // Handle error
    console.error('Stripe checkout error:', result.error);
    setIsProcessingUpgrade(false);
    setError(result.error || 'Failed to start checkout. Please try again.');
    setAppState(AppState.ERROR);
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
      const response = await stripeService.createCheckoutSession('PRO', email);
      
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
      const response = await fetch('/api/get-search-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    console.log(isNewUser ? 'New user signup' : 'Returning user login', '- loading from Supabase');
    
    setIsLoggedIn(true);
    
    // Load user data from Supabase (sets userProfile)
    const user = await supabaseService.getCurrentUser();
    if (user?.id) {
      await loadUserData(user.id);
      refreshCreditState();
    }
    
    setShowEmailAuth(false);
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

  const handleHome = useCallback(() => {
    setAppState(AppState.IDLE);
    setResults(null);
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
  }, []);

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!address.trim()) return;

    if (!checkSearchLimit()) {
      setAppState(AppState.LIMIT_REACHED);
      return;
    }

    setAppState(AppState.LOADING);
    setError(null);
    setIsQuotaError(false);

    try {
      const data = await geminiService.fetchPropertyInsights(address);
      setProgress(100);
      setLoadingMessage('Audit complete!');
      setTimeout(() => {
        setResults(data);
        setAppState(AppState.RESULTS);
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
  }, [address, hasKey]);

  const handleUpgrade = async (planType: PlanType = 'PRO') => {
    // Route to appropriate handler based on plan type
    if (planType === 'STARTER_PACK') {
      await handleBuyStarterPack();
      return;
    }
    // Default to PRO subscription
    await handleUpgradeToPro();
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
        isLoggedIn={isLoggedIn}
        userName={userProfile?.full_name}
        userEmail={userEmail}
        userPhone={userPhone}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
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
              <i className={`fa-solid ${plan === 'STARTER_PACK' ? 'fa-bolt' : 'fa-crown'}`}></i>
            </div>
            <div>
              <p className="text-sm font-bold">
                {plan === 'STARTER_PACK' ? '3 Audits Added!' : plan === 'BULK_PACK' ? '20 Audits Added!' : 'Pro Access Activated'}
              </p>
              <p className="text-[10px] text-white/60">
                {plan === 'STARTER_PACK' 
                  ? 'You have 3 additional property audits.'
                  : plan === 'BULK_PACK'
                  ? 'You have 20 additional property audits.'
                  : '10 audits per month. Search confidently.'}
              </p>
            </div>
            <button onClick={() => setShowUpgradeSuccess(false)} className="ml-4 text-white/20 hover:text-white">
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
          isLoggedIn={isLoggedIn}
          searchHistory={searchHistory}
          onBack={() => setShowAccountSettings(false)}
          onCancelSubscription={handleCancelSubscription}
          onLogout={handleLogout}
          onSearchAddress={handleSearchFromHistory}
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
                See the property <br/> <span className="text-[#C9A961] opacity-90">behind the listing.</span>
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