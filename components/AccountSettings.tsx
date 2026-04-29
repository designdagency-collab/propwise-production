import React, { useState, useEffect } from 'react';
import { PlanType, CreditState } from '../types';
import { supabaseService } from '../services/supabaseService';

interface SearchHistoryItem {
  address: string;
  created_at: string;
}

interface RevealedLead {
  id: string;
  property_address: string;
  target_price?: number;
  name?: string;
  email?: string;
  phone?: string | null;
  created_at: string;
}

interface AccountSettingsProps {
  plan: PlanType;
  creditState: CreditState;
  remainingCredits: number;
  userEmail?: string;
  userPhone?: string;
  phoneVerified?: boolean;
  isLoggedIn: boolean;
  isAdmin?: boolean;
  isSubscriber?: boolean;
  searchHistory: SearchHistoryItem[];
  onBack: () => void;
  onCancelSubscription: () => Promise<void>;
  onLogout: () => void | Promise<void>;
  onSearchAddress: (address: string) => void;
  onOpenLeadsDashboard?: () => void;
  onSecureAccount?: () => void;
}

const AccountSettings: React.FC<AccountSettingsProps> = ({
  plan,
  creditState,
  remainingCredits,
  userEmail,
  userPhone,
  phoneVerified,
  isLoggedIn,
  isAdmin = false,
  isSubscriber = false,
  searchHistory,
  onBack,
  onCancelSubscription,
  onLogout,
  onSearchAddress,
  onOpenLeadsDashboard,
  onSecureAccount
}) => {
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [revealedLeads, setRevealedLeads] = useState<RevealedLead[] | null>(null);
  const [revealsLoading, setRevealsLoading] = useState(false);

  // Fetch the user's revealed leads — subscribers/admins only.
  // Hidden entirely for everyone else (free homeowner default).
  useEffect(() => {
    if (!isSubscriber && !isAdmin) return;
    let cancelled = false;
    (async () => {
      setRevealsLoading(true);
      try {
        const response = await supabaseService.authenticatedFetch(
          '/api/leads?revealedOnly=true&limit=100',
          { method: 'GET' }
        );
        if (cancelled) return;
        if (!response.ok) {
          setRevealedLeads([]);
          return;
        }
        const data = await response.json();
        setRevealedLeads((data.items || []) as RevealedLead[]);
      } catch {
        if (!cancelled) setRevealedLeads([]);
      } finally {
        if (!cancelled) setRevealsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSubscriber, isAdmin]);

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    try {
      await onCancelSubscription();
      setCancelSuccess(true);
      setShowCancelConfirm(false);
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
    } finally {
      setIsCancelling(false);
    }
  };

  const getPlanName = () => {
    switch (plan) {
      case 'PRO': return 'Pro';
      case 'UNLIMITED_PRO': return 'Unlimited Pro';
      case 'STARTER_PACK': return 'Starter Pack';
      default: return 'Free Trial';
    }
  };

  const isPaidPlan = plan === 'PRO' || plan === 'UNLIMITED_PRO';

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-32">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 text-sm font-medium hover:text-[#C9A961] transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <i className="fa-solid fa-arrow-left"></i>
              Back to Home
            </button>
            
            <div className="flex items-center gap-2">
              {/* Secure Account button - show if phone not verified */}
              {isLoggedIn && !phoneVerified && onSecureAccount && (
                <button
                  onClick={onSecureAccount}
                  className="px-3 h-10 rounded-xl border-2 flex items-center gap-2 hover:border-[#C9A961] hover:text-[#C9A961] transition-all"
                  style={{ 
                    borderColor: 'rgba(239, 68, 68, 0.25)', 
                    color: 'var(--text-muted)',
                    boxShadow: '0 0 8px rgba(239, 68, 68, 0.15), 0 0 2px rgba(255, 255, 255, 0.5)'
                  }}
                  title="Add phone number for account recovery"
                >
                  <i className="fa-solid fa-shield-halved text-sm"></i>
                  <span className="text-xs font-medium">Secure Account</span>
                </button>
              )}
              
              <a
                href="mailto:support@upblock.ai"
                className="px-3 h-10 rounded-xl border flex items-center gap-2 hover:border-[#C9A961] hover:text-[#C9A961] transition-all"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                title="Contact Support"
              >
                <i className="fa-solid fa-envelope text-sm"></i>
                <span className="text-xs font-medium">Support</span>
              </a>
            </div>
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tighter" style={{ color: 'var(--text-primary)' }}>
            Account Settings
          </h1>
        </div>

        {!isLoggedIn ? (
          <div className="text-center py-12 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
            <i className="fa-solid fa-user-slash text-4xl mb-4" style={{ color: 'var(--text-muted)' }}></i>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Please log in to view account settings.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Account Info */}
            <div className="p-6 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                Account
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Email</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{userEmail || 'Not set'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Recovery Phone</span>
                  {phoneVerified && userPhone ? (
                    <span className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      {userPhone.slice(0, -4)}****
                      <i className="fa-solid fa-check-circle text-green-500 text-xs"></i>
                    </span>
                  ) : (
                    <button
                      onClick={onSecureAccount}
                      className="text-sm font-medium text-amber-500 hover:text-amber-600 transition-colors flex items-center gap-1"
                    >
                      <i className="fa-solid fa-plus text-xs"></i>
                      Add
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Subscription Info */}
            <div className="p-6 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                Subscription
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Current Plan</span>
                  <span className={`text-sm font-bold ${isPaidPlan ? 'text-[#C9A961]' : ''}`} style={{ color: isPaidPlan ? undefined : 'var(--text-primary)' }}>
                    {getPlanName()}
                    {isPaidPlan && <i className="fa-solid fa-crown ml-2 text-xs"></i>}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Audits Remaining</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {plan === 'UNLIMITED_PRO' ? '∞ Unlimited' : remainingCredits}
                  </span>
                </div>
                {plan === 'PRO' && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Billing Period</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {creditState.proMonth || 'Current Month'}
                    </span>
                  </div>
                )}
                {creditState.hasAccount && !isPaidPlan && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Account Bonus</span>
                    <span className="text-sm font-medium text-green-600">
                      <i className="fa-solid fa-check mr-1"></i> Applied (+1 audit)
                    </span>
                  </div>
                )}
                {creditState.creditTopups > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Bonus Credits</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      +{creditState.creditTopups}
                    </span>
                  </div>
                )}
              </div>

              {/* Cancel Subscription Button */}
              {plan === 'PRO' && !cancelSuccess && (
                <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border-color)' }}>
                  {!showCancelConfirm ? (
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="text-sm text-red-500 hover:text-red-600 transition-colors"
                    >
                      Cancel Subscription
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Are you sure you want to cancel? You'll lose access to Pro features at the end of your billing period.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={handleCancelSubscription}
                          disabled={isCancelling}
                          className="px-4 py-2 bg-red-500 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          {isCancelling ? (
                            <>
                              <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                              Cancelling...
                            </>
                          ) : (
                            'Yes, Cancel'
                          )}
                        </button>
                        <button
                          onClick={() => setShowCancelConfirm(false)}
                          className="px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg border transition-colors"
                          style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                        >
                          Keep Subscription
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {cancelSuccess && (
                <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex items-center gap-2 text-green-600">
                    <i className="fa-solid fa-check-circle"></i>
                    <span className="text-sm font-medium">
                      Subscription cancelled. You'll have access until the end of your billing period.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Revealed Leads — subscribers/admins only */}
            {(isSubscriber || isAdmin) && (
              <div className="p-6 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    Revealed Leads
                  </h2>
                  {revealedLeads && revealedLeads.length > 0 && (
                    <span className="text-[9px] px-2 py-1 rounded-full bg-[#C9A961]/10 text-[#C9A961] font-bold">
                      {revealedLeads.length} unlocked
                    </span>
                  )}
                </div>

                {revealsLoading ? (
                  <div className="text-center py-6 text-[#4A4137]/40">
                    <i className="fa-solid fa-spinner fa-spin text-lg"></i>
                  </div>
                ) : !revealedLeads || revealedLeads.length === 0 ? (
                  <div className="text-center py-8">
                    <i className="fa-solid fa-list-check text-2xl mb-3" style={{ color: 'var(--text-muted)' }}></i>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      No leads revealed yet. Open the dashboard to browse and unlock.
                    </p>
                    {onOpenLeadsDashboard && (
                      <button
                        onClick={onOpenLeadsDashboard}
                        className="mt-3 text-[10px] font-bold uppercase tracking-widest text-[#C9A961] hover:text-[#3A342D] transition-colors"
                      >
                        Open Leads Dashboard <i className="fa-solid fa-arrow-right ml-1"></i>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                    {revealedLeads.map((lead) => {
                      const date = new Date(lead.created_at);
                      const formatted = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
                      return (
                        <div
                          key={lead.id}
                          className="w-full flex items-start justify-between p-3 rounded-xl border"
                          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
                        >
                          <div className="flex items-start gap-3 text-left min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-[#C9A961]/10 flex items-center justify-center flex-shrink-0">
                              <i className="fa-solid fa-key text-[#C9A961] text-xs"></i>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                {lead.property_address}
                              </p>
                              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatted}</p>
                                {lead.target_price ? (
                                  <span className="text-[10px] font-bold text-[#C9A961]">
                                    ${lead.target_price.toLocaleString()}
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-3 mt-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                {lead.email && (
                                  <a href={`mailto:${lead.email}`} className="hover:text-[#C9A961] transition-colors truncate">
                                    <i className="fa-solid fa-envelope mr-1"></i>{lead.email}
                                  </a>
                                )}
                                {lead.phone && (
                                  <a href={`tel:${lead.phone}`} className="hover:text-[#C9A961] transition-colors flex-shrink-0">
                                    <i className="fa-solid fa-phone mr-1"></i>{lead.phone}
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Search History */}
            <div className="p-6 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  Search History
                </h2>
                {searchHistory.length > 0 && (
                  <span className="text-[9px] px-2 py-1 rounded-full bg-[#C9A961]/10 text-[#C9A961] font-medium">
                    7-day access
                  </span>
                )}
              </div>
              
              {searchHistory.length === 0 ? (
                <div className="text-center py-8">
                  <i className="fa-solid fa-clock-rotate-left text-2xl mb-3" style={{ color: 'var(--text-muted)' }}></i>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    No searches yet. Your property audits will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                  {searchHistory.map((item, index) => {
                    const date = new Date(item.created_at);
                    const formattedDate = date.toLocaleDateString('en-AU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    });
                    
                    // Check if this search is within 7 days (FREE re-search)
                    const now = new Date();
                    const daysSinceSearch = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
                    const isFreeResearch = daysSinceSearch <= 7;
                    
                    return (
                      <button
                        key={index}
                        onClick={() => onSearchAddress(item.address)}
                        className="w-full flex items-center justify-between p-3 rounded-xl border transition-all hover:border-[#C9A961] hover:shadow-sm group"
                        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
                      >
                        <div className="flex items-center gap-3 text-left min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[#C9A961]/10 flex items-center justify-center flex-shrink-0">
                            <i className="fa-solid fa-location-dot text-[#C9A961] text-xs"></i>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-[#C9A961] transition-colors" style={{ color: 'var(--text-primary)' }}>
                              {item.address}
                            </p>
                            <div className="flex items-center gap-2">
                              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                {formattedDate}
                              </p>
                              {isFreeResearch ? (
                                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#C9A961]/10 text-[#C9A961] font-bold uppercase">
                                  Available
                                </span>
                              ) : (
                                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#C9A961]/10 text-[#C9A961] font-medium">
                                  Data expired · 1 credit
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className="text-[9px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }}>
                            Search Again
                          </span>
                          <i className="fa-solid fa-arrow-right text-[10px] text-[#C9A961] opacity-0 group-hover:opacity-100 transition-opacity"></i>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Logout */}
            <div className="p-6 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
              >
                <i className="fa-solid fa-right-from-bracket"></i>
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountSettings;

