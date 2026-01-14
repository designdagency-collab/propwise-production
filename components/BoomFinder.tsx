import React, { useState, useEffect, useCallback } from 'react';
import { supabaseService } from '../services/supabaseService';

interface BoomSuburb {
  id: string;
  state: string;
  suburb_name: string;
  postcode: string;
  population: number;
  pop_growth_pct: number;
  persons_per_dwelling: number;
  building_approvals_12m: number;
  median_rent_weekly: number;
  median_mortgage_monthly: number;
  median_income_weekly: number;
  rent_to_income_pct: number;
  crowding_score: number;
  supply_constraint_score: number;
  rent_value_gap_score: number;
  boom_score: number;
  last_updated: string;
}

interface BoomFinderProps {
  onSelectSuburb?: (suburb: string, state: string) => void;
  isAdmin?: boolean;
  userEmail?: string;
}

const STATES = [
  { code: 'all', name: 'All States' },
  { code: 'NSW', name: 'New South Wales' },
  { code: 'VIC', name: 'Victoria' },
  { code: 'QLD', name: 'Queensland' },
  { code: 'SA', name: 'South Australia' },
  { code: 'WA', name: 'Western Australia' },
  { code: 'TAS', name: 'Tasmania' },
  { code: 'NT', name: 'Northern Territory' },
  { code: 'ACT', name: 'Australian Capital Territory' },
];

