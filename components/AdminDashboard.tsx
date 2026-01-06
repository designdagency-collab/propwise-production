import { useState, useEffect } from 'react';
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

interface AdminDashboardProps {
  onClose: () => void;
  onVerifyPhone?: () => void;
}

export const AdminDashboard = ({ onClose, onVerifyPhone }: AdminDashboardProps) => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresPhoneVerification, setRequiresPhoneVerification] = useState(false);
  const [activeTab, setActiveTab] = useState<'metrics' | 'users'>('metrics');
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [saving, setSaving] = useState(false);

  // Fetch metrics
  const fetchMetrics = async () => {
    try {
      const response = await supabaseService.authenticatedFetch('/api/admin/metrics');
      const data = await response.json();
      
      // Check for phone verification requirement (can come as 200 or 403)
      if (data.requiresPhoneVerification) {
        setRequiresPhoneVerification(true);
        setError('Phone verification required');
        return;
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch metrics');
      }
      
      setMetrics(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Search users
  const searchUsers = async (query: string = '') => {
    try {
      const url = query 
        ? `/api/admin/users?search=${encodeURIComponent(query)}&limit=50`
        : '/api/admin/users?limit=50';
      const response = await supabaseService.authenticatedFetch(url);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to search users');
      }
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

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
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update user');
      }
      const data = await response.json();
      // Update local state
      setUsers(users.map(u => u.id === selectedUser.id ? data.user : u));
      setSelectedUser(data.user);
      setEditForm({});
      alert('User updated successfully!');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchMetrics(), searchUsers()]);
      setLoading(false);
    };
    load();
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
    searchUsers(searchQuery);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <i className="fa-solid fa-spinner fa-spin text-2xl text-[#C9A961]"></i>
          <p className="mt-2 text-sm">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          {requiresPhoneVerification ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
                <i className="fa-solid fa-shield-halved text-2xl text-purple-600"></i>
              </div>
              <h3 className="text-xl font-bold text-[#3A342D] mb-2">Admin Verification Required</h3>
              <p className="text-sm text-gray-600 mb-6">
                For security, admin access requires phone verification. Please verify your phone number to continue.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={onClose} 
                  className="flex-1 px-4 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    onClose();
                    onVerifyPhone?.();
                  }}
                  className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-colors"
                >
                  <i className="fa-solid fa-phone mr-2"></i>
                  Verify Phone
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-red-500 font-bold">Access Denied</p>
              <p className="text-sm mt-2">{error}</p>
              <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-200 rounded-lg">Close</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-[#FAF9F6]">
          <div>
            <h2 className="text-xl font-bold text-[#3A342D]">Admin Dashboard</h2>
            <p className="text-xs text-gray-500">Last updated: {metrics?.generatedAt ? new Date(metrics.generatedAt).toLocaleString() : 'N/A'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-2 border-b flex gap-4">
          <button
            onClick={() => setActiveTab('metrics')}
            className={`px-4 py-2 text-sm font-bold rounded-lg ${activeTab === 'metrics' ? 'bg-[#C9A961] text-white' : 'bg-gray-100'}`}
          >
            <i className="fa-solid fa-chart-line mr-2"></i>Metrics
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 text-sm font-bold rounded-lg ${activeTab === 'users' ? 'bg-[#C9A961] text-white' : 'bg-gray-100'}`}
          >
            <i className="fa-solid fa-users mr-2"></i>Users
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'metrics' && metrics && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard title="Total Users" value={metrics.users.total} icon="fa-users" />
                <MetricCard title="Verified Users" value={metrics.users.verified} icon="fa-user-check" color="text-emerald-600" />
                <MetricCard title="Total Searches" value={metrics.searches.total} icon="fa-search" />
                <MetricCard title="Searches Today" value={metrics.searches.today} icon="fa-bolt" color="text-amber-600" />
              </div>

              {/* Growth */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-3">Growth</h3>
                <div className="grid grid-cols-3 gap-4">
                  <MetricCard title="New Today" value={metrics.users.newToday} icon="fa-user-plus" color="text-blue-600" />
                  <MetricCard title="New This Week" value={metrics.users.newWeek} icon="fa-calendar-week" />
                  <MetricCard title="New This Month" value={metrics.users.newMonth} icon="fa-calendar" />
                </div>
              </div>

              {/* Activity */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-3">Activity</h3>
                <div className="grid grid-cols-3 gap-4">
                  <MetricCard title="Active Today" value={metrics.users.activeToday} icon="fa-circle" color="text-green-500" />
                  <MetricCard title="Active (7d)" value={metrics.users.active7d} icon="fa-clock" />
                  <MetricCard title="Active (30d)" value={metrics.users.active30d} icon="fa-calendar-check" />
                </div>
              </div>

              {/* Plans */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-3">By Plan</h3>
                <div className="grid grid-cols-4 gap-4">
                  <MetricCard title="Free Trial" value={metrics.users.byPlan.FREE_TRIAL || 0} icon="fa-gift" />
                  <MetricCard title="Starter Pack" value={metrics.users.byPlan.STARTER_PACK || 0} icon="fa-box" color="text-amber-600" />
                  <MetricCard title="PRO" value={metrics.users.byPlan.PRO || 0} icon="fa-crown" color="text-purple-600" />
                  <MetricCard title="Zero Credits" value={metrics.users.atZeroCredits} icon="fa-battery-empty" color="text-red-500" />
                </div>
              </div>

              {/* Referrals */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-3">Referrals</h3>
                <div className="grid grid-cols-4 gap-4">
                  <MetricCard title="Total" value={metrics.referrals.total} icon="fa-user-group" />
                  <MetricCard title="Pending" value={metrics.referrals.pending} icon="fa-hourglass" color="text-amber-500" />
                  <MetricCard title="Verified" value={metrics.referrals.verified} icon="fa-check" color="text-blue-500" />
                  <MetricCard title="Credited" value={metrics.referrals.credited} icon="fa-coins" color="text-emerald-500" />
                </div>
              </div>

              {/* Other */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-3">Other</h3>
                <div className="grid grid-cols-1 gap-4">
                  <MetricCard title="Credits in System" value={metrics.credits.totalInSystem} icon="fa-coins" color="text-amber-600" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="flex gap-6">
              {/* User List */}
              <div className="flex-1">
                <form onSubmit={handleSearch} className="mb-4 flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by email, name, or phone..."
                    className="flex-1 px-4 py-2 border rounded-lg text-sm"
                  />
                  <button type="submit" className="px-4 py-2 bg-[#C9A961] text-white rounded-lg text-sm font-bold">
                    <i className="fa-solid fa-search mr-2"></i>Search
                  </button>
                </form>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-bold">User</th>
                        <th className="px-4 py-2 text-left font-bold">Plan</th>
                        <th className="px-4 py-2 text-left font-bold">Credits</th>
                        <th className="px-4 py-2 text-left font-bold">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr 
                          key={user.id} 
                          onClick={() => setSelectedUser(user)}
                          className={`border-t cursor-pointer hover:bg-gray-50 ${selectedUser?.id === user.id ? 'bg-amber-50' : ''}`}
                        >
                          <td className="px-4 py-2">
                            <div className="font-medium">{user.full_name || 'No name'}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </td>
                          <td className="px-4 py-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              user.plan_type === 'PRO' ? 'bg-purple-100 text-purple-700' :
                              user.plan_type === 'STARTER_PACK' ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {user.plan_type}
                            </span>
                          </td>
                          <td className="px-4 py-2">{user.credit_topups}</td>
                          <td className="px-4 py-2 text-xs text-gray-500">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* User Edit Panel */}
              {selectedUser && (
                <div className="w-80 border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-bold mb-4">Edit User</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold uppercase text-gray-500">Email</label>
                      <input
                        type="email"
                        value={editForm.email || ''}
                        onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-gray-500">Full Name</label>
                      <input
                        type="text"
                        value={editForm.full_name || ''}
                        onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-gray-500">Phone</label>
                      <input
                        type="text"
                        value={editForm.phone || ''}
                        onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-gray-500">Plan Type</label>
                      <select
                        value={editForm.plan_type || ''}
                        onChange={(e) => setEditForm({...editForm, plan_type: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      >
                        <option value="FREE_TRIAL">Free Trial</option>
                        <option value="STARTER_PACK">Starter Pack</option>
                        <option value="PRO">PRO</option>
                        <option value="UNLIMITED_PRO">Unlimited PRO</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-gray-500">Credits</label>
                      <input
                        type="number"
                        value={editForm.credit_topups ?? 0}
                        onChange={(e) => setEditForm({...editForm, credit_topups: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="phone_verified"
                        checked={editForm.phone_verified || false}
                        onChange={(e) => setEditForm({...editForm, phone_verified: e.target.checked})}
                      />
                      <label htmlFor="phone_verified" className="text-sm">Phone Verified</label>
                    </div>
                    <button
                      onClick={updateUser}
                      disabled={saving}
                      className="w-full py-2 bg-[#C9A961] text-white rounded-lg text-sm font-bold disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>

                    <div className="pt-3 border-t text-xs text-gray-500">
                      <p>ID: {selectedUser.id}</p>
                      <p>Searches: {selectedUser.search_count}</p>
                      <p>Referrals: {selectedUser.referral_count || 0}</p>
                      <p>Joined: {new Date(selectedUser.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Metric Card Component
const MetricCard = ({ title, value, icon, color = 'text-[#3A342D]' }: { title: string; value: number; icon: string; color?: string }) => (
  <div className="bg-white border rounded-xl p-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{title}</span>
      <i className={`fa-solid ${icon} ${color}`}></i>
    </div>
    <p className={`text-2xl font-black ${color}`}>{value.toLocaleString()}</p>
  </div>
);

