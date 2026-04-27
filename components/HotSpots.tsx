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
  median_house_price: number;
  median_rent_weekly: number;
  median_mortgage_monthly: number;
  median_income_weekly: number;
  rent_to_income_pct: number;
  gross_rental_yield: number;
  trades_workers: number;
  trades_pct_workforce: number;
  trades_growth_pct: number;
  crowding_score: number;
  supply_constraint_score: number;
  rent_value_gap_score: number;
  trades_influx_score: number;
  boom_score: number;
  last_updated: string;
}

interface HotSpotsProps {
  onSelectSuburb?: (suburb: string, state: string) => void;
  onBack?: () => void;
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

const ScoreBadge: React.FC<{ score: number | null | undefined }> = ({ score }) => {
  // null/undefined: render a neutral placeholder pill so the table doesn't
  // look broken when source data hasn't been populated for a row.
  if (score == null) {
    return (
      <span
        className="inline-flex items-center justify-center min-w-[40px] px-2.5 py-0.5 rounded-full text-xs font-bold border bg-[#F0EDE5] text-[#4A4137]/40 border-[#DCD7CE]"
        title="No data available"
      >
        —
      </span>
    );
  }

  let bg: string;
  let text: string;
  let border: string;

  if (score >= 75) {
    bg = 'bg-emerald-50';
    text = 'text-emerald-700';
    border = 'border-emerald-100';
  } else if (score >= 50) {
    bg = 'bg-[#C9A961]/10';
    text = 'text-[#B8985A]';
    border = 'border-[#C9A961]/20';
  } else if (score >= 25) {
    bg = 'bg-amber-50';
    text = 'text-amber-700';
    border = 'border-amber-100';
  } else {
    bg = 'bg-rose-50';
    text = 'text-rose-700';
    border = 'border-rose-100';
  }

  return (
    <span className={`inline-flex items-center justify-center min-w-[40px] px-2.5 py-0.5 rounded-full text-xs font-bold border ${bg} ${text} ${border}`}>
      {score}
    </span>
  );
};

export const HotSpots: React.FC<HotSpotsProps> = ({ onSelectSuburb, onBack, isAdmin, userEmail }) => {
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
  const [listingsType, setListingsType] = useState<'residential' | 'commercial'>('residential');

  const buildListingsUrl = (suburb: string, state: string): string => {
    if (listingsType === 'commercial') {
      // commercialrealestate.com.au — search-term endpoint is the most forgiving
      // across suburbs that don't fit the strict slug pattern
      return `https://www.commercialrealestate.com.au/for-sale/?searchTerm=${encodeURIComponent(`${suburb}, ${state}`)}`;
    }
    // realestate.com.au residential
    const slug = `${suburb.toLowerCase().trim().replace(/\s+/g, '-')}+${state.toLowerCase()}`;
    return `https://www.realestate.com.au/buy/in-${encodeURIComponent(slug)}/list-1`;
  };

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
      if (!response.ok) throw new Error('Failed to fetch suburbs');

      const data = await response.json();
      setSuburbs(data.suburbs || []);
      setTotalCount(data.total || 0);
      setLastRefresh(data.lastRefresh);
    } catch (err) {
      console.error('[HotSpots] Error:', err);
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
      await fetchSuburbs();
    } catch (err) {
      console.error('[HotSpots] Refresh error:', err);
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
    if (sortBy !== column) return <i className="fa-solid fa-sort text-[#4A4137]/20 ml-1"></i>;
    return sortOrder === 'asc'
      ? <i className="fa-solid fa-sort-up text-[#C9A961] ml-1"></i>
      : <i className="fa-solid fa-sort-down text-[#C9A961] ml-1"></i>;
  };

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-2">
          {onBack && (
            <button
              onClick={onBack}
              className="text-sm font-bold uppercase tracking-widest text-[#4A4137]/60 hover:text-[#C9A961] transition-colors"
            >
              <i className="fa-solid fa-arrow-left mr-2"></i>Back
            </button>
          )}
          {lastRefresh && (
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#4A4137]/50">
                Updated {new Date(lastRefresh).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              {canRefresh && (
                <button
                  onClick={handleRefreshData}
                  disabled={refreshing}
                  className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#3A342D] text-white hover:bg-[#C9A961] transition-colors disabled:opacity-60 flex items-center gap-2"
                >
                  <i className={`fa-solid fa-arrows-rotate ${refreshing ? 'animate-spin' : ''}`}></i>
                  {refreshing ? 'Refreshing' : 'Refresh'}
                </button>
              )}
            </div>
          )}
        </div>

        <span className="inline-block px-3 py-1 bg-[#C9A961]/10 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest mb-3">
          <i className="fa-solid fa-chart-line mr-2"></i>
          Suburb Intelligence
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#3A342D] mb-2">Hot Spots</h1>
        <p className="text-sm text-[#4A4137]/60 max-w-2xl mb-8">
          High-growth Australian suburbs ranked using ABS Census and regional data. The Heat Score
          combines population growth, supply constraints, rental yields, and trades influx into one
          composite signal.
        </p>

        {/* Filter card */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid #DCD7CE',
            boxShadow: '0 8px 24px -8px rgba(74, 65, 55, 0.06)',
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="boom-state-select" className="block text-[10px] font-black uppercase tracking-widest text-[#4A4137]/50 mb-2">
                State / Territory
              </label>
              <select
                id="boom-state-select"
                name="state"
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm font-medium text-[#3A342D] bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A961] transition"
                style={{ border: '1px solid #DCD7CE' }}
              >
                {STATES.map(state => (
                  <option key={state.code} value={state.code}>{state.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="boom-search-input" className="block text-[10px] font-black uppercase tracking-widest text-[#4A4137]/50 mb-2">
                Search Suburb
              </label>
              <div className="relative">
                <input
                  id="boom-search-input"
                  name="search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Suburb name…"
                  className="w-full px-4 py-3 pl-10 rounded-xl text-sm font-medium text-[#3A342D] bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A961] transition"
                  style={{ border: '1px solid #DCD7CE' }}
                />
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4A4137]/40 text-sm"></i>
              </div>
            </div>

            <div>
              <span className="block text-[10px] font-black uppercase tracking-widest text-[#4A4137]/50 mb-2">
                Listings Type
              </span>
              <div className="inline-flex w-full rounded-xl p-1" style={{ backgroundColor: '#F0EDE5', border: '1px solid #DCD7CE' }}>
                <button
                  type="button"
                  onClick={() => setListingsType('residential')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    listingsType === 'residential'
                      ? 'bg-white text-[#3A342D] shadow-sm'
                      : 'text-[#4A4137]/60 hover:text-[#3A342D]'
                  }`}
                >
                  <i className="fa-solid fa-house mr-1.5"></i>
                  Residential
                </button>
                <button
                  type="button"
                  onClick={() => setListingsType('commercial')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    listingsType === 'commercial'
                      ? 'bg-white text-[#3A342D] shadow-sm'
                      : 'text-[#4A4137]/60 hover:text-[#3A342D]'
                  }`}
                >
                  <i className="fa-solid fa-building mr-1.5"></i>
                  Commercial
                </button>
              </div>
            </div>

            <div className="flex flex-col justify-end">
              <span className="block text-[10px] font-black uppercase tracking-widest text-[#4A4137]/50 mb-2">
                Results
              </span>
              <div className="flex items-baseline gap-2 px-4 py-3 rounded-xl bg-[#C9A961]/5" style={{ border: '1px solid #DCD7CE' }}>
                <span className="text-2xl font-black text-[#C9A961]">{totalCount}</span>
                <span className="text-xs font-medium text-[#4A4137]/60">suburbs found</span>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid #DCD7CE',
            boxShadow: '0 8px 24px -8px rgba(74, 65, 55, 0.06)',
          }}
        >
          <div className="px-5 py-2.5 bg-[#FAF8F3] border-b text-[10px] font-bold uppercase tracking-widest text-[#4A4137]/50 flex items-center gap-2" style={{ borderColor: '#E8E6E3' }}>
            <i className="fa-solid fa-circle-info"></i>
            <span>Hover column headers for metric explanations</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <i className="fa-solid fa-spinner fa-spin text-2xl text-[#C9A961]"></i>
              <span className="ml-3 text-sm text-[#4A4137]/50">Loading suburbs…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20">
              <i className="fa-solid fa-circle-exclamation text-3xl text-rose-400 mb-3"></i>
              <p className="text-sm text-[#4A4137]/70 mb-4">{error}</p>
              <button
                onClick={fetchSuburbs}
                className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#3A342D] text-white hover:bg-[#C9A961] transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : suburbs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#4A4137]/40">
              <i className="fa-solid fa-location-dot text-3xl mb-3"></i>
              <p className="text-sm">No suburbs found.{canRefresh && ' Click "Refresh" to load ABS data.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#FAF8F3]" style={{ borderBottom: '1px solid #E8E6E3' }}>
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#4A4137]/60" title="Ranking position based on current sort order">
                      Rank
                    </th>
                    <th
                      className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#4A4137]/60 cursor-pointer hover:text-[#C9A961] transition-colors"
                      onClick={() => handleSort('suburb_name')}
                      title="Suburb or town name. Click to sort alphabetically."
                    >
                      Suburb <SortIcon column="suburb_name" />
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#4A4137]/60" title="Australian State or Territory">
                      State
                    </th>
                    <th
                      className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-[#4A4137]/60 cursor-pointer hover:text-[#C9A961] transition-colors"
                      onClick={() => handleSort('boom_score')}
                      title="Heat Score (0-100). Overall growth potential — combines crowding pressure, supply constraints, rental yields, and trades influx. Higher = stronger growth fundamentals."
                    >
                      Heat <SortIcon column="boom_score" />
                    </th>
                    <th
                      className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-[#4A4137]/60 cursor-pointer hover:text-[#C9A961] transition-colors"
                      onClick={() => handleSort('crowding_score')}
                      title="Crowding Pressure (0-100). Measures population density, growth rate, and persons per dwelling."
                    >
                      Crowding <SortIcon column="crowding_score" />
                    </th>
                    <th
                      className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-[#4A4137]/60 cursor-pointer hover:text-[#C9A961] transition-colors"
                      onClick={() => handleSort('supply_constraint_score')}
                      title="Development Activity (0-100). Higher = more homes being built, active growth area."
                    >
                      Develop. <SortIcon column="supply_constraint_score" />
                    </th>
                    <th
                      className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-[#4A4137]/60 cursor-pointer hover:text-[#C9A961] transition-colors"
                      onClick={() => handleSort('rent_value_gap_score')}
                      title="Rent/Value Gap (0-100). Higher = strong rents relative to property prices."
                    >
                      Rent/Val <SortIcon column="rent_value_gap_score" />
                    </th>
                    <th
                      className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-[#4A4137]/60 cursor-pointer hover:text-[#C9A961] transition-colors"
                      onClick={() => handleSort('trades_influx_score')}
                      title="Trades Influx (0-100). Higher = more tradies moving in. A leading indicator of price appreciation."
                    >
                      Trades <SortIcon column="trades_influx_score" />
                    </th>
                    <th
                      className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[#4A4137]/60 cursor-pointer hover:text-[#C9A961] transition-colors"
                      onClick={() => handleSort('median_house_price')}
                      title="Median house price in the suburb."
                    >
                      Median <SortIcon column="median_house_price" />
                    </th>
                    <th
                      className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[#4A4137]/60 cursor-pointer hover:text-[#C9A961] transition-colors"
                      onClick={() => handleSort('gross_rental_yield')}
                      title="Gross Rental Yield = (Annual Rent ÷ House Price) × 100. 4-5%+ is generally considered good."
                    >
                      Yield <SortIcon column="gross_rental_yield" />
                    </th>
                    <th
                      className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[#4A4137]/60 cursor-pointer hover:text-[#C9A961] transition-colors"
                      onClick={() => handleSort('population')}
                      title="Estimated resident population."
                    >
                      Pop. <SortIcon column="population" />
                    </th>
                    <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-[#4A4137]/60">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {suburbs.map((suburb, index) => (
                    <tr
                      key={suburb.id}
                      className="hover:bg-[#FAF8F3] transition-colors"
                      style={{ borderTop: index === 0 ? 'none' : '1px solid #E8E6E3' }}
                    >
                      <td className="px-4 py-4 text-xs font-bold text-[#4A4137]/40">
                        #{index + 1}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-bold text-[#3A342D]">{suburb.suburb_name}</div>
                        <div className="text-xs text-[#4A4137]/50">{suburb.postcode}</div>
                      </td>
                      <td className="px-4 py-4 text-xs font-bold text-[#4A4137]/70">
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
                      <td className="px-4 py-4 text-center">
                        <ScoreBadge score={suburb.trades_influx_score} />
                      </td>
                      <td className="px-4 py-4 text-right text-sm text-[#3A342D] font-medium">
                        {suburb.median_house_price
                          ? `$${suburb.median_house_price.toLocaleString()}`
                          : <span className="text-[#4A4137]/30">—</span>}
                      </td>
                      <td
                        className="px-4 py-4 text-right text-sm font-bold"
                        style={{
                          color: (suburb.gross_rental_yield || 0) >= 5
                            ? '#047857'
                            : (suburb.gross_rental_yield || 0) >= 4
                              ? '#B8985A'
                              : '#4A4137',
                        }}
                      >
                        {suburb.gross_rental_yield
                          ? `${suburb.gross_rental_yield}%`
                          : <span className="text-[#4A4137]/30 font-medium">—</span>}
                      </td>
                      <td className="px-4 py-4 text-right text-sm text-[#4A4137]/70">
                        {suburb.population
                          ? suburb.population.toLocaleString()
                          : <span className="text-[#4A4137]/30">—</span>}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => {
                            const url = buildListingsUrl(suburb.suburb_name, suburb.state);
                            window.open(url, '_blank', 'noopener,noreferrer');
                          }}
                          title={`Browse ${listingsType} listings in ${suburb.suburb_name} on ${listingsType === 'commercial' ? 'commercialrealestate.com.au' : 'realestate.com.au'}`}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-[#3A342D] text-white hover:bg-[#C9A961] transition-colors inline-flex items-center gap-1.5"
                        >
                          <i className={`fa-solid ${listingsType === 'commercial' ? 'fa-building' : 'fa-house'} text-[10px]`}></i>
                          Listings
                          <i className="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
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
        <div
          className="mt-6 p-5 rounded-2xl"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid #DCD7CE',
          }}
        >
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[#4A4137]/50 mb-3">Score Legend</h3>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#4A4137]/70">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-emerald-500"></span>
              <span><strong className="text-[#3A342D]">75–100</strong> · High growth potential</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-[#C9A961]"></span>
              <span><strong className="text-[#3A342D]">50–74</strong> · Moderate growth</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-amber-500"></span>
              <span><strong className="text-[#3A342D]">25–49</strong> · Below average</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-rose-500"></span>
              <span><strong className="text-[#3A342D]">0–24</strong> · Low growth indicators</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HotSpots;
