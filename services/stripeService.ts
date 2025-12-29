
import { PlanType } from "../types";

export class StripeService {
  private static IS_DEV = false; // Enable real Stripe integration
  // Use relative path for API - works in both local dev and Vercel
  private static API_BASE = '/api'; 

  /**
   * Initiates the checkout process.
   * In a real environment, this calls your Node.js backend to get a Stripe Session URL.
   */
  async createCheckoutSession(plan: PlanType, email?: string): Promise<{ url?: string; success: boolean; error?: string }> {
    if (StripeService.IS_DEV) {
      // Simulate network latency for a premium feel
      await new Promise(resolve => setTimeout(resolve, 2200));
      return { success: true };
    }

    try {
      const response = await fetch(`${StripeService.API_BASE}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, email })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Stripe API error:', response.status, errorData);
        throw new Error(errorData.error || `Payment gateway error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.url) {
        console.error('Stripe API returned success but no URL:', data);
        return { success: false, error: 'No checkout URL returned from server' };
      }
      
      return { url: data.url, success: true };
    } catch (error: any) {
      console.error("Stripe Integration Error:", error);
      return { 
        success: false, 
        error: error.message || 'Failed to connect to payment gateway. Please check your connection.' 
      };
    }
  }

  // Add method to check subscription status
  async getSubscriptionStatus(): Promise<{ plan: PlanType; active: boolean } | null> {
    try {
      const response = await fetch(`${StripeService.API_BASE}/subscription-status`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error("Subscription Status Error:", error);
      return null;
    }
  }
}

export const stripeService = new StripeService();
