import React, { useEffect, useState, useCallback } from 'react';
import { supabaseService } from '../services/supabaseService';

interface LeadItem {
  id: string;
  revealed: boolean;
  suburb: string;
  target_price_band: string;
  notes_preview?: string | null;
  // Revealed-only fields
  property_address?: string;
  target_price?: number;
  name?: string;
  phone?: string | null;
  email?: string;
  notes?: string | null;
  created_at: string;
}

interface ListResponse {
  items: LeadItem[];
  total: number;
  page: number;
  limit: number;
  free_reveals_total: number;
  free_reveals_remaining: number;
  lead_reveal_price_cents: number;
}

interface LeadsDashboardProps {
  onBack: () => void;
}

const PAGE_SIZE = 20;

function daysAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  if (days < 60) return '1 month ago';
  return `${Math.floor(days / 30)} months ago`;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

const LeadsDashboard: React.FC<LeadsDashboardProps> = ({ onBack }) => {
  const [items, setItems] = useState<LeadItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [freeRevealsRemaining, setFreeRevealsRemaining] = useState(0);
  const [priceCents, setPriceCents] = useState(4900);
  const [revealingId, setRevealingId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchLeads = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await supabaseService.authenticatedFetch(
        `/api/leads?page=${pageNum}&limit=${PAGE_SIZE}`,
        { method: 'GET' }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Failed to load leads (${response.status})`);
      }
      const data: ListResponse = await response.json();
      setItems(data.items);
      setTotal(data.total);
      setFreeRevealsRemaining(data.free_reveals_remaining);
      setPriceCents(data.lead_reveal_price_cents);
    } catch (e: any) {
      setError(e.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads(page);
  }, [page, fetchLeads]);

  const handleReveal = async (leadId: string) => {
    setRevealingId(leadId);
    try {
      const response = await supabaseService.authenticatedFetch('/api/leads-reveal', {
        method: 'POST',
        body: JSON.stringify({ leadId }),
      });
      const data = await response.json();

      if (response.status === 402 && data.stripeUrl) {
        // Redirect to Stripe Checkout for paid reveal
        window.location.href = data.stripeUrl;
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reveal lead');
      }

      // Success: replace this row with the revealed version
      setItems((prev) =>
        prev.map((item) =>
          item.id === leadId
            ? {
                ...item,
                revealed: true,
                property_address: data.lead.property_address,
                target_price: data.lead.target_price,
                name: data.lead.name,
                phone: data.lead.phone,
                email: data.lead.email,
                notes: data.lead.notes,
              }
            : item
        )
      );
      if (data.usedFreeReveal && typeof data.free_reveals_remaining === 'number') {
        setFreeRevealsRemaining(data.free_reveals_remaining);
      }
    } catch (e: any) {
      alert(`Failed to reveal: ${e.message || 'Unknown error'}`);
    } finally {
      setRevealingId(null);
    }
  };

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-8">
        <div className="flex items-center justify-between gap-4 mb-2">
          <button
            onClick={onBack}
            className="text-sm font-bold uppercase tracking-widest text-[#4A4137]/60 hover:text-[#C9A961] transition-colors"
          >
            <i className="fa-solid fa-arrow-left mr-2"></i>Back
          </button>
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-[#4A4137]/60">
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full">
              {freeRevealsRemaining} / 5 free reveals
            </span>
            <span className="px-3 py-1.5 bg-[#C9A961]/10 text-[#C9A961] rounded-full">
              {formatPrice(priceCents)} per reveal
            </span>
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#3A342D] mb-2">Property Leads</h1>
        <p className="text-sm text-[#4A4137]/60 max-w-2xl">
          Property owners who've indicated they're open to a conversation. First {5} reveals are free.
          After that, unlock a lead's full contact details and address for {formatPrice(priceCents)} per lead.
        </p>
      </div>

      {/* List */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {loading && (
          <div className="text-center py-20 text-[#4A4137]/40">
            <i className="fa-solid fa-spinner fa-spin text-2xl mb-3"></i>
            <p className="text-sm">Loading leads…</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
            <i className="fa-solid fa-circle-exclamation mr-2"></i>
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="text-center py-20 text-[#4A4137]/40">
            <i className="fa-solid fa-inbox text-3xl mb-3"></i>
            <p className="text-sm">No leads yet.</p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-3">
            {items.map((lead) => (
              <div
                key={lead.id}
                className={`p-5 rounded-2xl border transition-all ${
                  lead.revealed
                    ? 'bg-white border-[#C9A961]/30 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {lead.revealed ? (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#C9A961] text-white">
                            Revealed
                          </span>
                          <span className="text-xs text-[#4A4137]/50">{daysAgo(lead.created_at)}</span>
                        </div>
                        <p className="text-base font-bold text-[#3A342D] mb-1">{lead.property_address}</p>
                        <p className="text-sm text-[#4A4137]/70 mb-3">
                          Target: ${(lead.target_price || 0).toLocaleString()}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                          <div className="p-2 bg-slate-50 rounded-lg">
                            <p className="text-[9px] font-black text-[#4A4137]/40 uppercase tracking-widest">Name</p>
                            <p className="text-[#3A342D] font-medium">{lead.name || '—'}</p>
                          </div>
                          <div className="p-2 bg-slate-50 rounded-lg">
                            <p className="text-[9px] font-black text-[#4A4137]/40 uppercase tracking-widest">Email</p>
                            <a href={`mailto:${lead.email}`} className="text-[#C9A961] font-medium hover:underline truncate block">
                              {lead.email || '—'}
                            </a>
                          </div>
                          <div className="p-2 bg-slate-50 rounded-lg">
                            <p className="text-[9px] font-black text-[#4A4137]/40 uppercase tracking-widest">Phone</p>
                            {lead.phone ? (
                              <a href={`tel:${lead.phone}`} className="text-[#C9A961] font-medium hover:underline">
                                {lead.phone}
                              </a>
                            ) : (
                              <p className="text-[#3A342D]/40">—</p>
                            )}
                          </div>
                        </div>
                        {lead.notes && (
                          <p className="mt-3 text-xs text-[#4A4137]/70 italic">"{lead.notes}"</p>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-sm font-bold text-[#3A342D]">{lead.suburb}</span>
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#C9A961]/10 text-[#C9A961]">
                            {lead.target_price_band}
                          </span>
                          <span className="text-xs text-[#4A4137]/50">{daysAgo(lead.created_at)}</span>
                        </div>
                        <p className="text-sm text-[#4A4137]/40 select-none">
                          <i className="fa-solid fa-lock mr-2"></i>
                          ████ ████ ████ St
                        </p>
                        {lead.notes_preview && (
                          <p className="mt-2 text-xs text-[#4A4137]/60 italic">"{lead.notes_preview}"</p>
                        )}
                      </>
                    )}
                  </div>

                  {!lead.revealed && (
                    <button
                      onClick={() => handleReveal(lead.id)}
                      disabled={revealingId === lead.id}
                      className="flex-shrink-0 px-5 py-2.5 bg-[#3A342D] text-white rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-[#C9A961] transition-colors disabled:opacity-50"
                    >
                      {revealingId === lead.id ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin mr-2"></i>...
                        </>
                      ) : freeRevealsRemaining > 0 ? (
                        <>Reveal (free)</>
                      ) : (
                        <>Reveal · {formatPrice(priceCents)}</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold disabled:opacity-30"
            >
              Prev
            </button>
            <span className="text-sm text-[#4A4137]/60">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadsDashboard;
