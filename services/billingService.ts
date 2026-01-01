/**
 * Billing Service - Placeholder for Stripe integration
 * 
 * This module handles credit management and payment placeholders.
 * Will be connected to Stripe later.
 */

import { CreditState, PlanType } from '../types';

// Constants
const FREE_LIFETIME_BASE = 0;      // No free audits for anonymous users - must sign up
const ACCOUNT_BONUS = 2;           // 2 free audits when they create an account
const STARTER_PACK_CREDITS = 3;    // 3 audits per purchase
const PRO_MONTHLY_LIMIT = 10;      // 10 audits per month for PRO

// LocalStorage keys
const KEYS = {
  FREE_USED: 'prop_free_used',
  HAS_ACCOUNT: 'prop_has_account',
  CREDIT_TOPUPS: 'prop_credit_topups',
  PLAN: 'prop_plan',
  PRO_MONTH: 'prop_pro_month',
  PRO_USED: 'prop_pro_used',
} as const;

/**
 * Get current credit state from localStorage
 */
export function getCreditState(): CreditState {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  return {
    freeUsed: parseInt(localStorage.getItem(KEYS.FREE_USED) || '0', 10),
    hasAccount: localStorage.getItem(KEYS.HAS_ACCOUNT) === 'true',
    creditTopups: parseInt(localStorage.getItem(KEYS.CREDIT_TOPUPS) || '0', 10),
    plan: (localStorage.getItem(KEYS.PLAN) as PlanType) || 'FREE_TRIAL',
    proMonth: localStorage.getItem(KEYS.PRO_MONTH) || currentMonth,
    proUsed: parseInt(localStorage.getItem(KEYS.PRO_USED) || '0', 10),
  };
}

/**
 * Calculate remaining credits based on current state
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
  
  // FREE_TRIAL (default) or STARTER_PACK
  const freeLifetimeCredits = FREE_LIFETIME_BASE + (state.hasAccount ? ACCOUNT_BONUS : 0);
  const freeRemaining = Math.max(0, freeLifetimeCredits - state.freeUsed);
  const totalRemaining = freeRemaining + state.creditTopups;
  
  return totalRemaining;
}

/**
 * Check if user can perform an audit
 */
export function canAudit(state?: CreditState): boolean {
  const creditState = state || getCreditState();
  return getRemainingCredits(creditState) > 0;
}

/**
 * Consume one credit after successful audit
 * Returns true if credit was consumed, false if no credits available
 */
export function consumeCredit(): boolean {
  const state = getCreditState();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // PRO subscription
  if (state.plan === 'PRO') {
    // Reset if new month
    if (state.proMonth !== currentMonth) {
      localStorage.setItem(KEYS.PRO_MONTH, currentMonth);
      localStorage.setItem(KEYS.PRO_USED, '1');
      return true;
    }
    // Use monthly credits first
    if (state.proUsed < PRO_MONTHLY_LIMIT) {
      localStorage.setItem(KEYS.PRO_USED, String(state.proUsed + 1));
      return true;
    }
    // Monthly exhausted - fall back to purchased credit topups
    if (state.creditTopups > 0) {
      localStorage.setItem(KEYS.CREDIT_TOPUPS, String(state.creditTopups - 1));
      console.log('[Billing] PRO user using bonus credit, remaining:', state.creditTopups - 1);
      return true;
    }
    return false;
  }
  
  // UNLIMITED_PRO - never consume
  if (state.plan === 'UNLIMITED_PRO') {
    return true;
  }
  
  // FREE_TRIAL or STARTER_PACK
  // First use up free credits, then topups
  const freeLifetimeCredits = FREE_LIFETIME_BASE + (state.hasAccount ? ACCOUNT_BONUS : 0);
  
  if (state.freeUsed < freeLifetimeCredits) {
    localStorage.setItem(KEYS.FREE_USED, String(state.freeUsed + 1));
    return true;
  }
  
  if (state.creditTopups > 0) {
    localStorage.setItem(KEYS.CREDIT_TOPUPS, String(state.creditTopups - 1));
    return true;
  }
  
  return false;
}

