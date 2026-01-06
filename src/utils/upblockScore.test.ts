import { describe, it, expect } from 'vitest';
import { computeUpblockScore, ScoreInputs } from './upblockScore';

describe('computeUpblockScore', () => {
  it('high yield, positive cashflow, good uplift, few constraints => high score + high confidence', () => {
    const inputs: ScoreInputs = {
      purchasePrice: 800000,
      yieldPercent: 5.5, // Strong yield
      cashFlowWeekly: 150, // Positive cash flow
      uplift: {
        conservative: 40000,  // 5%
        base: 80000,          // 10%
        upside: 120000,       // 15%
      },
      constraints: [
        { key: 'minor_setback', label: 'Minor setback requirement', severity: 'low' },
      ],
    };

    const result = computeUpblockScore(inputs);

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.confidenceLabel).toBe('High');
    expect(result.scoreRange).toBeUndefined(); // No range when confidence high
    expect(result.drivers.positive.length).toBe(2);
    expect(result.drivers.negative.length).toBe(2);
  });

  it('missing most inputs => neutral score around 55-65, low confidence, has range', () => {
    const inputs: ScoreInputs = {
      purchasePrice: 500000,
      // No yield, no cashflow, no uplift, no constraints
    };

    const result = computeUpblockScore(inputs);

    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.score).toBeLessThanOrEqual(65);
    expect(result.confidence).toBeLessThan(0.5);
    expect(result.confidenceLabel).toBe('Low');
    expect(result.scoreRange).toBeDefined();
    expect(result.scoreRange!.low).toBeLessThan(result.score);
    expect(result.scoreRange!.high).toBeGreaterThan(result.score);
  });

  it('negative cashflow + negative conservative uplift => lower score, drivers reflect negatives', () => {
    const inputs: ScoreInputs = {
      purchasePrice: 1000000,
      yieldPercent: 3.5, // OK yield
      cashFlowWeekly: -300, // Negative cash flow
      uplift: {
        conservative: -50000,  // -5% (negative)
        base: 20000,           // 2%
        upside: 80000,         // 8%
      },
      constraints: [],
    };

    const result = computeUpblockScore(inputs);

    expect(result.score).toBeLessThan(60);
    
    // Cash flow should be in negative drivers
    const negativeNames = result.drivers.negative.map(d => d.name);
    expect(negativeNames).toContain('cashFlow');
    
    // Cash flow detail should show negative
    const cashFlowSub = result.subs.find(s => s.name === 'cashFlow');
    expect(cashFlowSub?.detail).toContain('-');
  });

  it('many high constraints => constraints subscore low', () => {
    const inputs: ScoreInputs = {
      purchasePrice: 600000,
      yieldPercent: 4.5,
      cashFlowWeekly: 50,
      uplift: {
        base: 30000,
      },
      constraints: [
        { key: 'heritage', label: 'Heritage overlay', severity: 'high' },
        { key: 'flood', label: 'Flood zone', severity: 'high' },
        { key: 'bushfire', label: 'Bushfire prone', severity: 'high' },
        { key: 'easement', label: 'Easement restriction', severity: 'medium' },
      ],
    };

    const result = computeUpblockScore(inputs);

    // Constraints subscore should be very low (100 - 22*3 - 12 = 22)
    const constraintsSub = result.subs.find(s => s.name === 'constraints');
    expect(constraintsSub?.score).toBeLessThanOrEqual(25);
    expect(constraintsSub?.label).toBe('Major Issues');
    
    // Overall score should be impacted
    expect(result.score).toBeLessThan(70);
  });

  it('returns correct sub-score labels', () => {
    const inputs: ScoreInputs = {
      purchasePrice: 700000,
      yieldPercent: 6.5, // Very strong
      cashFlowWeekly: 250, // Very positive
      uplift: { base: 140000 }, // 20%
      constraints: [], // Few issues
    };

    const result = computeUpblockScore(inputs);

    const yieldSub = result.subs.find(s => s.name === 'yield');
    expect(yieldSub?.label).toBe('Strong');

    const cashFlowSub = result.subs.find(s => s.name === 'cashFlow');
    expect(cashFlowSub?.label).toBe('Strong');

    const upliftSub = result.subs.find(s => s.name === 'uplift');
    expect(upliftSub?.label).toBe('Strong');
  });

  it('handles edge case of zero purchase price', () => {
    const inputs: ScoreInputs = {
      purchasePrice: 0,
      yieldPercent: 5,
    };

    const result = computeUpblockScore(inputs);
    
    // Should not crash, should return neutral scores
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('clamps scores between 0 and 100', () => {
    // Extreme negative scenario
    const inputs: ScoreInputs = {
      purchasePrice: 500000,
      yieldPercent: 0.5, // Very low
      cashFlowWeekly: -600, // Very negative
      uplift: { conservative: -100000, base: -50000 }, // Negative uplift
      constraints: [
        { key: 'c1', label: 'Constraint 1', severity: 'high' },
        { key: 'c2', label: 'Constraint 2', severity: 'high' },
        { key: 'c3', label: 'Constraint 3', severity: 'high' },
        { key: 'c4', label: 'Constraint 4', severity: 'high' },
        { key: 'c5', label: 'Constraint 5', severity: 'high' },
      ],
    };

    const result = computeUpblockScore(inputs);
    
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    
    for (const sub of result.subs) {
      expect(sub.score).toBeGreaterThanOrEqual(0);
      expect(sub.score).toBeLessThanOrEqual(100);
    }
  });

  it('severely overpriced property (30%+ above market) => very low value score', () => {
    const inputs: ScoreInputs = {
      purchasePrice: 800000, // Estimated market value
      askingPrice: 1100000, // 37.5% above market (terrible deal)
      yieldPercent: 5.0,
      cashFlowWeekly: 100,
      uplift: { base: 80000 },
      constraints: [],
    };

    const result = computeUpblockScore(inputs);
    
    // Value subscore should be very low
    const valueSub = result.subs.find(s => s.name === 'value');
    expect(valueSub?.score).toBeLessThanOrEqual(20);
    expect(valueSub?.label).toBe('Avoid');
    
    // Overall score should be significantly reduced
    expect(result.score).toBeLessThan(70);
  });

  it('fairly priced property => good value score', () => {
    const inputs: ScoreInputs = {
      purchasePrice: 800000, // Estimated market value
      askingPrice: 820000, // Only 2.5% above market (fair)
      yieldPercent: 5.0,
      cashFlowWeekly: 100,
      uplift: { base: 80000 },
      constraints: [],
    };

    const result = computeUpblockScore(inputs);
    
    // Value subscore should be reasonable
    const valueSub = result.subs.find(s => s.name === 'value');
    expect(valueSub?.score).toBeGreaterThanOrEqual(65);
    expect(valueSub?.label).toBe('Fair');
  });

  it('underpriced property (below market) => great value score', () => {
    const inputs: ScoreInputs = {
      purchasePrice: 800000, // Estimated market value
      askingPrice: 700000, // 12.5% below market (great deal)
      yieldPercent: 5.0,
      cashFlowWeekly: 100,
      uplift: { base: 80000 },
      constraints: [],
    };

    const result = computeUpblockScore(inputs);
    
    // Value subscore should be high
    const valueSub = result.subs.find(s => s.name === 'value');
    expect(valueSub?.score).toBeGreaterThanOrEqual(90);
    expect(valueSub?.label).toBe('Great Value');
  });

  it('no asking price available => unknown value score with lower confidence', () => {
    const inputs: ScoreInputs = {
      purchasePrice: 800000,
      // No askingPrice
      yieldPercent: 5.0,
      cashFlowWeekly: 100,
    };

    const result = computeUpblockScore(inputs);
    
    // Value subscore should be unknown
    const valueSub = result.subs.find(s => s.name === 'value');
    expect(valueSub?.label).toBe('Unknown');
    expect(valueSub?.detail).toContain('No asking price');
  });
});

