import { calculateTax } from './tax.calculator.js';
import type { Deductions } from '../types/tax.js';

export interface HikeInput {
  current_ctc: number;
  new_ctc: number;
  regime?: 'old' | 'new';
  deductions?: Partial<Deductions>;
  other_income?: number;
}

export interface HikeScenario {
  ctc: number;
  gross_salary: number;         // after removing employer PF & gratuity
  taxable_income: number;
  income_tax: number;
  effective_rate: number;
  monthly_take_home: number;    // rough estimate
  monthly_tax: number;
}

export interface HikeResult {
  current: HikeScenario;
  new: HikeScenario;

  hike_amount: number;
  hike_percent: number;

  extra_tax_annual: number;
  extra_tax_monthly: number;
  extra_take_home_annual: number;
  extra_take_home_monthly: number;

  // Percentage of hike that goes to tax
  tax_on_hike_percent: number;

  // Marginal rate on the incremental salary
  marginal_rate: number;

  regime: 'old' | 'new';
  summary: string;

  // Breakeven: how much hike needed to get a specific take-home increase
  breakeven_for_10k_takehome: number; // CTC hike needed for ₹10k/mo more in hand
}

function ctcToGross(ctc: number): number {
  // Approx: remove employer PF (12% of ~40% basic) and gratuity (4.81% of ~40% basic)
  const basic = ctc * 0.40;
  return Math.round(ctc - basic * 0.12 - basic * 0.0481);
}

function buildScenario(ctc: number, regime: 'old' | 'new', deductions: Deductions, otherIncome: number): HikeScenario {
  const gross = ctcToGross(ctc);
  const result = calculateTax(
    { salary: gross, other_sources: otherIncome, capital_gains_stcg: 0, capital_gains_ltcg: 0, house_property: 0 },
    deductions,
    regime,
  );

  // Rough monthly take-home: gross - employee PF - income tax
  const employeePf = Math.round(gross * 0.40 * 0.12);
  const profTax    = 2_400; // ₹200/mo standard
  const monthlyTax = Math.round(result.total_tax / 12);
  const monthlyTakeHome = Math.round((gross - employeePf - profTax - result.total_tax) / 12);

  return {
    ctc,
    gross_salary: gross,
    taxable_income: result.taxable_income,
    income_tax: result.total_tax,
    effective_rate: result.effective_rate,
    monthly_take_home: Math.max(0, monthlyTakeHome),
    monthly_tax: monthlyTax,
  };
}

export function simulateHike(input: HikeInput): HikeResult {
  const regime = input.regime ?? 'new';
  const deds: Deductions = {
    section_80c:     input.deductions?.section_80c     ?? 0,
    section_80d:     input.deductions?.section_80d     ?? 0,
    section_80ccd1b: input.deductions?.section_80ccd1b ?? 0,
    section_24b:     input.deductions?.section_24b     ?? 0,
    other:           input.deductions?.other           ?? 0,
  };
  const otherIncome = input.other_income ?? 0;

  const current = buildScenario(input.current_ctc, regime, deds, otherIncome);
  const next    = buildScenario(input.new_ctc,     regime, deds, otherIncome);

  const hikeAmount   = input.new_ctc - input.current_ctc;
  const hikePercent  = (hikeAmount / input.current_ctc) * 100;

  const extraTaxAnnual      = Math.max(0, next.income_tax - current.income_tax);
  const extraTaxMonthly     = Math.round(extraTaxAnnual / 12);
  const extraTakeHomeAnnual = Math.max(0, (ctcToGross(input.new_ctc) - next.income_tax) - (ctcToGross(input.current_ctc) - current.income_tax));
  const extraTakeHomeMonthly= Math.round(extraTakeHomeAnnual / 12);

  const taxOnHikePct = hikeAmount > 0 ? (extraTaxAnnual / hikeAmount) * 100 : 0;
  const marginalRate = taxOnHikePct; // effectively the same for a salary increment

  // Breakeven: to get ₹10k/mo more in hand, need CTC hike of 10000*12 / (1 - marginal_rate/100)
  const breakevenFor10k = marginalRate < 100
    ? Math.round((10_000 * 12) / (1 - marginalRate / 100))
    : 0;

  const summary = hikeAmount <= 0
    ? 'Enter a higher new CTC to simulate.'
    : `Your ₹${(hikeAmount / 100_000).toFixed(1)}L hike adds ₹${extraTakeHomeMonthly.toLocaleString('en-IN')}/mo to your take-home. ₹${extraTaxMonthly.toLocaleString('en-IN')}/mo goes as additional tax (${taxOnHikePct.toFixed(0)}% of the hike).`;

  return {
    current,
    new: next,
    hike_amount: hikeAmount,
    hike_percent: hikePercent,
    extra_tax_annual: extraTaxAnnual,
    extra_tax_monthly: extraTaxMonthly,
    extra_take_home_annual: extraTakeHomeAnnual,
    extra_take_home_monthly: extraTakeHomeMonthly,
    tax_on_hike_percent: taxOnHikePct,
    marginal_rate: marginalRate,
    regime,
    summary,
    breakeven_for_10k_takehome: breakevenFor10k,
  };
}
