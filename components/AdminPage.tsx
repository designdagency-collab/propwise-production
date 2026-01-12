import React, { useState, useEffect, useMemo } from 'react';
import { supabaseService } from '../services/supabaseService';

interface Metrics {
  users: {
    total: number;
    verified: number;
    unverified: number;
    byPlan: Record<string, number>;
    activeToday: number;
    active7d: number;
    active30d: number;
    newToday: number;
    newWeek: number;
    newMonth: number;
    atZeroCredits: number;
  };
  searches: {
    total: number;
    today: number;
  };
  credits: {
    totalInSystem: number;
  };
  referrals: {
    total: number;
    pending: number;
    verified: number;
    credited: number;
  };
  invites: {
    sent: number;
    opened: number;
    converted: number;
    conversionRate: number;
  };
  generatedAt: string;
}

interface Revenue {
  totalRevenue: number;
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  revenueThisYear: number;
  mrr: number;
  avgOrderValue: number;
  transactionCount: number;
  transactionsToday: number;
  transactionsThisWeek: number;
  transactionsThisMonth: number;
  transactionsThisYear: number;
  productCounts: {
    starterPack: number;
    bulkPack: number;
    proSubscription: number;
  };
  availableBalance: number;
  pendingBalance: number;
  activeSubscriptions: number;
  recentTransactions: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    description: string;
    created: string;
    customerEmail: string;
  }[];
  generatedAt: string;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  phone_verified: boolean;
  plan_type: string;
  search_count: number;
  credit_topups: number;
  pro_used: number;
  pro_month: string;
  referral_code: string;
  referral_count: number;
  referral_credits_earned: number;
  created_at: string;
  updated_at: string;
}

interface AdminPageProps {
  onBack: () => void;
}

