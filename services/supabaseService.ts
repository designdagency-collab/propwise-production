import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Vite environment variables
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && supabaseAnonKey;

export class SupabaseService {
  public supabase: SupabaseClient | null = null;
  
  constructor() {
    if (isSupabaseConfigured) {
      this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      });
    } else {
      console.warn('Supabase not configured - phone verification will be unavailable');
    }
  }
  // Check if Supabase is available
  isConfigured(): boolean {
    return this.supabase !== null;
  }

  // Send OTP to phone number
  async sendOTP(phone: string): Promise<{ error?: any }> {
    if (!this.supabase) {
      return { error: { message: 'Supabase not configured' } };
    }
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
    if (!this.supabase) {
      return { user: null, session: null, error: { message: 'Supabase not configured' } };
    }
    const { data, error } = await this.supabase.auth.verifyOtp({
      phone: phone,
      token: token,
      type: 'sms'
    });
    return { user: data?.user, session: data?.session, error };
  }

  // Get current user profile (optional - doesn't break if fails)
  async getCurrentProfile(): Promise<any | null> {
    if (!this.supabase) return null;
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
    if (!this.supabase) return null;
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
    if (!this.supabase) return;
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

  // Get user's active subscription
  async getActiveSubscription(userId: string): Promise<{ plan_type: string; status: string } | null> {
    if (!this.supabase) return null;
    try {
      const { data } = await this.supabase
        .from('subscriptions')
        .select('plan_type, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      return data;
    } catch {
      return null;
    }
  }

  // Get current authenticated user
  async getCurrentUser(): Promise<any | null> {
    if (!this.supabase) return null;
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      return user;
    } catch {
      return null;
    }
  }

  // Update subscription (for Stripe webhook)
  async updateSubscription(
    userId: string,
    planType: 'FREE' | 'BUYER_PACK' | 'MONITOR',
    stripeCustomerId?: string,
    stripeSubscriptionId?: string
  ): Promise<void> {
    if (!this.supabase) return;
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
    if (!this.supabase) return;
    await this.supabase.auth.signOut();
  }
}

export const supabaseService = new SupabaseService();

// Export supabase instance for direct access if needed
export const supabase = supabaseService.supabase;