/**
 * Grant account bonus (+1 free audit)
 */
export function grantAccountBonus(): void {
  const hadAccount = localStorage.getItem(KEYS.HAS_ACCOUNT) === 'true';
  localStorage.setItem(KEYS.HAS_ACCOUNT, 'true');
  if (!hadAccount) {
    console.log('[Billing] Account bonus granted - user now has +1 free audit');
  } else {
    console.log('[Billing] Account bonus already granted (no change)');
  }
}

/**
 * Add credits from Starter Pack purchase
 */
export function addStarterPackCredits(): void {
  const current = parseInt(localStorage.getItem(KEYS.CREDIT_TOPUPS) || '0', 10);
  localStorage.setItem(KEYS.CREDIT_TOPUPS, String(current + STARTER_PACK_CREDITS));
}

/**
 * Activate PRO subscription
 */
export function activateProSubscription(): void {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  localStorage.setItem(KEYS.PLAN, 'PRO');
  localStorage.setItem(KEYS.PRO_MONTH, currentMonth);
  localStorage.setItem(KEYS.PRO_USED, '0');
}

/**
 * Activate UNLIMITED_PRO (hidden tier for agents)
 */
export function activateUnlimitedPro(): void {
  localStorage.setItem(KEYS.PLAN, 'UNLIMITED_PRO');
}

// ============================================
// STRIPE PLACEHOLDERS - Replace when ready
// ============================================

/**
 * Start Stripe checkout for PRO subscription ($49/month)
 * TODO: Replace with actual Stripe integration
 */
export async function startCheckoutPro(): Promise<{ success: boolean; url?: string; error?: string }> {
  console.log('[Billing] startCheckoutPro called - placeholder');
  // TODO: Wire to Stripe
  // return await stripeService.createCheckoutSession('PRO', email);
  return { success: false, error: 'Stripe not yet connected' };
}

/**
 * Start Stripe checkout for Starter Pack (one-time $X)
 * TODO: Replace with actual Stripe integration
 */
export async function startCheckoutStarter(): Promise<{ success: boolean; url?: string; error?: string }> {
  console.log('[Billing] startCheckoutStarter called - placeholder');
  // TODO: Wire to Stripe
  // return await stripeService.createCheckoutSession('STARTER_PACK', email);
  return { success: false, error: 'Stripe not yet connected' };
}

// ============================================
// DEV HELPERS
// ============================================

/**
 * Reset all credit-related localStorage (dev only)
 */
export function resetCredits(): void {
  localStorage.removeItem(KEYS.FREE_USED);
  localStorage.removeItem(KEYS.HAS_ACCOUNT);
  localStorage.removeItem(KEYS.CREDIT_TOPUPS);
  localStorage.removeItem(KEYS.PLAN);
  localStorage.removeItem(KEYS.PRO_MONTH);
  localStorage.removeItem(KEYS.PRO_USED);
  console.log('[Billing] All credits reset');
}

// Expose dev helper to window for testing
if (typeof window !== 'undefined') {
  (window as any).__resetCredits = resetCredits;
  (window as any).__getCreditState = getCreditState;
  (window as any).__getRemainingCredits = () => getRemainingCredits(getCreditState());
  (window as any).__simulateStarterPurchase = () => {
    addStarterPackCredits();
    console.log('[Billing] Simulated Starter Pack purchase - added 3 credits');
  };
  (window as any).__simulateProSubscription = () => {
    activateProSubscription();
    console.log('[Billing] Simulated PRO subscription activation');
  };
}

export const billingService = {
  getCreditState,
  getRemainingCredits,
  canAudit,
  consumeCredit,
  grantAccountBonus,
  addStarterPackCredits,
  activateProSubscription,
  activateUnlimitedPro,
  startCheckoutPro,
  startCheckoutStarter,
  resetCredits,
};