const ScoreBadge: React.FC<{ score: number; label?: string }> = ({ score, label }) => {
  let bgColor = 'bg-gray-100';
  let textColor = 'text-gray-700';
  
  if (score >= 75) {
    bgColor = 'bg-emerald-100';
    textColor = 'text-emerald-700';
  } else if (score >= 50) {
    bgColor = 'bg-amber-100';
    textColor = 'text-amber-700';
  } else if (score >= 25) {
    bgColor = 'bg-orange-100';
    textColor = 'text-orange-700';
  } else {
    bgColor = 'bg-red-100';
    textColor = 'text-red-700';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${bgColor} ${textColor}`}>
      {label && <span className="mr-1 text-xs opacity-70">{label}</span>}
      {score}
    </span>
  );
};

export const BoomFinder: React.FC<BoomFinderProps> = ({ onSelectSuburb, isAdmin, userEmail }) => {
  // Allow refresh for admin flag OR specific admin email
  const canRefresh = isAdmin || userEmail?.toLowerCase() === 'designd.agency@gmail.com';
  const [suburbs, setSuburbs] = useState<BoomSuburb[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('boom_score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [totalCount, setTotalCount] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSuburbs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        state: selectedState,
        search: searchQuery,
        sortBy,
        sortOrder,
        limit: '100'
      });

      const response = await fetch(`/api/boom-suburbs?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch suburbs');
      }

      const data = await response.json();
      setSuburbs(data.suburbs || []);
      setTotalCount(data.total || 0);
      setLastRefresh(data.lastRefresh);

    } catch (err) {
      console.error('[BoomFinder] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [selectedState, searchQuery, sortBy, sortOrder]);

  useEffect(() => {
    fetchSuburbs();
  }, [fetchSuburbs]);

  const handleRefreshData = async () => {
    if (refreshing) return;

    setRefreshing(true);
    try {
      const response = await supabaseService.authenticatedFetch('/api/admin/refresh-boom-data', {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to refresh');
      }

      // Refetch data after refresh
      await fetchSuburbs();
      
    } catch (err) {
      console.error('[BoomFinder] Refresh error:', err);
      alert('Failed to refresh data: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setRefreshing(false);
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const SortIcon: React.FC<{ column: string }> = ({ column }) => {
    if (sortBy !== column) return <i className="fa-solid fa-sort text-gray-300 ml-1"></i>;
    return sortOrder === 'asc' 
      ? <i className="fa-solid fa-sort-up text-amber-500 ml-1"></i>
      : <i className="fa-solid fa-sort-down text-amber-500 ml-1"></i>;
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <i className="fa-solid fa-chart-line text-amber-500"></i>
              Boom Finder
            </h1>
            <p className="text-gray-500 mt-1">
              Discover high-growth suburbs using ABS data
            </p>
          </div>
          
          {lastRefresh && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                Data updated: {new Date(lastRefresh).toLocaleDateString('en-AU', { 
                  day: 'numeric', 
                  month: 'short', 
                  year: 'numeric' 
                })}
              </span>
              {canRefresh && (
                <button
                  onClick={handleRefreshData}
                  disabled={refreshing}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2"
                >
                  <i className={`fa-solid fa-sync ${refreshing ? 'animate-spin' : ''}`}></i>
                  {refreshing ? 'Refreshing...' : 'Refresh Data'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <i className="fa-solid fa-info-circle text-blue-500 mt-0.5"></i>
            <div className="text-sm text-blue-800">
              <strong>About the Boom Score:</strong> This score combines population growth, housing supply constraints, 
              and rental yields using ABS Census and regional data. Higher scores indicate suburbs with stronger 
              growth fundamentals. Data is refreshed monthly.
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6" style={{ borderColor: 'var(--border-color)' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* State selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State / Territory
              </label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                style={{ borderColor: 'var(--border-color)' }}
              >
                {STATES.map(state => (
                  <option key={state.code} value={state.code}>
                    {state.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Suburb
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by suburb name..."
                  className="w-full px-4 py-3 pl-10 rounded-lg border focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  style={{ borderColor: 'var(--border-color)' }}
                />
                <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              </div>
            </div>

            {/* Results count */}
            <div className="flex items-end">
              <div className="w-full px-4 py-3 bg-gray-50 rounded-lg text-center">
                <span className="text-2xl font-bold text-amber-600">{totalCount}</span>
                <span className="text-gray-500 ml-2">suburbs found</span>
              </div>
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <i className="fa-solid fa-spinner animate-spin text-3xl text-amber-500"></i>
              <span className="ml-3 text-gray-500">Loading suburbs...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-red-500">
              <i className="fa-solid fa-exclamation-triangle text-3xl mb-2"></i>
              <p>{error}</p>
              <button 
                onClick={fetchSuburbs}
                className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
              >
                Try Again
              </button>
            </div>
          ) : suburbs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <i className="fa-solid fa-map-marker-alt text-4xl mb-3 opacity-30"></i>
              <p>No suburbs found. {canRefresh && 'Click "Refresh Data" to load ABS data.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Rank
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('suburb_name')}
                    >
                      Suburb <SortIcon column="suburb_name" />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      State
                    </th>
                    <th 
                      className="px-4 py-3 text-center text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('boom_score')}
                    >
                      Boom Score <SortIcon column="boom_score" />
                    </th>
                    <th 
                      className="px-4 py-3 text-center text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('crowding_score')}
                    >
                      Crowding <SortIcon column="crowding_score" />
                    </th>
                    <th 
                      className="px-4 py-3 text-center text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('supply_constraint_score')}
                    >
                      Supply Gap <SortIcon column="supply_constraint_score" />
                    </th>
                    <th 
                      className="px-4 py-3 text-center text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('rent_value_gap_score')}
                    >
                      Rent/Value <SortIcon column="rent_value_gap_score" />
                    </th>
                    <th 
                      className="px-4 py-3 text-right text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('median_rent_weekly')}
                    >
                      Median Rent <SortIcon column="median_rent_weekly" />
                    </th>
                    <th 
                      className="px-4 py-3 text-right text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('population')}
                    >
                      Population <SortIcon column="population" />
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                  {suburbs.map((suburb, index) => (
                    <tr 
                      key={suburb.id} 
                      className="hover:bg-amber-50 transition-colors"
                    >
                      <td className="px-4 py-4 text-sm text-gray-500">
                        #{index + 1}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900">{suburb.suburb_name}</div>
                        <div className="text-sm text-gray-500">{suburb.postcode}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {suburb.state}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <ScoreBadge score={suburb.boom_score} />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <ScoreBadge score={suburb.crowding_score} />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <ScoreBadge score={suburb.supply_constraint_score} />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <ScoreBadge score={suburb.rent_value_gap_score} />
                      </td>
                      <td className="px-4 py-4 text-right text-sm">
                        ${suburb.median_rent_weekly}/wk
                      </td>
                      <td className="px-4 py-4 text-right text-sm text-gray-600">
                        {suburb.population?.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => onSelectSuburb?.(suburb.suburb_name, suburb.state)}
                          className="px-3 py-1.5 text-sm bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
                        >
                          <i className="fa-solid fa-search mr-1"></i>
                          Explore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Score Legend</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-emerald-500"></span>
              <span>75-100: High growth potential</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-amber-500"></span>
              <span>50-74: Moderate growth</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-orange-500"></span>
              <span>25-49: Below average</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-red-500"></span>
              <span>0-24: Low growth indicators</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoomFinder;
