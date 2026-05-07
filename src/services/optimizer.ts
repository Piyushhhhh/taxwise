import { calculateTax } from './tax.calculator.js';
import type { IncomeBreakdown, Deductions } from '../types/tax.js';

export interface OptimizerSuggestion {
  section: string;
  label: string;
  used: number;
  limit: number;
  remaining: number;
  tax_saving: number;
  effective_saving_rate: number; // % of every ₹1 invested that comes back as tax saving
  suggestions: string[]; // concrete instruments
  priority: 'high' | 'medium' | 'low';
}

export interface OptimizerResult {
  current_tax: number;
  optimized_tax: number;
  total_saving_possible: number;
  effective_rate_now: number;
  effective_rate_after: number;
  already_optimal: boolean;
  suggestions: OptimizerSuggestion[];
  summary: string; // e.g. "Invest ₹70k more to save ₹21,840"
}

const LIMITS = {
  section_80c:     150_000,
  section_80d:      25_000,
  section_80ccd1b:  50_000,
  section_24b:     200_000,
};

const INSTRUMENTS: Record<string, string[]> = {
  section_80c:     ['ELSS mutual funds', 'PPF', 'NPS (employee contribution)', 'Tax-saving FD (5yr)', 'LIC premium', 'NSC', 'ULIP'],
  section_80d:     ['Health insurance for self & family', 'Top-up health cover', 'Parents\' health insurance (extra ₹25k if senior)'],
  section_80ccd1b: ['NPS Tier-1 account (additional contribution)'],
  section_24b:     ['Home loan interest is auto-applicable — ensure loan is active'],
};

export function optimizeTax(
  income: IncomeBreakdown,
  deductions: Deductions,
): OptimizerResult {
  const currentResult  = calculateTax(income, deductions, 'old');
  const currentTax     = currentResult.total_tax;

  // Build fully-optimized deductions (fill every section to its limit)
  const maxDeductions: Deductions = {
    section_80c:     Math.min(deductions.section_80c     || 0, LIMITS.section_80c),
    section_80d:     Math.min(deductions.section_80d     || 0, LIMITS.section_80d),
    section_80ccd1b: Math.min(deductions.section_80ccd1b || 0, LIMITS.section_80ccd1b),
    section_24b:     Math.min(deductions.section_24b     || 0, LIMITS.section_24b),
    other:           deductions.other || 0,
  };

  const suggestions: OptimizerSuggestion[] = [];

  const sectionKeys: Array<keyof typeof LIMITS> = ['section_80c','section_80d','section_80ccd1b','section_24b'];

  for (const key of sectionKeys) {
    const used      = Math.min(deductions[key] || 0, LIMITS[key]);
    const limit     = LIMITS[key];
    const remaining = limit - used;

    if (remaining <= 0) continue;

    // Tax saving = marginal rate on remaining room
    // Compute tax with and without this extra deduction
    const withExtra: Deductions = { ...maxDeductions, [key]: limit };
    const withoutExtra: Deductions = { ...maxDeductions, [key]: used };

    const taxWith    = calculateTax(income, withExtra, 'old').total_tax;
    const taxWithout = calculateTax(income, withoutExtra, 'old').total_tax;
    const taxSaving  = Math.max(0, taxWithout - taxWith);

    if (taxSaving === 0) continue;

    const effectiveSavingRate = remaining > 0 ? (taxSaving / remaining) * 100 : 0;

    const labelMap: Record<string, string> = {
      section_80c:     'Section 80C investments',
      section_80d:     'Section 80D health insurance',
      section_80ccd1b: 'Section 80CCD(1B) NPS',
      section_24b:     'Section 24B home loan interest',
    };

    suggestions.push({
      section: key,
      label: labelMap[key],
      used,
      limit,
      remaining,
      tax_saving: taxSaving,
      effective_saving_rate: effectiveSavingRate,
      suggestions: INSTRUMENTS[key] || [],
      priority: effectiveSavingRate >= 30 ? 'high' : effectiveSavingRate >= 15 ? 'medium' : 'low',
    });

    // Apply this section's max for next comparisons
    maxDeductions[key] = limit;
  }

  // Sort by tax saving descending
  suggestions.sort((a, b) => b.tax_saving - a.tax_saving);

  const optimizedResult = calculateTax(income, maxDeductions, 'old');
  const optimizedTax    = optimizedResult.total_tax;
  const totalSaving     = Math.max(0, currentTax - optimizedTax);

  // Build human summary
  let summary = '';
  if (totalSaving === 0) {
    summary = 'Your deductions are already fully optimized. Great work!';
  } else if (suggestions.length === 1) {
    const s = suggestions[0];
    summary = `Invest ₹${s.remaining.toLocaleString('en-IN')} more in ${s.label.toLowerCase()} to save ₹${s.tax_saving.toLocaleString('en-IN')} in tax.`;
  } else {
    const top = suggestions[0];
    summary = `You can save up to ₹${totalSaving.toLocaleString('en-IN')} in tax. Start with ₹${top.remaining.toLocaleString('en-IN')} more in ${top.label.toLowerCase()} — saves ₹${top.tax_saving.toLocaleString('en-IN')} alone.`;
  }

  return {
    current_tax: currentTax,
    optimized_tax: optimizedTax,
    total_saving_possible: totalSaving,
    effective_rate_now: currentResult.effective_rate,
    effective_rate_after: optimizedResult.effective_rate,
    already_optimal: totalSaving === 0,
    suggestions,
    summary,
  };
}
