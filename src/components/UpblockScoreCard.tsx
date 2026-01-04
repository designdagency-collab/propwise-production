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

// Get label color class
function getLabelColor(label: string, isPositive: boolean): string {
  if (label === 'Unknown') return 'text-slate-400';
  if (isPositive) return 'text-emerald-600';
  return 'text-amber-600';
}

// Generate a factual, observational summary — NO advice or recommendations
function generateSummary(result: ScoreResult): string {
  const subs = Object.fromEntries(result.subs.map(s => [s.name, s]));
  const cashFlow = subs.cashFlow;
  const yieldSub = subs.yield;
  const uplift = subs.uplift;
  const constraints = subs.constraints;
  
  const paragraphs: string[] = [];
  
  // Overall score context — factual statement only
  if (result.score >= 80) {
    paragraphs.push("This property scores strongly across multiple metrics.");
  } else if (result.score >= 65) {
    paragraphs.push("This property shows moderate scores with variation across metrics.");
  } else if (result.score >= 50) {
    paragraphs.push("This property shows mixed results across the scored metrics.");
  } else {
    paragraphs.push("This property scores below average on several metrics.");
  }
  
  // Cash flow observation — factual, no advice
  if (cashFlow.label !== 'Unknown') {
    const weeklyMatch = cashFlow.detail.match(/([+-]?\$?-?\d+)/);
    const weekly = weeklyMatch ? parseInt(weeklyMatch[1].replace(/[$,]/g, '')) : 0;
    
    if (weekly >= 100) {
      paragraphs.push(`Cash flow is positive at ${cashFlow.detail}, indicating income exceeds estimated holding costs.`);
    } else if (weekly >= 0) {
      paragraphs.push(`Cash flow is approximately neutral at ${cashFlow.detail}.`);
    } else if (weekly >= -200) {
      paragraphs.push(`Cash flow is negative at ${cashFlow.detail}, indicating estimated holding costs exceed rental income.`);
    } else {
      paragraphs.push(`Cash flow shows a significant negative position at ${cashFlow.detail}.`);
    }
  }
  
  // Uplift + constraints observation — factual only
  if (uplift.label !== 'Unknown' && constraints.label !== 'Unknown') {
    const hasGoodUplift = uplift.score >= 70;
    const hasFewConstraints = constraints.score >= 75;
    
    if (hasGoodUplift && hasFewConstraints) {
      paragraphs.push(`Uplift scenarios show ${uplift.detail.toLowerCase()}. Identified constraints are minimal.`);
    } else if (hasGoodUplift && !hasFewConstraints) {
      paragraphs.push(`Uplift scenarios show ${uplift.detail.toLowerCase()}. Multiple planning or site constraints have been identified.`);
    } else if (!hasGoodUplift && hasFewConstraints) {
      paragraphs.push(`Uplift scenarios show limited potential. Few planning constraints were identified.`);
    } else {
      paragraphs.push(`Uplift scenarios show limited potential. Multiple constraints have been identified.`);
    }
  } else if (uplift.label !== 'Unknown') {
    paragraphs.push(`Uplift scenarios show ${uplift.detail.toLowerCase()}. Constraint data is incomplete.`);
  } else if (constraints.label !== 'Unknown') {
    const constraintNote = constraints.score >= 75 ? "Few constraints identified." : "Multiple constraints identified.";
    paragraphs.push(`Uplift data is incomplete. ${constraintNote}`);
  }
  
  // Yield observation — factual only
  if (yieldSub.label !== 'Unknown') {
    if (yieldSub.score >= 75) {
      paragraphs.push(`Estimated ${yieldSub.detail.toLowerCase()} — above typical market averages.`);
    } else if (yieldSub.score >= 45) {
      paragraphs.push(`Estimated ${yieldSub.detail.toLowerCase()} — within typical market range.`);
    } else {
      paragraphs.push(`Estimated ${yieldSub.detail.toLowerCase()} — below typical market averages.`);
    }
  }
  
  // Missing data note — factual
  const unknownMetrics = result.subs.filter(s => s.label === 'Unknown').map(s => SUB_SCORE_LABELS[s.name].toLowerCase());
  if (unknownMetrics.length > 0) {
    paragraphs.push(`Data for ${unknownMetrics.join(' and ')} was not available for this analysis.`);
  }
  
  // Confidence note — factual
  if (result.confidenceLabel === 'Low') {
    paragraphs.push("Limited data availability affects scoring precision.");
  } else if (result.confidenceLabel === 'Medium') {
    paragraphs.push("Some data points were unavailable, affecting scoring precision.");
  }
  
  return paragraphs.join(' ');
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
                  className={`p-3 rounded-xl border ${driver.label === 'Unknown' ? 'bg-slate-50 border-slate-200' : 'bg-emerald-50 border-emerald-100'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${driver.label === 'Unknown' ? 'text-slate-600' : 'text-emerald-800'}`}>
                      {SUB_SCORE_LABELS[driver.name]}
                    </span>
                    <span className={`text-xs font-bold ${getLabelColor(driver.label, true)}`}>
                      {driver.label}
                    </span>
                  </div>
                  <p className={`text-[10px] ${driver.label === 'Unknown' ? 'text-slate-500' : 'text-emerald-700'}`}>{driver.detail}</p>
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
                  className={`p-3 rounded-xl border ${driver.label === 'Unknown' ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-100'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${driver.label === 'Unknown' ? 'text-slate-600' : 'text-amber-800'}`}>
                      {SUB_SCORE_LABELS[driver.name]}
                    </span>
                    <span className={`text-xs font-bold ${getLabelColor(driver.label, false)}`}>
                      {driver.label}
                    </span>
                  </div>
                  <p className={`text-[10px] ${driver.label === 'Unknown' ? 'text-slate-500' : 'text-amber-700'}`}>{driver.detail}</p>
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
