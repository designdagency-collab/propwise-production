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

// Generate a natural language summary based on the score result
function generateSummary(result: ScoreResult): string {
  const strengths = result.drivers.positive;
  const weaknesses = result.drivers.negative;
  
  // Build strength phrases
  const strengthPhrases: string[] = [];
  for (const s of strengths) {
    if (s.name === 'cashFlow' && s.detail !== 'Missing inputs') {
      strengthPhrases.push(`cash flow (${s.detail})`);
    } else if (s.name === 'yield' && s.detail !== 'Missing inputs') {
      strengthPhrases.push(`yield (${s.detail})`);
    } else if (s.name === 'constraints' && s.label === 'Few Issues') {
      strengthPhrases.push('few planning constraints');
    } else if (s.name === 'uplift' && s.detail !== 'Missing inputs') {
      strengthPhrases.push(`uplift potential (${s.detail})`);
    }
  }
  
  // Build weakness phrases
  const weaknessPhrases: string[] = [];
  for (const w of weaknesses) {
    if (w.detail === 'Missing inputs') {
      weaknessPhrases.push(`${SUB_SCORE_LABELS[w.name].toLowerCase()} data`);
    } else if (w.name === 'constraints' && w.label !== 'Few Issues') {
      weaknessPhrases.push('planning constraints');
    } else if (w.name === 'cashFlow' && w.score < 50) {
      weaknessPhrases.push(`cash flow (${w.detail})`);
    } else if (w.name === 'uplift' && w.score < 60) {
      weaknessPhrases.push('uplift potential');
    }
  }
  
  // Compose summary
  let summary = '';
  
  if (strengthPhrases.length > 0) {
    summary += `This property scores well on ${strengthPhrases.join(' and ')}.`;
  }
  
  if (weaknessPhrases.length > 0) {
    summary += summary ? ' ' : '';
    summary += `Consider verifying ${weaknessPhrases.join(' and ')} before proceeding.`;
  }
  
  if (!summary) {
    summary = 'Review the detailed analysis above to understand the key factors driving this score.';
  }
  
  return summary;
}

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
                      {driver.label}
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
                      {driver.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-amber-700">{driver.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="pt-2 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Summary
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {generateSummary(result)}
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
