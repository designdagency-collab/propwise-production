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
import { billingService, getCreditState, getRemainingCredits, canAudit, consumeCredit, grantAccountBonus, addStarterPackCredits, activateProSubscription } from './services/billingService';
import { fingerprintService, checkDeviceSearchLimit, recordDeviceSearch } from './services/fingerprintService';
import { AppState, PropertyData, PlanType, CreditState } from './types';

const App: React.FC = () => {
  const [address, setAddress] = useState('');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [results, setResults] = useState<PropertyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  // Load plan from localStorage - check if user has already paid
  const [plan, setPlan] = useState<PlanType>(() => {
    const savedPlan = localStorage.getItem('prop_plan');
    if (savedPlan === 'PRO' || savedPlan === 'UNLIMITED_PRO') return savedPlan as PlanType;
    // Migrate old plans
    if (savedPlan === 'BUYER_PACK' || savedPlan === 'MONITOR') {
      localStorage.setItem('prop_plan', 'PRO');
      return 'PRO';
    }
    return 'FREE_TRIAL';
  });
  
  // Credit state for new pricing model
  const [creditState, setCreditState] = useState<CreditState>(getCreditState);
  const [remainingCredits, setRemainingCredits] = useState(() => getRemainingCredits(getCreditState()));
  
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
  const [isSignedUp, setIsSignedUp] = useState(() => localStorage.getItem('prop_signed_up') === 'true');
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [emailAuthMode, setEmailAuthMode] = useState<'signup' | 'login' | 'reset'>('signup');
  const [showTerms, setShowTerms] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [searchHistory, setSearchHistory] = useState<{ address: string; created_at: string }[]>([]);
  
  // Login state - restore from localStorage to persist across Stripe redirects
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('prop_is_logged_in') === 'true';
  });
  const [userEmail, setUserEmail] = useState<string>(() => {
    return localStorage.getItem('prop_user_email') || '';
  });
  const [userPhone, setUserPhone] = useState<string>(() => {
    return localStorage.getItem('prop_user_phone') || '';
  });
  const [isLoginMode, setIsLoginMode] = useState(false); // true = login, false = signup
  
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
    const handleSessionLogin = (session: any) => {
      if (!session?.user) return;
      
      console.log('[Auth] Login successful for:', session.user.email);
      setIsLoggedIn(true);
      setUserEmail(session.user.email || '');
      setUserPhone(session.user.phone || '');
      setIsSignedUp(true);
      localStorage.setItem('prop_is_logged_in', 'true');
      localStorage.setItem('prop_user_email', session.user.email || '');
      setShowEmailAuth(false);
      loadUserData(session.user.id);
      
      // Clean up OAuth hash from URL if present
      if (window.location.hash.includes('access_token')) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    // Check for existing session on mount
    // Supabase's detectSessionInUrl:true will auto-parse OAuth hash before this runs
    supabaseService.supabase!.auth.getSession().then(({ data: { session }, error }) => {
      console.log('[Auth] getSession:', { hasSession: !!session, email: session?.user?.email, error: error?.message });
      if (session?.user) {
        handleSessionLogin(session);
      }
    });

    // Listen to auth changes
    const { data: { subscription } } = supabaseService.supabase!.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] Event:', event, 'Has session:', !!session, 'Email:', session?.user?.email);
        
        // Handle session restore on page load (INITIAL_SESSION) or sign in
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session) {
          const sessionEmail = session.user?.email || '';
          const storedEmail = localStorage.getItem('prop_user_email') || '';
          
          // If different user than stored, clear ALL their data (prevents profile mixing)
          if (storedEmail && sessionEmail && storedEmail !== sessionEmail) {
            console.log('Session email mismatch - clearing stale data for new user');
            // Clear credit data for old user (will be loaded from Supabase for new user)
            localStorage.removeItem('prop_credit_topups');
            localStorage.removeItem('prop_pro_used');
            localStorage.removeItem('prop_pro_month');
            localStorage.removeItem('prop_plan');
            // NOTE: Don't clear prop_free_used or prop_has_account - loadUserData will sync from Supabase
          }
          
          setIsLoggedIn(true);
          setUserEmail(sessionEmail);
          setUserPhone(session.user?.phone || '');
          setIsSignedUp(true);
          localStorage.setItem('prop_is_logged_in', 'true');
          localStorage.setItem('prop_signed_up', 'true');
          localStorage.setItem('prop_user_email', sessionEmail);
          
          // Close auth modal if open (for Google OAuth redirect)
          setShowEmailAuth(false);
          
          // Load user data from Supabase - this syncs credits properly
          await loadUserData(session.user?.id);
          
          // Account bonus is now handled by loadUserData (sets prop_has_account if user exists)
          // This ensures we don't reset credits for returning users
          
          // Refresh credit state after loading user data
          const state = getCreditState();
          setCreditState(state);
          setRemainingCredits(getRemainingCredits(state));
          
          // Only return to idle if user has remaining credits
          // Don't reset LIMIT_REACHED if they're actually out of credits
          if (appState === AppState.LIMIT_REACHED && getRemainingCredits(state) > 0) {
            setAppState(AppState.IDLE);
          }
          
          // Check if there was a pending upgrade (user tried to pay before logging in)
          // Only do this on actual SIGNED_IN, not session restore
          if (event === 'SIGNED_IN') {
            const pendingUpgrade = localStorage.getItem('prop_pending_upgrade');
            if (pendingUpgrade) {
              localStorage.removeItem('prop_pending_upgrade');
              // Small delay to let the UI update, then redirect to payment
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
          // CRITICAL: Verify session is actually gone before logging out
          // Browser back from Stripe can trigger spurious SIGNED_OUT events
          const wasLoggedIn = localStorage.getItem('prop_is_logged_in') === 'true';
          
          if (wasLoggedIn) {
            // Double-check the session is actually gone
            const { data: { session: currentSession } } = await supabaseService.supabase!.auth.getSession();
            
            if (currentSession?.user) {
              // Session still exists! Don't log out - this was a spurious event
              console.log('SIGNED_OUT event but session still exists - ignoring');
              return;
            }
            console.log('SIGNED_OUT event confirmed - session is gone');
          }
          
          setIsLoggedIn(false);
          setUserEmail('');
          setUserPhone('');
          setUserProfile(null);
          // Clear user-specific localStorage
          localStorage.removeItem('prop_is_logged_in');
          localStorage.removeItem('prop_user_email');
          localStorage.removeItem('prop_user_phone');
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
    const purchasedPlan = urlParams.get('plan') || 'PRO'; // Default to PRO

    if (paymentStatus === 'success' && sessionId) {
      // Check if this session has already been processed (prevent duplicate credits on refresh)
      const processedSessions = JSON.parse(localStorage.getItem('prop_processed_sessions') || '[]');
      if (processedSessions.includes(sessionId)) {
        // Already processed - just clear URL and return
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      // Mark session as processed IMMEDIATELY to prevent race conditions
      processedSessions.push(sessionId);
      localStorage.setItem('prop_processed_sessions', JSON.stringify(processedSessions));
      
      // Clear URL params FIRST to prevent refresh issues
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Payment was successful - process after a small delay to let Supabase auth settle
      const processPaymentSuccess = async () => {
        // Give Supabase auth time to restore session
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Activate the purchased plan
        if (purchasedPlan === 'STARTER_PACK') {
          addStarterPackCredits();
          setPlan('STARTER_PACK');
          localStorage.setItem('prop_plan', 'STARTER_PACK');
        } else {
          activateProSubscription();
          setPlan('PRO');
          localStorage.setItem('prop_plan', 'PRO');
        }
        
        refreshCreditState();
        setShowUpgradeSuccess(true);
        
        // ALWAYS use Supabase session as source of truth
        if (supabaseService.isConfigured()) {
          const user = await supabaseService.getCurrentUser();
          if (user) {
            // Sync localStorage to match Supabase session
            setIsLoggedIn(true);
            setUserEmail(user.email || '');
            localStorage.setItem('prop_is_logged_in', 'true');
            localStorage.setItem('prop_user_email', user.email || '');
            
            // Update subscription in Supabase for THIS user
            await supabaseService.updateSubscription(user.id, purchasedPlan as PlanType, sessionId);
            
            // CRITICAL: Save credits/quota to Supabase for persistence
            if (purchasedPlan === 'STARTER_PACK') {
              const currentCredits = parseInt(localStorage.getItem('prop_credit_topups') || '0', 10);
              console.log('[Payment] Saving credit topups to Supabase:', currentCredits);
              await supabaseService.updateCreditTopups(user.id, currentCredits);
            } else if (purchasedPlan === 'PRO') {
              // Initialize PRO quota in Supabase
              const now = new Date();
              const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              console.log('[Payment] Initializing PRO quota in Supabase:', currentMonth);
              await supabaseService.updateProUsage(user.id, currentMonth, 0);
            }
            
            // Load user profile
            const profile = await supabaseService.getCurrentProfile();
            if (profile) {
              setUserProfile(profile);
            }
          } else {
            // No Supabase session - clear localStorage to prevent stale data
            localStorage.removeItem('prop_is_logged_in');
            setIsLoggedIn(false);
          }
        }
        
        // Hide success message after 5 seconds
        setTimeout(() => setShowUpgradeSuccess(false), 5000);
      };
      
      processPaymentSuccess();
    } else if (paymentStatus === 'cancel') {
      // Payment was cancelled - clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Load user data from Supabase and sync credit state
  const loadUserData = async (userId?: string) => {
    try {
      const profile = await supabaseService.getCurrentProfile();
      if (profile) {
        setUserProfile(profile);
        
        // CRITICAL: Sync search count from Supabase to localStorage
        // This ensures credits persist across devices/sessions
        const supabaseSearchCount = profile.search_count || 0;
        const localSearchCount = parseInt(localStorage.getItem('prop_free_used') || '0', 10);
        
        // Use the HIGHER count (prevents abuse by clearing localStorage)
        const actualSearchCount = Math.max(supabaseSearchCount, localSearchCount);
        localStorage.setItem('prop_free_used', actualSearchCount.toString());
        
        // CRITICAL: Sync credit topups from Supabase to localStorage
        // This ensures purchased credits persist across devices/sessions
        const supabaseCreditTopups = profile.credit_topups || 0;
        const localCreditTopups = parseInt(localStorage.getItem('prop_credit_topups') || '0', 10);
        
        // Use the HIGHER count (prevents loss of purchased credits)
        const actualCreditTopups = Math.max(supabaseCreditTopups, localCreditTopups);
        localStorage.setItem('prop_credit_topups', actualCreditTopups.toString());
        
        // If localStorage had more credits than Supabase, sync back to Supabase
        if (localCreditTopups > supabaseCreditTopups && userId) {
          console.log('[Credits] Local has more credits - syncing to Supabase:', localCreditTopups);
          await supabaseService.updateCreditTopups(userId, localCreditTopups);
        }
        
        // CRITICAL: Sync PRO monthly quota from Supabase
        // This prevents abuse by clearing browser/switching devices
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const supabaseProMonth = profile.pro_month || currentMonth;
        const supabaseProUsed = profile.pro_used || 0;
        const localProMonth = localStorage.getItem('prop_pro_month') || currentMonth;
        const localProUsed = parseInt(localStorage.getItem('prop_pro_used') || '0', 10);
        
        // If same month, use the HIGHER usage count (prevents abuse)
        // If different month, Supabase is source of truth
        if (supabaseProMonth === localProMonth) {
          const actualProUsed = Math.max(supabaseProUsed, localProUsed);
          localStorage.setItem('prop_pro_month', supabaseProMonth);
          localStorage.setItem('prop_pro_used', actualProUsed.toString());
          
          // Sync back to Supabase if local had higher usage
          if (localProUsed > supabaseProUsed && userId) {
            console.log('[Credits] Local has higher PRO usage - syncing to Supabase:', localProUsed);
            await supabaseService.updateProUsage(userId, localProMonth, localProUsed);
          }
        } else {
          // Different months - use Supabase values (server is source of truth)
          localStorage.setItem('prop_pro_month', supabaseProMonth);
          localStorage.setItem('prop_pro_used', supabaseProUsed.toString());
        }
        
        // User has an account (they're in the profiles table)
        localStorage.setItem('prop_has_account', 'true');
        
        console.log('[Credits] Synced from Supabase:', { 
          supabaseSearchCount, localSearchCount, actualSearchCount,
          supabaseCreditTopups, localCreditTopups, actualCreditTopups
        });
      }
      
      // Check subscription status
      if (userId) {
        const subscription = await supabaseService.getActiveSubscription(userId);
        if (subscription && subscription.plan_type && subscription.plan_type !== 'FREE' && subscription.plan_type !== 'FREE_TRIAL') {
          // Map old plan types to new ones
          let planToSet = subscription.plan_type;
          if (planToSet === 'BUYER_PACK' || planToSet === 'MONITOR') {
            planToSet = 'PRO';
          }
          setPlan(planToSet as PlanType);
          localStorage.setItem('prop_plan', planToSet);
        }
      }
    } catch (error) {
      console.error('[Credits] Error loading user data:', error);
      // Fail silently - localStorage is the fallback
    }
  };

  // Refresh credit state from localStorage
  const refreshCreditState = useCallback(() => {
    const state = getCreditState();
    setCreditState(state);
    setRemainingCredits(getRemainingCredits(state));
    // Also update plan if it changed
    if (state.plan !== plan) {
      setPlan(state.plan);
    }
  }, [plan]);

  const checkSearchLimit = () => {
    // API key users bypass limits
    if (hasKey) return true;
    
    // Logged-in users use credit system
    if (isLoggedIn) {
      return canAudit();
    }
    
    // Anonymous users: check device fingerprint
    // Only allow if deviceCanSearch is explicitly true
    return deviceCanSearch === true;
  };

  const incrementSearchCount = async () => {
    console.log('[Search] incrementSearchCount called, isLoggedIn:', isLoggedIn, 'plan:', plan);
    
    // Logged-in users: consume credit from credit system
    if (isLoggedIn) {
      consumeCredit();
      refreshCreditState();
      
      // Save search to Supabase if user is authenticated
      const isConfigured = supabaseService.isConfigured();
      console.log('[Search] Supabase configured:', isConfigured);
      
      if (isConfigured) {
        try {
          const user = await supabaseService.getCurrentUser();
          console.log('[Search] Current user:', user?.id, user?.email);
          
          if (user?.id) {
            console.log('[Search] Saving to Supabase - User:', user.id, 'Address:', address);
            await supabaseService.incrementSearchCountInDB(user.id, address);
            
            // CRITICAL: If PRO user, also sync PRO usage to Supabase
            // This prevents abuse by clearing browser/switching devices
            if (plan === 'PRO') {
              console.log('[Search] PRO user - syncing usage to Supabase');
              await supabaseService.incrementProUsage(user.id);
            }
            
            console.log('[Search] Save completed successfully');
          } else {
            console.warn('[Search] No user ID found, cannot save to Supabase');
          }
        } catch (error) {
          console.error('[Search] Failed to save search to Supabase:', error);
        }
      } else {
        console.warn('[Search] Supabase not configured, skipping save');
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

  // Handle "Create Account" CTA - grants +1 bonus audit
  const handleCreateAccount = () => {
    // If already logged in, just grant the bonus
    if (isLoggedIn) {
      grantAccountBonus();
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
    let email = userEmail;
    
    if (!userLoggedIn) {
      // State might be stale - verify with Supabase directly
      const user = await supabaseService.getCurrentUser();
      if (user) {
        console.log('[Auth] Session recovered from Supabase:', user.email);
        setIsLoggedIn(true);
        setUserEmail(user.email || '');
        localStorage.setItem('prop_is_logged_in', 'true');
        localStorage.setItem('prop_user_email', user.email || '');
        userLoggedIn = true;
        email = user.email || '';
      }
    }
    
    if (!userLoggedIn) {
      // User is truly not logged in - show signup
      setShowPricing(false);
      setEmailAuthMode('signup');
      setShowEmailAuth(true);
      localStorage.setItem('prop_pending_upgrade', 'STARTER_PACK');
      return;
    }
    
    setIsProcessingUpgrade(true);
    
    // Call Stripe checkout for Starter Pack (use recovered email if available)
    const checkoutEmail = email || userProfile?.email || localStorage.getItem('prop_user_email') || '';
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
    // REQUIRE LOGIN before payment - double-check with Supabase to avoid stale state
    let userLoggedIn = isLoggedIn;
    let email = userProfile?.email || userEmail || localStorage.getItem('prop_user_email');
    
    if (!userLoggedIn) {
      // State might be stale - verify with Supabase directly
      const user = await supabaseService.getCurrentUser();
      if (user) {
        console.log('[Auth] Session recovered from Supabase:', user.email);
        setIsLoggedIn(true);
        setUserEmail(user.email || '');
        localStorage.setItem('prop_is_logged_in', 'true');
        localStorage.setItem('prop_user_email', user.email || '');
        userLoggedIn = true;
        email = user.email || '';
      }
    }
    
    if (!userLoggedIn) {
      // User is truly not logged in - show signup
      setShowPricing(false);
      setEmailAuthMode('signup');
      setShowEmailAuth(true);
      localStorage.setItem('prop_pending_upgrade', 'PRO');
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
    
    // Clear state FIRST (don't wait for Supabase)
    setIsLoggedIn(false);
    setUserEmail('');
    setUserPhone('');
    setUserProfile(null);
    setSearchHistory([]);
    setShowAccountSettings(false);
    setPlan('FREE_TRIAL');
    
    // Clear ALL user-specific localStorage
    localStorage.removeItem('prop_is_logged_in');
    localStorage.removeItem('prop_user_email');
    localStorage.removeItem('prop_user_phone');
    localStorage.removeItem('prop_signed_up');
    localStorage.removeItem('prop_has_account');
    localStorage.removeItem('prop_free_used');
    localStorage.removeItem('prop_credit_topups');
    localStorage.removeItem('prop_pro_used');
    localStorage.removeItem('prop_pro_month');
    localStorage.removeItem('prop_plan');
    localStorage.removeItem('prop_processed_sessions');
    
    // Refresh credit state to show free trial
    refreshCreditState();
    
    // Then sign out from Supabase (don't block on this)
    try {
      await supabaseService.signOut();
    } catch (error) {
      console.log('Supabase signout error (ignored):', error);
    }
  };

  // Fetch search history from Supabase
  const fetchSearchHistory = async () => {
    console.log('Fetching search history...', { isLoggedIn, configured: supabaseService.isConfigured() });
    
    if (!isLoggedIn || !supabaseService.isConfigured()) {
      console.log('Not fetching - not logged in or Supabase not configured');
      setSearchHistory([]);
      return;
    }
    
    try {
      const user = await supabaseService.getCurrentUser();
      console.log('Current user for history:', user?.id);
      if (user) {
        const history = await supabaseService.getSearchHistory(user.id);
        console.log('Fetched search history:', history);
        setSearchHistory(history);
      } else {
        console.log('No user found');
        setSearchHistory([]);
      }
    } catch (error) {
      console.error('Failed to fetch search history:', error);
      setSearchHistory([]);
    }
  };

  // Handle searching an address from history
  const handleSearchFromHistory = (historyAddress: string) => {
    setAddress(historyAddress);
    setShowAccountSettings(false);
    // Trigger search after state updates
    setTimeout(() => {
      const searchEvent = new Event('submit');
      document.querySelector('form')?.dispatchEvent(searchEvent);
    }, 100);
  };

  // Handle subscription cancellation
  const handleCancelSubscription = async () => {
    // TODO: Call Stripe to cancel subscription when connected
    // For now, just reset to FREE_TRIAL locally
    localStorage.setItem('prop_plan', 'FREE_TRIAL');
    localStorage.removeItem('prop_pro_month');
    localStorage.removeItem('prop_pro_used');
    setPlan('FREE_TRIAL');
    refreshCreditState();
    
    // If Supabase is configured, update subscription status
    if (supabaseService.isConfigured() && userProfile?.id) {
      try {
        await supabaseService.updateSubscription(userProfile.id, 'FREE_TRIAL');
      } catch (error) {
        console.error('Failed to update subscription in Supabase:', error);
      }
    }
  };

  // Handle email auth success (both signup and login)
  const handleEmailAuthSuccess = async (email: string, isNewUser: boolean) => {
    const storedEmail = localStorage.getItem('prop_user_email') || '';
    
    // If this is a different user, clear their paid plan data (not free credits - Supabase has those)
    if (storedEmail && storedEmail !== email) {
      console.log('Different user logging in - clearing old user plan data');
      localStorage.removeItem('prop_credit_topups');
      localStorage.removeItem('prop_pro_used');
      localStorage.removeItem('prop_pro_month');
      localStorage.removeItem('prop_plan');
      // NOTE: Don't clear prop_free_used or prop_has_account - loadUserData will sync from Supabase
    }
    
    setIsLoggedIn(true);
    setUserEmail(email);
    setIsSignedUp(true);
    localStorage.setItem('prop_is_logged_in', 'true');
    localStorage.setItem('prop_signed_up', 'true');
    localStorage.setItem('prop_user_email', email);
    
    // Only grant account bonus for NEW signups (not returning users logging in)
    // loadUserData will set prop_has_account for existing users
    if (isNewUser) {
      console.log('New user signup - granting account bonus for:', email);
      grantAccountBonus();
    } else {
      console.log('Returning user login - credits will be loaded from Supabase');
    }
    
    // Force refresh credit state
    const state = getCreditState();
    console.log('Credit state after signup:', state, 'Remaining:', getRemainingCredits(state));
    setCreditState(state);
    setRemainingCredits(getRemainingCredits(state));
    
    // Get current user and load their data + subscription
    const user = await supabaseService.getCurrentUser();
    if (user?.id) {
      await loadUserData(user.id);
    }
    
    setShowEmailAuth(false);
    setAppState(AppState.IDLE); // Go back so they can continue
    
    // Check if there was a pending upgrade (user tried to pay before logging in)
    const pendingUpgrade = localStorage.getItem('prop_pending_upgrade');
    if (pendingUpgrade) {
      localStorage.removeItem('prop_pending_upgrade');
      // Small delay to let the UI update, then redirect to payment
      setTimeout(() => {
        handleUpgrade(pendingUpgrade as PlanType);
      }, 500);
    }
  };

  // Handle phone verification success (for optional account security)
  const handlePhoneVerified = async (phone: string) => {
    setUserPhone(phone);
    localStorage.setItem('prop_user_phone', phone);
    
    // Get current user and load their data + subscription
    const user = await supabaseService.getCurrentUser();
    if (user?.id) {
      await loadUserData(user.id);
    }
    
    setShowPhoneVerification(false);
    setAppState(AppState.IDLE); // Now they can continue
    
    // Check if there was a pending upgrade (user tried to pay before logging in)
    const pendingUpgrade = localStorage.getItem('prop_pending_upgrade');
    if (pendingUpgrade) {
      localStorage.removeItem('prop_pending_upgrade');
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
          } else {
            // Fallback to coordinates if geocoding fails
            setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          }
        } catch (err) {
          console.error('Reverse geocoding failed:', err);
          // Fallback to coordinates
          setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
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
        if (!hasKey) incrementSearchCount();
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
                {plan === 'STARTER_PACK' ? '3 Audits Added!' : 'Pro Access Activated'}
              </p>
              <p className="text-[10px] text-white/60">
                {plan === 'STARTER_PACK' 
                  ? 'You have 3 additional property audits.' 
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
              
              <div className="max-w-2xl mx-auto">
                 <form onSubmit={handleSearch} className="relative group">
                  <div className="absolute -inset-1 bg-[#C9A961] rounded-[2rem] blur opacity-5 group-hover:opacity-10 transition duration-1000"></div>
                  <div className="relative flex items-center p-2 rounded-[2rem] shadow-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                    <div className="flex-grow flex items-center px-6">
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Enter street address..."
                        className="w-full py-3 sm:py-4 bg-transparent text-base sm:text-lg font-medium focus:outline-none"
                        style={{ color: 'var(--text-primary)' }}
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
                        disabled={!address.trim()}
                        className="bg-[#C9A961] text-white px-6 sm:px-8 h-11 sm:h-12 rounded-xl font-bold hover:bg-[#3A342D] transition-all flex items-center gap-2 shadow-sm disabled:opacity-30 uppercase tracking-widest text-[11px] sm:text-[10px]"
                      >
                        Audit Block
                      </button>
                    </div>
                  </div>
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
            // Allow skip - they can verify later
            setShowPhoneVerification(false);
            setAppState(AppState.IDLE);
            // Still check for pending upgrades
            const pendingUpgrade = localStorage.getItem('prop_pending_upgrade');
            if (pendingUpgrade) {
              localStorage.removeItem('prop_pending_upgrade');
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