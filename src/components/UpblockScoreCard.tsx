import React, { useState } from 'react';
import type { ScoreResult, SubScore } from '../utils/upblockScore';

type Props = {
  result: ScoreResult;
};

const SUB_SCORE_LABELS: Record<SubScore['name'], string> = {
  yield: 'Yield',
  cashFlow: 'Cash Flow',
  uplift: 'Uplift Potential',
  constraints: 'Constraints',
};

const SUB_SCORE_WEIGHTS: Record<SubScore['name'], string> = {
  yield: '25%',
  cashFlow: '35%',
  uplift: '25%',
  constraints: '15%',
};

export function UpblockScoreCard({ result }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const scoreDisplay = result.scoreRange
    ? `${result.scoreRange.low}–${result.scoreRange.high}`
    : `${result.score}`;

  const confidenceColor = {
    High: 'bg-emerald-100 text-emerald-700',
    Medium: 'bg-amber-100 text-amber-700',
    Low: 'bg-slate-100 text-slate-600',
  }[result.confidenceLabel];

  return (
    <div 
      className="rounded-2xl border overflow-hidden transition-all"
      style={{ 
        backgroundColor: 'var(--bg-card)', 
        borderColor: 'var(--border-color)' 
      }}
    >
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-black/[0.02] transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-xs`} style={{ color: 'var(--text-muted)' }}></i>
            <span className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Upblock Deal Score
            </span>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${confidenceColor}`}>
            {result.confidenceLabel} Confidence
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black" style={{ color: '#C9A961' }}>
            {scoreDisplay}
          </span>
          <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>/100</span>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-5 border-t" style={{ borderColor: 'var(--border-color)' }}>
          {/* Top Drivers */}
          <div className="pt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Positive Drivers */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                <i className="fa-solid fa-arrow-trend-up mr-1"></i> Strengths
              </p>
              {result.drivers.positive.map((driver) => (
                <div 
                  key={driver.name}
                  className="p-3 rounded-xl bg-emerald-50 border border-emerald-100"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-emerald-800">
                      {SUB_SCORE_LABELS[driver.name]}
                    </span>
                    <span className="text-xs font-bold text-emerald-600">
                      {driver.score}/100
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-700">{driver.detail}</p>
                </div>
              ))}
            </div>

            {/* Negative Drivers */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
                <i className="fa-solid fa-triangle-exclamation mr-1"></i> Areas to Watch
              </p>
              {result.drivers.negative.map((driver) => (
                <div 
                  key={driver.name}
                  className="p-3 rounded-xl bg-amber-50 border border-amber-100"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-amber-800">
                      {SUB_SCORE_LABELS[driver.name]}
                    </span>
                    <span className="text-xs font-bold text-amber-600">
                      {driver.score}/100
                    </span>
                  </div>
                  <p className="text-[10px] text-amber-700">{driver.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* All Sub-scores */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Score Components
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {result.subs.map((sub) => (
                <div 
                  key={sub.name}
                  className="p-3 rounded-xl border group relative"
                  style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                    {SUB_SCORE_LABELS[sub.name]} ({SUB_SCORE_WEIGHTS[sub.name]})
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>
                      {sub.score}
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>/100</span>
                  </div>
                  <span 
                    className={`text-[9px] font-bold ${
                      sub.label === 'Strong' || sub.label === 'Few Issues' 
                        ? 'text-emerald-600' 
                        : sub.label === 'OK' || sub.label === 'Some Issues'
                        ? 'text-amber-600'
                        : 'text-red-500'
                    }`}
                  >
                    {sub.label}
                  </span>
                  
                  {/* Tooltip */}
                  <div className="invisible group-hover:visible absolute bottom-full left-0 mb-2 w-48 p-2 bg-[#4A4137] text-white text-[9px] font-medium rounded-lg shadow-xl z-50 opacity-0 group-hover:opacity-100 pointer-events-none">
                    {sub.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* How it's calculated */}
          <div className="pt-2 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              How it's calculated
            </p>
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Weighted average: Cash Flow (35%) + Yield (25%) + Uplift Potential (25%) + Constraints (15%). 
              Based on available property data and scenario assumptions.
            </p>
          </div>

          {/* Disclaimer */}
          <div className="pt-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
            <p className="text-[9px] text-slate-500 leading-relaxed">
              <i className="fa-solid fa-circle-info mr-1"></i>
              <strong>General information only.</strong> Scenario estimate based on assumptions; not financial, legal, or tax advice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

