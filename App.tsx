import React, { useState, useCallback, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import PropertyResults from './components/PropertyResults';
import Pricing from './components/Pricing';
import PhoneVerification from './components/PhoneVerification';
import EmailAuth from './components/EmailAuth';
import TermsAndConditions from './components/TermsAndConditions';
import { geminiService } from './services/geminiService';
import { stripeService } from './services/stripeService';
import { supabaseService } from './services/supabaseService';
import { billingService, getCreditState, getRemainingCredits, canAudit, consumeCredit, grantAccountBonus, addStarterPackCredits, activateProSubscription } from './services/billingService';
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
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Login state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userPhone, setUserPhone] = useState<string>('');
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
    if (!supabaseService.isConfigured()) return;

    // Check for existing session on mount
    supabaseService.supabase!.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setIsLoggedIn(true);
        setUserEmail(session.user.email || '');
        setUserPhone(session.user.phone || '');
        setIsSignedUp(true);
        loadUserData(session.user.id);
      }
    });

    // Listen to auth changes
    const { data: { subscription } } = supabaseService.supabase!.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, 'Session:', !!session);
        
        // Handle session restore on page load (INITIAL_SESSION) or sign in
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session) {
          setIsLoggedIn(true);
          setUserEmail(session.user?.email || '');
          setUserPhone(session.user?.phone || '');
          setIsSignedUp(true);
          localStorage.setItem('prop_signed_up', 'true');
          localStorage.setItem('prop_user_email', session.user?.email || '');
          
          // Grant account bonus on sign in (idempotent - only adds if not already set)
          grantAccountBonus();
          
          // Close auth modal if open (for Google OAuth redirect)
          setShowEmailAuth(false);
          
          await loadUserData(session.user?.id);
          
          // Refresh credit state after loading user data
          const state = getCreditState();
          setCreditState(state);
          setRemainingCredits(getRemainingCredits(state));
          
          // Return to idle state so they can search
          if (appState === AppState.LIMIT_REACHED) {
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
          setIsLoggedIn(false);
          setUserEmail('');
          setUserPhone('');
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
    const purchasedPlan = urlParams.get('plan') || 'PRO'; // Default to PRO

    if (paymentStatus === 'success' && sessionId) {
      // Payment was successful - activate the purchased plan
      if (purchasedPlan === 'STARTER_PACK') {
        // Add starter pack credits
        addStarterPackCredits();
      } else {
        // Activate PRO subscription
        activateProSubscription();
        setPlan('PRO');
      }
      
      refreshCreditState();
      setShowUpgradeSuccess(true);
      
      // Update Supabase subscription if user is logged in
      const updateSubscription = async () => {
        const user = await supabaseService.getCurrentUser();
        if (user?.id && supabaseService.isConfigured()) {
          await supabaseService.updateSubscription(user.id, purchasedPlan as PlanType, sessionId);
        }
      };
      updateSubscription();
      
      // Clear URL params without reload
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Hide success message after 5 seconds
      setTimeout(() => setShowUpgradeSuccess(false), 5000);
    } else if (paymentStatus === 'cancel') {
      // Payment was cancelled - clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Load user data from Supabase (optional enhancement)
  const loadUserData = async (userId?: string) => {
    try {
      const profile = await supabaseService.getCurrentProfile();
      if (profile) {
        setUserProfile(profile);
        // Sync Supabase count with localStorage if available
        if (profile.search_count) {
          localStorage.setItem('prop_search_count_total', profile.search_count.toString());
        }
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
    
    // Use new credit system
    return canAudit();
  };

  const incrementSearchCount = () => {
    // Use new credit system - consume one credit
    consumeCredit();
    refreshCreditState();
    
    // Also sync to Supabase if user is authenticated (optional enhancement)
    if (userProfile?.id) {
      supabaseService.incrementSearchCountInDB(userProfile.id, address).catch(() => {
        // Fail silently - localStorage is the source of truth
      });
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

  // Handle "Buy Starter Pack" CTA - placeholder for Stripe
  const handleBuyStarterPack = async () => {
    // REQUIRE LOGIN before payment
    if (!isLoggedIn) {
      setShowPricing(false);
      setEmailAuthMode('signup');
      setShowEmailAuth(true);
      localStorage.setItem('prop_pending_upgrade', 'STARTER_PACK');
      return;
    }
    
    setIsProcessingUpgrade(true);
    
    // TODO: Wire to Stripe - for now simulate purchase
    // const result = await billingService.startCheckoutStarter();
    // if (result.success && result.url) {
    //   window.location.href = result.url;
    //   return;
    // }
    
    // SIMULATION: Add credits directly (remove when Stripe is connected)
    setTimeout(() => {
      addStarterPackCredits();
      refreshCreditState();
      setIsProcessingUpgrade(false);
      setShowUpgradeSuccess(true);
      setShowPricing(false);
      setTimeout(() => setShowUpgradeSuccess(false), 5000);
    }, 1000);
  };

  // Handle "Upgrade to Pro" CTA
  const handleUpgradeToPro = async () => {
    // REQUIRE LOGIN before payment
    if (!isLoggedIn) {
      setShowPricing(false);
      setEmailAuthMode('signup');
      setShowEmailAuth(true);
      localStorage.setItem('prop_pending_upgrade', 'PRO');
      return;
    }
    
    setIsProcessingUpgrade(true);
    setError(null);
    
    const email = userProfile?.email || userEmail || localStorage.getItem('prop_user_email');
    
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
    await supabaseService.signOut();
    setIsLoggedIn(false);
    setUserEmail('');
    setUserPhone('');
    setUserProfile(null);
    // Keep localStorage plan so they don't lose paid status if they paid without account
  };

  // Handle email auth success (both signup and login)
  const handleEmailAuthSuccess = async (email: string, isNewUser: boolean) => {
    setIsLoggedIn(true);
    setUserEmail(email);
    setIsSignedUp(true);
    localStorage.setItem('prop_signed_up', 'true');
    localStorage.setItem('prop_user_email', email);
    
    // Grant account bonus (+1 free audit) for creating account
    grantAccountBonus();
    refreshCreditState();
    
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
  };

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        setIsLocating(false);
      },
      () => {
        setError("Location access denied");
        setIsLocating(false);
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
        remainingCredits={remainingCredits}
        onUpgrade={() => setShowPricing(true)} 
        onHome={handleHome}
        onLogin={handleLogin}
        onLogout={handleLogout}
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
          <p className="text-[#3A342D]/40 font-medium text-xs sm:text-sm mt-2">Finalising your Unlimited Access...</p>
        </div>
      )}

      {/* Upgrade Success Notification */}
      {showUpgradeSuccess && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10 fade-in duration-500">
          <div className="bg-[#3A342D] text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-[#C9A961]/20">
            <div className="w-8 h-8 bg-[#C9A961] rounded-full flex items-center justify-center text-xs">
              <i className="fa-solid fa-check"></i>
            </div>
            <div>
              <p className="text-sm font-bold">Unlimited Access Activated</p>
              <p className="text-[10px] text-white/60">Search as much as you need.</p>
            </div>
            <button onClick={() => setShowUpgradeSuccess(false)} className="ml-4 text-white/20 hover:text-white">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      )}

      {showTerms ? (
        <TermsAndConditions onBack={() => setShowTerms(false)} />
      ) : showPricing ? (
        <Pricing 
          currentPlan={plan}
          onUpgrade={handleUpgrade}
          onBack={() => setShowPricing(false)}
          onShowTerms={() => { setShowPricing(false); setShowTerms(true); }}
        />
      ) : (
        <main className="pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          {appState === AppState.IDLE && (
            <div className="max-w-4xl mx-auto text-center py-12 md:py-24 space-y-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest border" style={{ backgroundColor: 'var(--accent-gold-light)', borderColor: 'var(--border-input)' }}>
                <i className="fa-solid fa-file-contract"></i>
                <span>Professional Site Audit & Intelligence</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold tracking-tighter leading-tight" style={{ color: 'var(--text-primary)' }}>
                See the property <br/> <span className="text-[#C9A961] opacity-90">behind the listing.</span>
              </h1>
              <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-medium" style={{ color: 'var(--text-muted)' }}>
                A detailed intelligence report decoding zoning potential, infrastructure, and property records in plain language.
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
                      <button
                        type="button"
                        onClick={detectLocation}
                        className="w-12 h-12 text-[#B8C5A0] hover:text-[#C9A961] transition-all"
                      >
                        <i className={`fa-solid ${isLocating ? 'fa-spinner fa-spin' : 'fa-location-crosshairs'}`}></i>
                      </button>
                      <button
                        type="submit"
                        disabled={!address.trim()}
                        className="bg-[#C9A961] text-white px-6 sm:px-8 h-11 sm:h-12 rounded-xl font-bold hover:bg-[#3A342D] transition-all flex items-center gap-2 shadow-sm disabled:opacity-30 uppercase tracking-widest text-[11px] sm:text-[10px]"
                      >
                        Audit Site
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
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-3xl mx-auto border" style={{ backgroundColor: 'var(--accent-gold-light)', borderColor: 'var(--border-input)' }}>
                <i className="fa-solid fa-lock text-[#C9A961]"></i>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tighter leading-none" style={{ color: 'var(--text-primary)' }}>
                You've Used Your Free Credits
              </h2>
              <p className="text-sm sm:text-base max-w-md mx-auto font-medium leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {creditState.hasAccount 
                  ? "You've used your 2 free property audits. Get more credits or upgrade to Pro for 10 audits per month."
                  : "You've used your 1 free property audit. Create an account for 1 bonus audit, or upgrade for more."}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
                {/* CTA 1: Create Account (if no account yet) */}
                {!creditState.hasAccount && (
                  <button onClick={handleCreateAccount} className="border-2 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold transition-all text-[11px] sm:text-[10px] uppercase tracking-widest hover:border-[#C9A961] hover:text-[#C9A961]" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--text-primary)', color: 'var(--text-primary)' }}>
                    <i className="fa-solid fa-user-plus mr-2"></i>
                    Create Account (+1 Audit)
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
        />
      )}

      {/* Phone Verification Modal (optional security) */}
      {showPhoneVerification && (
        <PhoneVerification
          onSuccess={handlePhoneVerified}
          onCancel={() => setShowPhoneVerification(false)}
        />
      )}

      {/* Footer - only show on main pages, not modals */}
      {!showTerms && !showPricing && (
        <footer className="fixed bottom-0 left-0 right-0 py-4 text-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <div className="flex items-center justify-center gap-4 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span>© {new Date().getFullYear()} BlockCheck.ai</span>
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