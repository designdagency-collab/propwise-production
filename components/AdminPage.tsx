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
  generatedAt: string;
}

interface Revenue {
  totalRevenue: number;
  revenueThisMonth: number;
  revenueToday: number;
  mrr: number;
  avgOrderValue: number;
  transactionCount: number;
  transactionsThisMonth: number;
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
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [saving, setSaving] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [metricsRes, revenueRes, usersRes] = await Promise.all([
        supabaseService.authenticatedFetch('/api/admin/metrics'),
        supabaseService.authenticatedFetch('/api/admin/revenue'),
        supabaseService.authenticatedFetch('/api/admin/users?limit=50')
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

      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
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

  // Client-side filtered users for instant feedback
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    
    const query = searchQuery.toLowerCase().trim();
    return users.filter(user => 
      user.email?.toLowerCase().includes(query) ||
      user.full_name?.toLowerCase().includes(query) ||
      user.phone?.includes(query) ||
      user.plan_type?.toLowerCase().includes(query)
    );
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

  useEffect(() => {
    fetchData();
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
              <p className="text-xs text-gray-500">
                Last updated: {metrics?.generatedAt ? new Date(metrics.generatedAt).toLocaleString() : 'N/A'}
              </p>
            </div>
          </div>
          <button 
            onClick={fetchData}
            className="px-4 py-2 bg-[#C9A961] text-white rounded-lg text-sm font-bold hover:bg-[#3A342D] transition-colors"
          >
            <i className="fa-solid fa-refresh mr-2"></i>
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
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
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && metrics && (
          <div className="space-y-8">
            {/* Key Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard 
                title="Total Users" 
                value={metrics.users.total} 
                icon="fa-users" 
                color="text-blue-600"
                bgColor="bg-blue-50"
              />
              <MetricCard 
                title="Total Searches" 
                value={metrics.searches.total} 
                icon="fa-search" 
                color="text-purple-600"
                bgColor="bg-purple-50"
              />
              <MetricCard 
                title="MRR" 
                value={formatCurrency(revenue?.mrr || 0)} 
                icon="fa-chart-line" 
                color="text-emerald-600"
                bgColor="bg-emerald-50"
                isString
              />
              <MetricCard 
                title="Total Revenue" 
                value={formatCurrency(revenue?.totalRevenue || 0)} 
                icon="fa-coins" 
                color="text-amber-600"
                bgColor="bg-amber-50"
                isString
              />
            </div>

            {/* Growth & Activity */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                  <i className="fa-solid fa-user-plus mr-2 text-blue-500"></i>
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
                  <i className="fa-solid fa-bolt mr-2 text-amber-500"></i>
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

            {/* Plans & Referrals */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                  <i className="fa-solid fa-layer-group mr-2 text-purple-500"></i>
                  Users by Plan
                </h3>
                <div className="space-y-3">
                  <PlanBar label="Free Trial" count={metrics.users.byPlan.FREE_TRIAL || 0} total={metrics.users.total} color="bg-gray-400" />
                  <PlanBar label="Starter Pack" count={metrics.users.byPlan.STARTER_PACK || 0} total={metrics.users.total} color="bg-amber-500" />
                  <PlanBar label="PRO" count={metrics.users.byPlan.PRO || 0} total={metrics.users.total} color="bg-purple-500" />
                </div>
                <div className="mt-4 pt-4 border-t flex justify-between text-sm">
                  <span className="text-gray-500">Users at 0 credits:</span>
                  <span className="font-bold text-red-500">{metrics.users.atZeroCredits}</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                  <i className="fa-solid fa-user-group mr-2 text-emerald-500"></i>
                  Referrals
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-black text-[#3A342D]">{metrics.referrals.total}</p>
                    <p className="text-xs text-gray-500 mt-1">Total</p>
                  </div>
                  <div className="text-center p-4 bg-emerald-50 rounded-xl">
                    <p className="text-2xl font-black text-emerald-600">{metrics.referrals.credited}</p>
                    <p className="text-xs text-gray-500 mt-1">Credited</p>
                  </div>
                  <div className="text-center p-4 bg-amber-50 rounded-xl">
                    <p className="text-2xl font-black text-amber-600">{metrics.referrals.pending}</p>
                    <p className="text-xs text-gray-500 mt-1">Pending</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-black text-[#3A342D]">{metrics.credits.totalInSystem}</p>
                    <p className="text-xs text-gray-500 mt-1">Credits in System</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Revenue Tab */}
        {activeTab === 'revenue' && (
          <div className="space-y-8">
            {revenue ? (
              <>
                {/* Revenue Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard 
                    title="Total Revenue" 
                    value={formatCurrency(revenue.totalRevenue)} 
                    icon="fa-sack-dollar" 
                    color="text-emerald-600"
                    bgColor="bg-emerald-50"
                    isString
                  />
                  <MetricCard 
                    title="This Month" 
                    value={formatCurrency(revenue.revenueThisMonth)} 
                    icon="fa-calendar" 
                    color="text-blue-600"
                    bgColor="bg-blue-50"
                    isString
                  />
                  <MetricCard 
                    title="Today" 
                    value={formatCurrency(revenue.revenueToday)} 
                    icon="fa-sun" 
                    color="text-amber-600"
                    bgColor="bg-amber-50"
                    isString
                  />
                  <MetricCard 
                    title="MRR" 
                    value={formatCurrency(revenue.mrr)} 
                    icon="fa-chart-line" 
                    color="text-purple-600"
                    bgColor="bg-purple-50"
                    isString
                  />
                </div>

                {/* More Revenue Stats */}
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                      <i className="fa-solid fa-wallet mr-2 text-emerald-500"></i>
                      Stripe Balance
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Available</span>
                        <span className="text-xl font-bold text-emerald-600">{formatCurrency(revenue.availableBalance)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Pending</span>
                        <span className="text-xl font-bold text-amber-600">{formatCurrency(revenue.pendingBalance)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                      <i className="fa-solid fa-receipt mr-2 text-blue-500"></i>
                      Transactions
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total</span>
                        <span className="text-xl font-bold">{revenue.transactionCount}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">This Month</span>
                        <span className="text-xl font-bold text-blue-600">{revenue.transactionsThisMonth}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Avg Order</span>
                        <span className="text-xl font-bold">{formatCurrency(revenue.avgOrderValue)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                      <i className="fa-solid fa-box mr-2 text-purple-500"></i>
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
                        <span className="text-xl font-bold text-purple-600">{revenue.activeSubscriptions}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                  <div className="px-6 py-4 border-b flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500">
                      <i className="fa-solid fa-clock-rotate-left mr-2"></i>
                      Recent Transactions
                    </h3>
                    <span className="text-xs text-gray-400">{revenue.recentTransactions.length} transactions</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-6 py-3 text-left font-bold text-gray-500">Date</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-500">Description</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-500">Customer</th>
                          <th className="px-6 py-3 text-right font-bold text-gray-500">Amount</th>
                        </tr>
                      </thead>
                    </table>
                    <div className="max-h-[400px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <tbody>
                          {revenue.recentTransactions.slice(0, 10).map((tx) => (
                            <tr key={tx.id} className="border-t hover:bg-gray-50">
                              <td className="px-6 py-4 text-gray-600">
                                {new Date(tx.created).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4">{tx.description}</td>
                              <td className="px-6 py-4 text-gray-600">{tx.customerEmail}</td>
                              <td className="px-6 py-4 text-right font-bold text-emerald-600">
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
            {/* User List */}
            <div className="flex-1">
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
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
                      <span className="text-amber-600">No matches found</span>
                    )}
                  </div>
                </div>

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
                        // Calculate estimated LTV based on credits purchased
                        // Starter Pack = $19 (3 credits), Bulk Pack = $89 (20 credits)
                        // Estimate: credits * ~$6.33 avg per credit (blended rate)
                        const estimatedLTV = calculateLTV(user);
                        
                        return (
                          <tr 
                            key={user.id} 
                            onClick={() => setSelectedUser(user)}
                            className={`border-t cursor-pointer hover:bg-gray-50 transition-colors ${selectedUser?.id === user.id ? 'bg-amber-50' : ''}`}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-[#3A342D]">{user.full_name || 'No name'}</div>
                              <div className="text-xs text-gray-500">{user.email}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                user.plan_type === 'PRO' ? 'bg-purple-100 text-purple-700' :
                                user.plan_type === 'UNLIMITED_PRO' ? 'bg-purple-100 text-purple-700' :
                                user.plan_type === 'STARTER_PACK' ? 'bg-amber-100 text-amber-700' :
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
                                <span className="text-emerald-600 font-medium">{user.referral_count}</span>
                              ) : (
                                <span className="text-gray-400">0</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {estimatedLTV > 0 ? (
                                <span className="text-emerald-600 font-medium">{formatCurrency(estimatedLTV)}</span>
                              ) : (
                                <span className="text-gray-400">$0</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                {user.phone_verified ? (
                                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="Phone verified"></span>
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

            {/* User Edit Panel */}
            {selectedUser && (
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

