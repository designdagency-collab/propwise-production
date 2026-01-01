/**
 * Billing Service - Credit calculations (NO localStorage)
 * 
 * All data comes from Supabase profiles table.
 * This module only does CALCULATIONS, not storage.
 */

import { CreditState, PlanType } from '../types';

// Constants
export const FREE_LIFETIME_BASE = 0;      // No free audits for anonymous users - must sign up
export const ACCOUNT_BONUS = 2;           // 2 free audits when they create an account
export const STARTER_PACK_CREDITS = 3;    // 3 audits per purchase
export const PRO_MONTHLY_LIMIT = 10;      // 10 audits per month for PRO

/**
 * Calculate credit state from Supabase profile data
 * NO localStorage - profile is the source of truth
 */
export function calculateCreditState(profile: any | null): CreditState {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  if (!profile) {
    // Anonymous user - no credits
    return {
      freeUsed: 0,
      hasAccount: false,
      creditTopups: 0,
      plan: 'FREE_TRIAL' as PlanType,
      proMonth: currentMonth,
      proUsed: 0,
    };
  }
  
  return {
    freeUsed: profile.search_count || 0,
    hasAccount: true, // If they have a profile, they have an account
    creditTopups: profile.credit_topups || 0,
    plan: (profile.plan_type as PlanType) || 'FREE_TRIAL',
    proMonth: profile.pro_month || currentMonth,
    proUsed: profile.pro_used || 0,
  };
}

/**
 * Calculate remaining credits based on state
 */
export function getRemainingCredits(state: CreditState): number {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // PRO subscription - 10 per month + any bonus topups
  if (state.plan === 'PRO') {
    let monthlyRemaining: number;
    // Reset if new month
    if (state.proMonth !== currentMonth) {
      monthlyRemaining = PRO_MONTHLY_LIMIT;
    } else {
      monthlyRemaining = Math.max(0, PRO_MONTHLY_LIMIT - state.proUsed);
    }
    // Add any purchased bonus credits
    return monthlyRemaining + state.creditTopups;
  }
  
  // UNLIMITED_PRO - unlimited (hidden tier)
  if (state.plan === 'UNLIMITED_PRO') {
    return 999;
  }
  
  // FREE_TRIAL or STARTER_PACK
  const freeLifetimeCredits = FREE_LIFETIME_BASE + (state.hasAccount ? ACCOUNT_BONUS : 0);
  const freeRemaining = Math.max(0, freeLifetimeCredits - state.freeUsed);
  const totalRemaining = freeRemaining + state.creditTopups;
  
  return totalRemaining;
}

/**
 * Check if user can perform an audit
 */
export function canAudit(state: CreditState): boolean {
  return getRemainingCredits(state) > 0;
}

/**
 * Calculate what to update after consuming a credit
 * Returns the fields to update in Supabase
 */
export function calculateCreditConsumption(state: CreditState): {
  field: 'search_count' | 'pro_used' | 'credit_topups';
  newValue: number;
  proMonthReset?: string;
} | null {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // PRO subscription
  if (state.plan === 'PRO') {
    // Reset if new month
    if (state.proMonth !== currentMonth) {
      return { field: 'pro_used', newValue: 1, proMonthReset: currentMonth };
    }
    // Use monthly credits first
    if (state.proUsed < PRO_MONTHLY_LIMIT) {
      return { field: 'pro_used', newValue: state.proUsed + 1 };
    }
    // Monthly exhausted - fall back to purchased credit topups
    if (state.creditTopups > 0) {
      return { field: 'credit_topups', newValue: state.creditTopups - 1 };
    }
    return null; // No credits available
  }
  
  // UNLIMITED_PRO - never consume (but track usage)
  if (state.plan === 'UNLIMITED_PRO') {
    return { field: 'search_count', newValue: state.freeUsed + 1 };
  }
  
  // FREE_TRIAL or STARTER_PACK
  const freeLifetimeCredits = FREE_LIFETIME_BASE + (state.hasAccount ? ACCOUNT_BONUS : 0);
  
  // First use up free credits
  if (state.freeUsed < freeLifetimeCredits) {
    return { field: 'search_count', newValue: state.freeUsed + 1 };
  }
  
  // Then use topups
  if (state.creditTopups > 0) {
    return { field: 'credit_topups', newValue: state.creditTopups - 1 };
  }
  
  return null; // No credits available
}

// Dev helper - expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).__billingConstants = {
    FREE_LIFETIME_BASE,
    ACCOUNT_BONUS,
    STARTER_PACK_CREDITS,
    PRO_MONTHLY_LIMIT,
  };
}

export const billingService = {
  calculateCreditState,
  getRemainingCredits,
  canAudit,
  calculateCreditConsumption,
  FREE_LIFETIME_BASE,
  ACCOUNT_BONUS,
  STARTER_PACK_CREDITS,
  PRO_MONTHLY_LIMIT,
};
