import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Vite environment variables
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export class SupabaseService {
  public supabase: SupabaseClient;
  
  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
  }
  // Send OTP to phone number
  async sendOTP(phone: string): Promise<{ error?: any }> {
    const { error } = await this.supabase.auth.signInWithOtp({
      phone: phone,
      options: { channel: 'sms' }
    });
    return { error };
  }

  // Verify OTP code
  async verifyOTP(phone: string, token: string): Promise<{ 
    user: any; 
    session: any; 
    error?: any 
  }> {
    const { data, error } = await this.supabase.auth.verifyOtp({
      phone: phone,
      token: token,
      type: 'sms'
    });
    return { user: data?.user, session: data?.session, error };
  }

  // Get current user profile (optional - doesn't break if fails)
  async getCurrentProfile(): Promise<any | null> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) return null;

      const { data } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      return data;
    } catch {
      return null; // Fail silently - fallback to localStorage
    }
  }

  // Get user search count from Supabase (optional enhancement)
  async getUserSearchCount(userId: string): Promise<number | null> {
    try {
      const { data } = await this.supabase
        .from('profiles')
        .select('search_count')
        .eq('id', userId)
        .single();

      return data?.search_count || null;
    } catch {
      return null; // Fail silently
    }
  }

  // Increment search count in Supabase (optional enhancement)
  async incrementSearchCountInDB(userId: string, address: string): Promise<void> {
    try {
      const profile = await this.getCurrentProfile();
      const currentCount = profile?.search_count || 0;

      await this.supabase
        .from('profiles')
        .update({ search_count: currentCount + 1 })
        .eq('id', userId);

      await this.supabase
        .from('search_history')
        .insert({ user_id: userId, address });
    } catch (error) {
      // Fail silently - localStorage is the fallback
      console.log('Supabase update failed, using localStorage fallback');
    }
  }

  // Update subscription (for Stripe webhook)
  async updateSubscription(
    userId: string,
    planType: 'FREE' | 'BUYER_PACK' | 'MONITOR',
    stripeCustomerId?: string,
    stripeSubscriptionId?: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('subscriptions')
        .update({ status: 'inactive' })
        .eq('user_id', userId)
        .eq('status', 'active');

      await this.supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          plan_type: planType,
          status: 'active',
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId
        });
    } catch (error) {
      console.error('Subscription update error:', error);
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
  }
}

export const supabaseService = new SupabaseService();

// Export supabase instance for direct access if needed
export const supabase = supabaseService.supabase;