export const AdminPage = ({ onBack }: AdminPageProps) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'revenue'>('overview');
  const [timePeriod, setTimePeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [saving, setSaving] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // Admin invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Billing state
  const [billing, setBilling] = useState<{
    configured: boolean;
    currentMonth?: { estimated: number; actual?: number; searches: number; period: string };
    lastMonth?: { estimated: number; searches: number };
    allTime?: { estimated: number; searches: number };
    googleCloud?: { accountName: string; status: string; currentMonth?: number; currentBalance?: number } | null;
    projectedMonthly?: number;
    dailyAverage?: number;
    costPerSearch?: number;
    calibrationFactor?: number;
    note?: string;
    error?: string;
    message?: string;
  } | null>(null);

  // Visitors state (anonymous traffic)
  const [visitors, setVisitors] = useState<{
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    activeToday: number;
    anonymousSearches: number;
    registeredUsers: number;
    conversionRate: number;
  } | null>(null);

  // Fetch all data
  const fetchData = async (isAutoRefresh = false) => {
    // Only show full loading on initial load
    if (!isAutoRefresh) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    
    try {
      const [metricsRes, revenueRes, usersRes, billingRes, visitorsRes] = await Promise.all([
        supabaseService.authenticatedFetch('/api/admin/metrics'),
        supabaseService.authenticatedFetch('/api/admin/revenue'),
        supabaseService.authenticatedFetch('/api/admin/users?limit=50'),
        supabaseService.authenticatedFetch('/api/admin/billing'),
        supabaseService.authenticatedFetch('/api/admin/visitors')
      ]);

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      }

      if (revenueRes.ok) {
        const revenueData = await revenueRes.json();
        setRevenue(revenueData);
      } else {
        console.log('Revenue API not available or Stripe not configured');
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }

      if (billingRes.ok) {
        const billingData = await billingRes.json();
        setBilling(billingData);
      }

      if (visitorsRes.ok) {
        const visitorsData = await visitorsRes.json();
        setVisitors(visitorsData);
      }

      setLoading(false);
      setIsRefreshing(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Search users from server (debounced)
  const searchUsersFromServer = async (query: string = '') => {
    setIsSearching(true);
    try {
      const url = query 
        ? `/api/admin/users?search=${encodeURIComponent(query)}&limit=100`
        : '/api/admin/users?limit=100';
      const response = await supabaseService.authenticatedFetch(url);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (err: any) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search - triggers server search after 300ms of no typing
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout for server search
    searchTimeoutRef.current = setTimeout(() => {
      if (value.length >= 2 || value.length === 0) {
        searchUsersFromServer(value);
      }
    }, 300);
  };

  // Normalize phone number for searching (handle 0 vs +61)
  const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    // If starts with 61 (Australia), return just the local part
    if (digits.startsWith('61')) {
      return digits.substring(2);
    }
    // If starts with 0, remove it
    if (digits.startsWith('0')) {
      return digits.substring(1);
    }
    return digits;
  };

  // Client-side filtered users for instant feedback
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    
    const query = searchQuery.toLowerCase().trim();
    const queryDigits = normalizePhone(query);
    
    return users.filter(user => {
      // Standard text matching
      if (user.email?.toLowerCase().includes(query)) return true;
      if (user.full_name?.toLowerCase().includes(query)) return true;
      if (user.plan_type?.toLowerCase().includes(query)) return true;
      
      // Phone number matching - normalize both for comparison
      if (user.phone) {
        const userPhoneNormalized = normalizePhone(user.phone);
        // Check if the normalized query digits are in the normalized phone
        if (queryDigits && userPhoneNormalized.includes(queryDigits)) return true;
        // Also check raw phone in case they search exact format
        if (user.phone.includes(query)) return true;
      }
      
      return false;
    });
  }, [users, searchQuery]);

  // Update user
  const updateUser = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const response = await supabaseService.authenticatedFetch('/api/admin/users', {
        method: 'PATCH',
        body: JSON.stringify({
          userId: selectedUser.id,
          updates: editForm
        })
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(users.map(u => u.id === selectedUser.id ? data.user : u));
        setSelectedUser(data.user);
        setEditForm({});
        alert('User updated successfully!');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Initial fetch and auto-refresh every 30 seconds
  useEffect(() => {
    fetchData(false); // Initial load
    
    // Auto-refresh interval
    const refreshInterval = setInterval(() => {
      fetchData(true); // Auto-refresh
    }, 30000); // 30 seconds
    
    return () => clearInterval(refreshInterval);
  }, []);

  useEffect(() => {
    if (selectedUser) {
      setEditForm({
        email: selectedUser.email,
        full_name: selectedUser.full_name,
        phone: selectedUser.phone,
        phone_verified: selectedUser.phone_verified,
        plan_type: selectedUser.plan_type,
        credit_topups: selectedUser.credit_topups
      });
    }
  }, [selectedUser]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchUsersFromServer(searchQuery);
  };

  // Handle admin sending invite
  const handleAdminInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    
    setSendingInvite(true);
    setInviteResult(null);
    
    try {
      const response = await supabaseService.authenticatedFetch('/api/send-referral-invite', {
        method: 'POST',
        body: JSON.stringify({
          friendEmail: inviteEmail.trim(),
          friendName: inviteName.trim() || undefined
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setInviteResult({ success: true, message: `Invite sent to ${inviteEmail}!` });
        setInviteEmail('');
        setInviteName('');
        // Refresh metrics to update invite count
        fetchData(true);
      } else {
        setInviteResult({ success: false, message: data.error || 'Failed to send invite' });
      }
    } catch (error: any) {
      setInviteResult({ success: false, message: error.message || 'Something went wrong' });
    } finally {
      setSendingInvite(false);
    }
  };

  // Clear invite result after 4 seconds
  useEffect(() => {
    if (inviteResult) {
      const timer = setTimeout(() => setInviteResult(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [inviteResult]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  };

  // Calculate estimated LTV based on plan and credits purchased
  const calculateLTV = (user: User): number => {
    let ltv = 0;
    
    // Base value from plan upgrades
    if (user.plan_type === 'STARTER_PACK') {
      ltv += 19; // Starter pack purchase
    } else if (user.plan_type === 'PRO') {
      // Estimate PRO value - assume average 3 months subscription at $29/mo
      ltv += 87;
    } else if (user.plan_type === 'UNLIMITED_PRO') {
      ltv += 199;
    }
    
    // Additional value from credit topups beyond initial plan
    // Starter Pack gives 3 credits, so anything above that was purchased
    const extraCredits = Math.max(0, (user.credit_topups || 0) - 3);
    if (extraCredits > 0) {
      // Estimate: mix of $19/3 credits ($6.33) and $89/20 credits ($4.45)
      // Use blended rate of ~$5 per extra credit
      ltv += extraCredits * 5;
    }
    
    return Math.round(ltv);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#C9A961]/20 border-t-[#C9A961] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-lg">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <i className="fa-solid fa-exclamation-triangle text-2xl text-red-500"></i>
          </div>
          <p className="text-red-500 font-bold text-lg">Access Denied</p>
          <p className="text-sm text-gray-600 mt-2">{error}</p>
          <button onClick={onBack} className="mt-6 px-6 py-2 bg-gray-200 rounded-lg font-medium hover:bg-gray-300 transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <i className="fa-solid fa-arrow-left text-gray-600"></i>
            </button>
            <div>
              <h1 className="text-xl font-bold text-[#3A342D]">Admin Dashboard</h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500">
                  Last updated: {metrics?.generatedAt ? new Date(metrics.generatedAt).toLocaleString() : 'N/A'}
                </p>
                <span className="flex items-center gap-1 text-xs text-[#5D8A66]">
                  <span className="w-2 h-2 bg-[#5D8A66] rounded-full animate-pulse"></span>
                  Live
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => fetchData(false)}
            disabled={isRefreshing}
            className={`px-4 py-2 bg-[#C9A961] text-white rounded-lg text-sm font-bold transition-colors ${
              isRefreshing ? 'opacity-70 cursor-not-allowed' : 'hover:bg-[#3A342D]'
            }`}
          >
            <i className={`fa-solid fa-refresh mr-2 ${isRefreshing ? 'animate-spin' : ''}`}></i>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex gap-1">
            {[
              { id: 'overview', label: 'Overview', icon: 'fa-chart-pie' },
              { id: 'revenue', label: 'Revenue', icon: 'fa-dollar-sign' },
              { id: 'users', label: 'Users', icon: 'fa-users' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
                  activeTab === tab.id 
                    ? 'border-[#C9A961] text-[#C9A961]' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <i className={`fa-solid ${tab.icon} mr-2`}></i>
                {tab.label}
              </button>
            ))}
          </div>
          
          {/* Time Period Selector - show for Overview and Revenue */}
          {(activeTab === 'overview' || activeTab === 'revenue') && (
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              {[
                { id: 'day', label: 'Today' },
                { id: 'week', label: 'Week' },
                { id: 'month', label: 'Month' },
                { id: 'year', label: 'Year' }
              ].map(period => (
                <button
                  key={period.id}
                  onClick={() => setTimePeriod(period.id as any)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                    timePeriod === period.id 
                      ? 'bg-white text-[#3A342D] shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && metrics && (
          <div className="space-y-8">
            {/* Key Metrics Row - Dynamic based on time period */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard 
                title={timePeriod === 'day' ? "New Users Today" : 
                       timePeriod === 'week' ? "New Users (Week)" : 
                       timePeriod === 'year' ? "Total Users" : "New Users (Month)"} 
                value={timePeriod === 'day' ? metrics.users.newToday : 
                       timePeriod === 'week' ? metrics.users.newWeek : 
                       timePeriod === 'year' ? metrics.users.total : metrics.users.newMonth} 
                icon="fa-users" 
                color="text-[#C9A961]"
                bgColor="bg-[#C9A961]/10"
              />
              <MetricCard 
                title={timePeriod === 'day' ? "Searches Today" : 
                       timePeriod === 'week' ? "Active (7d)" : 
                       timePeriod === 'year' ? "Total Searches" : "Active (30d)"} 
                value={timePeriod === 'day' ? metrics.searches.today : 
                       timePeriod === 'week' ? metrics.users.active7d : 
                       timePeriod === 'year' ? metrics.searches.total : metrics.users.active30d} 
                icon="fa-search" 
                color="text-[#8B7355]"
                bgColor="bg-[#8B7355]/10"
              />
              <MetricCard 
                title={timePeriod === 'day' ? "Revenue Today" : 
                       timePeriod === 'week' ? "Revenue (Week)" : 
                       timePeriod === 'year' ? "Revenue (Year)" : "Revenue (Month)"} 
                value={formatCurrency(
                  timePeriod === 'day' ? (revenue?.revenueToday || 0) : 
                  timePeriod === 'week' ? (revenue?.revenueThisWeek || 0) : 
                  timePeriod === 'year' ? (revenue?.revenueThisYear || 0) : (revenue?.revenueThisMonth || 0)
                )} 
                icon="fa-chart-line" 
                color="text-[#5D8A66]"
                bgColor="bg-[#5D8A66]/10"
                isString
              />
              <MetricCard 
                title="Total Revenue" 
                value={formatCurrency(revenue?.totalRevenue || 0)} 
                icon="fa-coins" 
                color="text-[#C9A961]"
                bgColor="bg-[#C9A961]/10"
                isString
              />
            </div>

            {/* Growth & Activity */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                  <i className="fa-solid fa-user-plus mr-2 text-[#C9A961]"></i>
                  User Growth
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-black text-[#3A342D]">{metrics.users.newToday}</p>
                    <p className="text-xs text-gray-500 mt-1">Today</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-black text-[#3A342D]">{metrics.users.newWeek}</p>
                    <p className="text-xs text-gray-500 mt-1">This Week</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-black text-[#3A342D]">{metrics.users.newMonth}</p>
                    <p className="text-xs text-gray-500 mt-1">This Month</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                  <i className="fa-solid fa-bolt mr-2 text-[#C9A961]"></i>
                  Activity
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-black text-[#3A342D]">{metrics.searches.today}</p>
                    <p className="text-xs text-gray-500 mt-1">Searches Today</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-black text-[#3A342D]">{metrics.users.activeToday}</p>
                    <p className="text-xs text-gray-500 mt-1">Active Today</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-black text-[#3A342D]">{metrics.users.active7d}</p>
                    <p className="text-xs text-gray-500 mt-1">Active (7d)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Anonymous Visitors Section */}
            {visitors && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                  <i className="fa-solid fa-eye mr-2 text-purple-500"></i>
                  Anonymous Visitors
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-purple-50 rounded-xl">
                    <p className="text-2xl font-black text-purple-600">{visitors.total}</p>
                    <p className="text-xs text-gray-500 mt-1">Total Visitors</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-black text-[#3A342D]">{visitors.today}</p>
                    <p className="text-xs text-gray-500 mt-1">New Today</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-black text-[#3A342D]">{visitors.anonymousSearches}</p>
                    <p className="text-xs text-gray-500 mt-1">Anon Searches</p>
                  </div>
                  <div className="text-center p-4 bg-[#5D8A66]/10 rounded-xl">
                    <p className="text-2xl font-black text-[#5D8A66]">{visitors.conversionRate}%</p>
                    <p className="text-xs text-gray-500 mt-1">Conversion</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t flex justify-between text-sm">
                  <span className="text-gray-500">
                    <i className="fa-solid fa-clock mr-1"></i>
                    Active today: {visitors.activeToday}
                  </span>
                  <span className="text-gray-500">
                    <i className="fa-solid fa-calendar-week mr-1"></i>
                    This week: {visitors.thisWeek}
                  </span>
                  <span className="text-gray-500">
                    <i className="fa-solid fa-calendar mr-1"></i>
                    This month: {visitors.thisMonth}
                  </span>
                </div>
              </div>
            )}

            {/* Plans & Invites */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                  <i className="fa-solid fa-layer-group mr-2 text-[#8B7355]"></i>
                  Users by Plan
                </h3>
                <div className="space-y-3">
                  <PlanBar label="Free Trial" count={metrics.users.byPlan.FREE_TRIAL || 0} total={metrics.users.total} color="bg-gray-400" />
                  <PlanBar label="Starter Pack" count={metrics.users.byPlan.STARTER_PACK || 0} total={metrics.users.total} color="bg-[#C9A961]" />
                  <PlanBar label="PRO" count={metrics.users.byPlan.PRO || 0} total={metrics.users.total} color="bg-[#3A342D]" />
                </div>
                <div className="mt-4 pt-4 border-t flex justify-between text-sm">
                  <span className="text-gray-500">Users at 0 credits:</span>
                  <span className="font-bold text-red-500">{metrics.users.atZeroCredits}</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                  <i className="fa-solid fa-paper-plane mr-2 text-[#C9A961]"></i>
                  Invites
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-black text-[#3A342D]">{metrics.invites?.sent || 0}</p>
                    <p className="text-xs text-gray-500 mt-1">Total Sent</p>
                  </div>
                  <div className="text-center p-4 bg-[#5D8A66]/10 rounded-xl">
                    <p className="text-2xl font-black text-[#5D8A66]">{metrics.invites?.converted || 0}</p>
                    <p className="text-xs text-gray-500 mt-1">Converted</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t flex justify-between text-sm">
                  <span className="text-gray-500">Conversion Rate:</span>
                  <span className="font-bold text-[#C9A961]">{metrics.invites?.conversionRate || 0}%</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                  <i className="fa-solid fa-user-group mr-2 text-[#5D8A66]"></i>
                  Activity & Referrals
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-[#5D8A66]/10 rounded-xl">
                    <p className="text-2xl font-black text-[#5D8A66]">{metrics.users.active30d}</p>
                    <p className="text-xs text-gray-500 mt-1">Active Users (30d)</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-black text-[#3A342D]">{metrics.referrals.total}</p>
                    <p className="text-xs text-gray-500 mt-1">Total Referrals</p>
                  </div>
                  <div className="text-center p-4 bg-[#C9A961]/10 rounded-xl">
                    <p className="text-2xl font-black text-[#C9A961]">{metrics.referrals.credited}</p>
                    <p className="text-xs text-gray-500 mt-1">Referrals Credited</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-black text-[#3A342D]">{metrics.credits.totalInSystem}</p>
                    <p className="text-xs text-gray-500 mt-1">Credits in System</p>
                  </div>
                </div>
              </div>
            </div>

            {/* API Costs Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500">
                  <i className="fa-solid fa-server mr-2 text-red-500"></i>
                  API Costs (Gemini AI)
                </h3>
                {billing?.googleCloud && (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                    <i className="fa-solid fa-check-circle mr-1"></i>
                    {billing.googleCloud.accountName}
                  </span>
                )}
              </div>
              {billing ? (
                billing.configured ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-4 bg-red-50 rounded-xl">
                        <p className="text-2xl font-black text-red-600">
                          {formatCurrency(billing.currentMonth?.actual || billing.currentMonth?.estimated || 0)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          This Month {billing.currentMonth?.actual ? '' : '(est)'}
                        </p>
                        <p className="text-[10px] text-gray-400">{billing.currentMonth?.searches || 0} searches</p>
                      </div>
                      <div className="text-center p-4 bg-gray-50 rounded-xl">
                        <p className="text-2xl font-black text-[#3A342D]">
                          {formatCurrency(billing.lastMonth?.estimated || 0)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Last Month</p>
                        <p className="text-[10px] text-gray-400">{billing.lastMonth?.searches || 0} searches</p>
                      </div>
                      <div className="text-center p-4 bg-amber-50 rounded-xl">
                        <p className="text-2xl font-black text-amber-600">
                          {formatCurrency(billing.projectedMonthly || 0)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Projected Monthly</p>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-xl">
                        <p className="text-2xl font-black text-blue-600">
                          {formatCurrency(billing.allTime?.estimated || 0)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">All-Time Cost</p>
                        <p className="text-[10px] text-gray-400">{billing.allTime?.searches || 0} total searches</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t">
                      <span>
                        <i className="fa-solid fa-calculator mr-1"></i>
                        ${billing.costPerSearch?.toFixed(4) || '0.0085'}/search
                        {billing.calibrationFactor && billing.calibrationFactor !== 1 && (
                          <span className="ml-2 text-green-600">
                            (calibrated {billing.calibrationFactor}×)
                          </span>
                        )}
                      </span>
                      <span className="text-gray-400">{billing.note}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <i className="fa-solid fa-cloud text-3xl text-gray-300 mb-2"></i>
                    <p className="text-sm">{billing.message || 'Billing not configured'}</p>
                    <p className="text-xs text-gray-400 mt-1">Set up Google Cloud billing export for cost tracking</p>
                  </div>
                )
              ) : (
                <div className="text-center py-6">
                  <i className="fa-solid fa-spinner fa-spin text-gray-400"></i>
                </div>
              )}
              {billing?.error && (
                <p className="text-xs text-red-500 mt-2 text-center">{billing.error}</p>
              )}
            </div>
          </div>
        )}

        {/* Revenue Tab */}
        {activeTab === 'revenue' && (
          <div className="space-y-8">
            {revenue ? (
              <>
                {/* Revenue Cards - Dynamic based on time period */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard 
                    title="Total Revenue" 
                    value={formatCurrency(revenue.totalRevenue)} 
                    icon="fa-sack-dollar" 
                    color="text-[#5D8A66]"
                    bgColor="bg-[#5D8A66]/10"
                    isString
                  />
                  <MetricCard 
                    title={timePeriod === 'day' ? "Today's Revenue" : 
                           timePeriod === 'week' ? "This Week" : 
                           timePeriod === 'year' ? "This Year" : "This Month"} 
                    value={formatCurrency(
                      timePeriod === 'day' ? revenue.revenueToday :
                      timePeriod === 'week' ? revenue.revenueThisWeek :
                      timePeriod === 'year' ? revenue.revenueThisYear :
                      revenue.revenueThisMonth
                    )} 
                    icon={timePeriod === 'day' ? "fa-sun" : 
                          timePeriod === 'week' ? "fa-calendar-week" : 
                          timePeriod === 'year' ? "fa-calendar" : "fa-calendar-days"} 
                    color="text-[#C9A961]"
                    bgColor="bg-[#C9A961]/10"
                    isString
                  />
                  <MetricCard 
                    title={timePeriod === 'day' ? "Transactions Today" : 
                           timePeriod === 'week' ? "Transactions (Week)" : 
                           timePeriod === 'year' ? "Transactions (Year)" : "Transactions (Month)"} 
                    value={
                      timePeriod === 'day' ? revenue.transactionsToday :
                      timePeriod === 'week' ? revenue.transactionsThisWeek :
                      timePeriod === 'year' ? revenue.transactionsThisYear :
                      revenue.transactionsThisMonth
                    } 
                    icon="fa-receipt" 
                    color="text-[#8B7355]"
                    bgColor="bg-[#8B7355]/10"
                  />
                  <MetricCard 
                    title="MRR" 
                    value={formatCurrency(revenue.mrr)} 
                    icon="fa-chart-line" 
                    color="text-[#C9A961]"
                    bgColor="bg-[#C9A961]/10"
                    isString
                  />
                </div>

                {/* More Revenue Stats */}
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                      <i className="fa-solid fa-wallet mr-2 text-[#5D8A66]"></i>
                      Stripe Balance
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Available</span>
                        <span className="text-xl font-bold text-[#5D8A66]">{formatCurrency(revenue.availableBalance)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Pending</span>
                        <span className="text-xl font-bold text-[#C9A961]">{formatCurrency(revenue.pendingBalance)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                      <i className="fa-solid fa-receipt mr-2 text-[#C9A961]"></i>
                      Transactions
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">All Time</span>
                        <span className="text-xl font-bold">{revenue.transactionCount}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Today</span>
                        <span className="text-xl font-bold text-[#C9A961]">{revenue.transactionsToday}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">This Week</span>
                        <span className="text-xl font-bold text-[#C9A961]">{revenue.transactionsThisWeek}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">This Month</span>
                        <span className="text-xl font-bold text-[#8B7355]">{revenue.transactionsThisMonth}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-gray-600">Avg Order</span>
                        <span className="text-xl font-bold">{formatCurrency(revenue.avgOrderValue)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                      <i className="fa-solid fa-box mr-2 text-[#8B7355]"></i>
                      Sales by Product
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Starter Pack</span>
                        <span className="text-xl font-bold">{revenue.productCounts.starterPack}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">20 Pack</span>
                        <span className="text-xl font-bold">{revenue.productCounts.bulkPack}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">PRO Subscriptions</span>
                        <span className="text-xl font-bold text-[#3A342D]">{revenue.activeSubscriptions}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div className="bg-white rounded-2xl shadow-sm border">
                  <div className="px-6 py-4 border-b flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500">
                      <i className="fa-solid fa-clock-rotate-left mr-2"></i>
                      Recent Transactions
                    </h3>
                    <span className="text-xs text-gray-400">{revenue.recentTransactions.length} transactions</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left font-bold text-gray-500">Date</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-500">Description</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-500">Customer</th>
                          <th className="px-6 py-3 text-right font-bold text-gray-500">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenue.recentTransactions.slice(0, 10).map((tx) => (
                          <tr key={tx.id} className="border-t hover:bg-gray-50">
                            <td className="px-6 py-4 text-gray-600">
                              {new Date(tx.created).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">{tx.description}</td>
                            <td className="px-6 py-4 text-gray-600">{tx.customerEmail}</td>
                            <td className="px-6 py-4 text-right font-bold text-[#5D8A66]">
                              {formatCurrency(tx.amount)}
                            </td>
                          </tr>
                        ))}
                        {revenue.recentTransactions.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                              No recent transactions
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm border">
                <i className="fa-solid fa-credit-card text-4xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">Revenue data not available</p>
                <p className="text-sm text-gray-400 mt-2">Make sure Stripe is configured</p>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="flex gap-6">
            {/* User List - Always visible */}
            <div className="flex-1">
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                {/* Search Header */}
                <div className="px-6 py-4 border-b">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search by email, name, phone, or plan..."
                        className="w-full px-4 py-2 pl-10 border rounded-lg text-sm focus:border-[#C9A961] outline-none"
                      />
                      <i className={`fa-solid ${isSearching ? 'fa-spinner fa-spin' : 'fa-search'} absolute left-3 top-1/2 -translate-y-1/2 text-gray-400`}></i>
                    </div>
                    {searchQuery && (
                      <button 
                        onClick={() => { setSearchQuery(''); searchUsersFromServer(''); }}
                        className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {filteredUsers.length === users.length 
                        ? `${users.length} users` 
                        : `${filteredUsers.length} of ${users.length} users`}
                    </span>
                    {searchQuery && filteredUsers.length === 0 && (
                      <span className="text-[#C9A961]">No matches found</span>
                    )}
                  </div>
                </div>

                {/* User Table - Always visible */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-gray-500">User</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500">Plan</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500">Credits</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500">Searches</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500">Referrals</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500">LTV</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500">Status</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => {
                        const estimatedLTV = calculateLTV(user);
                        
                        return (
                          <tr 
                            key={user.id} 
                            onClick={() => setSelectedUser(user)}
                            className={`border-t cursor-pointer hover:bg-gray-50 transition-colors ${selectedUser?.id === user.id ? 'bg-[#C9A961]/10' : ''}`}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-[#3A342D]">{user.full_name || 'No name'}</div>
                              <div className="text-xs text-gray-500">{user.email}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                user.plan_type === 'PRO' ? 'bg-[#3A342D]/10 text-[#3A342D]' :
                                user.plan_type === 'UNLIMITED_PRO' ? 'bg-[#3A342D]/10 text-[#3A342D]' :
                                user.plan_type === 'STARTER_PACK' ? 'bg-[#C9A961]/20 text-[#8B7355]' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {user.plan_type === 'FREE_TRIAL' ? 'Trial' : 
                                 user.plan_type === 'STARTER_PACK' ? 'Starter' :
                                 user.plan_type === 'UNLIMITED_PRO' ? 'Unlimited' :
                                 user.plan_type}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium">{user.credit_topups}</td>
                            <td className="px-4 py-3">{user.search_count}</td>
                            <td className="px-4 py-3">
                              {user.referral_count > 0 ? (
                                <span className="text-[#5D8A66] font-medium">{user.referral_count}</span>
                              ) : (
                                <span className="text-gray-400">0</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {estimatedLTV > 0 ? (
                                <span className="text-[#5D8A66] font-medium">{formatCurrency(estimatedLTV)}</span>
                              ) : (
                                <span className="text-gray-400">$0</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                {user.phone_verified ? (
                                  <span className="w-2 h-2 rounded-full bg-[#5D8A66]" title="Phone verified"></span>
                                ) : (
                                  <span className="w-2 h-2 rounded-full bg-gray-300" title="Not verified"></span>
                                )}
                                <span className="text-xs text-gray-500">
                                  {user.phone_verified ? 'Verified' : 'Unverified'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-sm">
                              {new Date(user.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                            {searchQuery ? 'No users match your search' : 'No users found'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Side Panel - Invite Panel (default) or Edit User Panel (when user selected) */}
            {selectedUser ? (
              <div className="w-80 bg-white rounded-2xl shadow-sm border p-6 h-fit sticky top-32">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-[#3A342D]">Edit User</h3>
                  <button 
                    onClick={() => setSelectedUser(null)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <i className="fa-solid fa-xmark text-gray-400"></i>
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-gray-500 block mb-1">Email</label>
                    <input
                      type="email"
                      value={editForm.email || ''}
                      onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:border-[#C9A961] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-gray-500 block mb-1">Full Name</label>
                    <input
                      type="text"
                      value={editForm.full_name || ''}
                      onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:border-[#C9A961] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-gray-500 block mb-1">Phone</label>
                    <input
                      type="text"
                      value={editForm.phone || ''}
                      onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:border-[#C9A961] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-gray-500 block mb-1">Plan Type</label>
                    <select
                      value={editForm.plan_type || ''}
                      onChange={(e) => setEditForm({...editForm, plan_type: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:border-[#C9A961] outline-none"
                    >
                      <option value="FREE_TRIAL">Free Trial</option>
                      <option value="STARTER_PACK">Starter Pack</option>
                      <option value="PRO">PRO</option>
                      <option value="UNLIMITED_PRO">Unlimited PRO</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-gray-500 block mb-1">Credits</label>
                    <input
                      type="number"
                      value={editForm.credit_topups ?? 0}
                      onChange={(e) => setEditForm({...editForm, credit_topups: parseInt(e.target.value) || 0})}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:border-[#C9A961] outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="phone_verified"
                      checked={editForm.phone_verified || false}
                      onChange={(e) => setEditForm({...editForm, phone_verified: e.target.checked})}
                      className="rounded"
                    />
                    <label htmlFor="phone_verified" className="text-sm text-gray-600">Phone Verified</label>
                  </div>

                  <button
                    onClick={updateUser}
                    disabled={saving}
                    className="w-full py-2.5 bg-[#C9A961] text-white rounded-lg text-sm font-bold hover:bg-[#3A342D] transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>

                  <div className="pt-4 border-t text-xs text-gray-500 space-y-1">
                    <p><span className="font-medium">ID:</span> {selectedUser.id.substring(0, 8)}...</p>
                    <p><span className="font-medium">Referrals:</span> {selectedUser.referral_count || 0}</p>
                    <p><span className="font-medium">Referral Code:</span> {selectedUser.referral_code || 'None'}</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Invite Panel - shown when no user is selected */
              <div className="w-80 bg-white rounded-2xl shadow-sm border p-6 h-fit sticky top-32">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#C9A961] flex items-center justify-center">
                    <i className="fa-solid fa-paper-plane text-white"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-[#3A342D]">Send Invite</h3>
                    <p className="text-xs text-gray-500">Invite new users</p>
                  </div>
                </div>
                
                {/* Invite Stats */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                  <div className="p-2.5 rounded-xl bg-[#C9A961]/10 text-center">
                    <p className="text-lg font-black text-[#3A342D]">{metrics?.invites?.sent || 0}</p>
                    <p className="text-[8px] font-bold uppercase tracking-widest text-gray-500">Sent</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#8B7355]/10 text-center">
                    <p className="text-lg font-black text-[#8B7355]">{metrics?.invites?.opened || 0}</p>
                    <p className="text-[8px] font-bold uppercase tracking-widest text-gray-500">Opened</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#5D8A66]/10 text-center">
                    <p className="text-lg font-black text-[#5D8A66]">{metrics?.invites?.converted || 0}</p>
                    <p className="text-[8px] font-bold uppercase tracking-widest text-gray-500">Converted</p>
                  </div>
                </div>

                {/* Email Invite Form */}
                <form onSubmit={handleAdminInvite} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold uppercase text-gray-500 block mb-1">Email *</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="friend@example.com"
                      required
                      disabled={sendingInvite}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:border-[#C9A961] outline-none disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-gray-500 block mb-1">Name</label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="John (optional)"
                      disabled={sendingInvite}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:border-[#C9A961] outline-none disabled:opacity-50"
                    />
                  </div>

                  {/* Send Result Message */}
                  {inviteResult && (
                    <div className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                      inviteResult.success 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      <i className={`fa-solid ${inviteResult.success ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
                      {inviteResult.message}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={sendingInvite || !inviteEmail.trim()}
                    className="w-full py-2.5 bg-[#C9A961] text-white rounded-lg text-sm font-bold hover:bg-[#3A342D] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingInvite ? (
                      <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Sending...</>
                    ) : (
                      <><i className="fa-solid fa-paper-plane mr-2"></i>Send Invite</>
                    )}
                  </button>
                </form>

                <div className="mt-4 pt-4 border-t">
                  <p className="text-[10px] text-gray-400 text-center">
                    <i className="fa-solid fa-info-circle mr-1"></i>
                    Click on a user to edit their details
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

// Metric Card Component
const MetricCard = ({ 
  title, 
  value, 
  icon, 
  color, 
  bgColor,
  isString = false 
}: { 
  title: string; 
  value: number | string; 
  icon: string; 
  color: string;
  bgColor: string;
  isString?: boolean;
}) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border">
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{title}</span>
      <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center`}>
        <i className={`fa-solid ${icon} ${color}`}></i>
      </div>
    </div>
    <p className={`text-2xl font-black ${color}`}>
      {isString ? value : (value as number).toLocaleString()}
    </p>
  </div>
);

// Plan Bar Component
const PlanBar = ({ label, count, total, color }: { label: string; count: number; total: number; color: string }) => {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-bold">{count}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
};

