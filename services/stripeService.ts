
import { PlanType } from "../types";

export class StripeService {
  private static IS_DEV = false; // Enable real Stripe integration
  private static API_BASE = '/api'; 

  /**
   * Initiates the checkout process.
   * In a real environment, this calls your Node.js backend to get a Stripe Session URL.
   */
  async createCheckoutSession(plan: PlanType, email?: string): Promise<{ url?: string; success: boolean }> {
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

      if (!response.ok) throw new Error('Payment gateway error');
      
      const data = await response.json();
      return { url: data.url, success: true };
    } catch (error) {
      console.error("Stripe Integration Error:", error);
      return { success: false };
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
