import { PlanType } from "../types";

export class StripeService {
  private static API_BASE = 'http://localhost:3002/api';

  async createCheckoutSession(plan: PlanType, email?: string): Promise<{ url?: string; success: boolean; error?: string }> {
    try {
      const response = await fetch(`${StripeService.API_BASE}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, email })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Payment gateway error');
      }
      
      const data = await response.json();
      return { url: data.url, success: true };
    } catch (error: any) {
      console.error("Stripe Integration Error:", error);
      return { success: false, error: error.message };
    }
  }

  async verifySession(sessionId: string): Promise<{ success: boolean; plan?: PlanType; error?: string }> {
    try {
      const response = await fetch(`${StripeService.API_BASE}/verify-session?session_id=${sessionId}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Session verification failed');
      }
      
      const data = await response.json();
      return { 
        success: data.success, 
        plan: data.plan as PlanType 
      };
    } catch (error: any) {
      console.error("Session verification error:", error);
      return { success: false, error: error.message };
    }
  }

  async getSubscriptionStatus(customerId: string): Promise<{ plan: PlanType; active: boolean } | null> {
    try {
      const response = await fetch(`${StripeService.API_BASE}/subscription-status?customer_id=${customerId}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error("Subscription Status Error:", error);
      return null;
    }
  }
}

export const stripeService = new StripeService();