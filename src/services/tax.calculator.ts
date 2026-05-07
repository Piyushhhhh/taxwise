import type {
  TaxRegime, IncomeBreakdown, Deductions,
  TaxCalculationResult, TaxSlabBreakdown, SpecialIncomeTax,
  AdvanceTaxSummary, AdvanceTaxInstallment,
} from '../types/tax.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const STANDARD_DEDUCTION_NEW = 75_000;
const STANDARD_DEDUCTION_OLD = 50_000;

// FY 2025-26 New Regime slabs
const NEW_REGIME_SLABS = [
  { limit:   400_000, rate: 0      },
  { limit:   800_000, rate: 0.05   },
  { limit: 1_200_000, rate: 0.10   },
  { limit: 1_600_000, rate: 0.15   },
  { limit: 2_000_000, rate: 0.20   },
  { limit: Infinity,  rate: 0.30   },
];

// FY 2025-26 Old Regime slabs
const OLD_REGIME_SLABS = [
  { limit:   250_000, rate: 0      },
  { limit:   500_000, rate: 0.05   },
  { limit: 1_000_000, rate: 0.20   },
  { limit: Infinity,  rate: 0.30   },
];

const ADVANCE_TAX_SCHEDULE = [
  { quarter: 1 as const, due_date: '2025-06-15', cumulative_percent: 15 },
  { quarter: 2 as const, due_date: '2025-09-15', cumulative_percent: 45 },
  { quarter: 3 as const, due_date: '2025-12-15', cumulative_percent: 75 },
  { quarter: 4 as const, due_date: '2026-03-15', cumulative_percent: 100 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeSlabTax(income: number, slabs: typeof NEW_REGIME_SLABS): {
  tax: number;
  breakdown: TaxSlabBreakdown[];
} {
  let remaining = income;
  let prev = 0;
  let tax = 0;
  const breakdown: TaxSlabBreakdown[] = [];

  for (const slab of slabs) {
    if (remaining <= 0) break;
    const slabSize = slab.limit === Infinity ? remaining : slab.limit - prev;
    const incomeInSlab = Math.min(remaining, slabSize);
    const slabTax = incomeInSlab * slab.rate;
    tax += slabTax;

    if (incomeInSlab > 0) {
      const upper = slab.limit === Infinity ? '∞' : `₹${(slab.limit / 100_000).toFixed(0)}L`;
      breakdown.push({
        slab: `₹${(prev / 100_000).toFixed(0)}L – ${upper}`,
        rate: slab.rate,
        income_in_slab: incomeInSlab,
        tax: slabTax,
      });
    }

    remaining -= incomeInSlab;
    prev = slab.limit === Infinity ? prev : slab.limit;
  }

  return { tax, breakdown };
}

function computeSurcharge(totalIncome: number, baseTax: number): number {
  if (totalIncome <= 5_000_000)  return 0;
  if (totalIncome <= 10_000_000) return baseTax * 0.10;
  if (totalIncome <= 20_000_000) return baseTax * 0.15;
  if (totalIncome <= 50_000_000) return baseTax * 0.25;
  return baseTax * 0.37;
}

// ─── Main tax calculation ─────────────────────────────────────────────────────

export function calculateTax(
  income: IncomeBreakdown,
  deductions: Deductions,
  regime: TaxRegime
): TaxCalculationResult {

  // ── Step 1: Salary ──
  const stdDeduction = regime === 'new' ? STANDARD_DEDUCTION_NEW : STANDARD_DEDUCTION_OLD;
  const netSalary = Math.max(0, income.salary - stdDeduction);

  // ── Step 2: House property ──
  // Self-occupied: max loss deductible = ₹2L (old), ₹0 (new — no set-off allowed)
  const housePropertyIncome = regime === 'old'
    ? Math.max(-200_000, income.house_property)
    : Math.min(0, income.house_property) === 0 ? 0 : 0; // new regime: no HP loss set-off

  // ── Step 3: Other sources (all taxable at slab) ──
  const fdInterest      = income.interest_fd;
  const dividends       = income.dividends;
  const otherSources    = income.other_sources;
  const freelanceNet    = Math.max(0, income.freelance_income - income.freelance_expenses);

  // Savings interest — exempt up to 80TTA/80TTB (handled in deductions)
  const savingsInterest = income.interest_savings;

  // ── Step 4: Deductions (old regime only, except 80CCD2 and 80E/80EEA in both) ──
  let totalDeductions = 0;

  if (regime === 'old') {
    const cap80C = Math.min(
      (deductions.section_80c || 0) + (deductions.section_80ccc || 0),
      150_000
    );
    const nps1b   = Math.min(deductions.section_80ccd1b || 0, 50_000);
    const health  = Math.min((deductions.section_80d || 0) + (deductions.section_80d_senior || 0),
      (deductions.section_80d_senior || 0) > 0 ? 75_000 : 25_000);
    const hp24b   = Math.min(deductions.section_24b || 0, 200_000);
    const tta     = Math.min(deductions.section_80tta || 0, 10_000);
    const ttb     = Math.min(deductions.section_80ttb || 0, 50_000); // seniors only — replaces TTA
    const edLoan  = deductions.section_80e || 0;                     // no cap
    const eea     = Math.min(deductions.section_80eea || 0, 150_000);
    const donations = (deductions.section_80g || 0) * 0.5;           // conservative 50% estimate
    const gg      = Math.min(deductions.section_80gg || 0, 60_000);
    const other   = deductions.other || 0;

    totalDeductions = cap80C + nps1b + health + hp24b
      + (ttb > 0 ? ttb : tta)   // 80TTB supersedes 80TTA for seniors
      + edLoan + eea + donations + gg + other;
  }

  // 80CCD(2) — employer NPS: allowed in both regimes (no cap specified, up to 10% of salary)
  const nps2 = Math.min(deductions.section_80ccd2 || 0, income.salary * 0.10);
  totalDeductions += nps2;

  // ── Step 5: Regular (slab-taxed) taxable income ──
  const regularGross = netSalary
    + housePropertyIncome
    + savingsInterest
    + fdInterest
    + dividends
    + otherSources
    + freelanceNet;

  const taxableRegular = Math.max(0, regularGross - totalDeductions);

  // ── Step 6: Slab tax ──
  const slabs = regime === 'new' ? NEW_REGIME_SLABS : OLD_REGIME_SLABS;
  const { tax: slabTax, breakdown } = computeSlabTax(taxableRegular, slabs);

  // ── Step 7: Special rate taxes (computed separately, not subject to slab) ──

  // STCG u/s 111A (equity/equity MF held < 12mo) — 20% flat
  const stcg111aTax = income.capital_gains_stcg * 0.20;

  // LTCG u/s 112A (equity/equity MF held ≥ 12mo) — 12.5% above ₹1.25L
  const ltcg112aTaxable = Math.max(0, income.capital_gains_ltcg - 125_000);
  const ltcg112aTax = ltcg112aTaxable * 0.125;

  // STCG other (debt MF, property sold < 24mo) — taxed at slab (already in regular if entered there)
  // Here we treat it as additional slab income for simplicity
  const stcgOtherTax = computeSlabTax(
    income.capital_gains_stcg_other,
    slabs
  ).tax;

  // LTCG other (property, debt MF ≥ 24mo) — 12.5% without indexation (post Budget 2024)
  const ltcgOtherTax = income.capital_gains_ltcg_other * 0.125;

  // Lottery / game show — 30% flat, no cess exemption, no deductions
  const lotteryTax = income.lottery_winnings * 0.30;

  // Crypto / VDA — 30% flat u/s 115BBH
  const cryptoTax = income.crypto_vda * 0.30;

  const specialTax: SpecialIncomeTax = {
    stcg_111a:  stcg111aTax,
    ltcg_112a:  ltcg112aTax,
    stcg_other: stcgOtherTax,
    ltcg_other: ltcgOtherTax,
    lottery:    lotteryTax,
    crypto:     cryptoTax,
  };

  // ── Step 8: Total income for surcharge ──
  const totalIncomeTax = slabTax
    + stcg111aTax + ltcg112aTax + stcgOtherTax + ltcgOtherTax
    + lotteryTax  + cryptoTax;

  const totalIncomeForSurcharge = taxableRegular
    + income.capital_gains_stcg + income.capital_gains_ltcg
    + income.capital_gains_stcg_other + income.capital_gains_ltcg_other
    + income.lottery_winnings + income.crypto_vda;

  // ── Step 9: Rebate u/s 87A ──
  // New regime: full rebate if taxable income ≤ ₹7L (only on regular income + STCG 111A — NOT lottery/crypto)
  // Old regime: rebate if taxable income ≤ ₹5L
  let rebate87a = 0;
  const rebatableIncome = taxableRegular + income.capital_gains_stcg;
  const taxEligibleForRebate = slabTax + stcg111aTax;
  if (regime === 'new' && rebatableIncome <= 700_000) {
    rebate87a = Math.min(taxEligibleForRebate, 25_000);
  } else if (regime === 'old' && taxableRegular <= 500_000) {
    rebate87a = Math.min(taxEligibleForRebate, 12_500);
  }

  const taxAfterRebate = Math.max(0, totalIncomeTax - rebate87a);
  const surcharge = computeSurcharge(totalIncomeForSurcharge, taxAfterRebate);
  const cess = (taxAfterRebate + surcharge) * 0.04;
  const totalTax = taxAfterRebate + surcharge + cess;

  const effectiveRate = totalIncomeForSurcharge > 0
    ? (totalTax / totalIncomeForSurcharge) * 100
    : 0;

  const grossTotalIncome = regularGross
    + income.capital_gains_stcg + income.capital_gains_ltcg
    + income.capital_gains_stcg_other + income.capital_gains_ltcg_other
    + income.lottery_winnings + income.crypto_vda;

  return {
    regime,
    taxable_income: taxableRegular,
    gross_total_income: grossTotalIncome,
    total_deductions_applied: totalDeductions,
    special_income_tax: specialTax,
    slab_breakdown: breakdown,
    income_tax: slabTax,
    surcharge,
    health_education_cess: cess,
    total_tax: totalTax,
    effective_rate: effectiveRate,
    rebate_87a: rebate87a,
    regime_recommendation: { better: regime, saving: 0, reason: '' },
  };
}

// ─── Regime comparison ────────────────────────────────────────────────────────

export function compareRegimes(
  income: IncomeBreakdown,
  deductions: Deductions
): { old: TaxCalculationResult; new: TaxCalculationResult; recommendation: TaxCalculationResult['regime_recommendation'] } {
  const oldResult = calculateTax(income, deductions, 'old');
  const newResult = calculateTax(income, deductions, 'new');

  const saving = Math.abs(oldResult.total_tax - newResult.total_tax);
  const better: TaxRegime = oldResult.total_tax <= newResult.total_tax ? 'old' : 'new';

  const deductionTotal = (deductions.section_80c || 0)
    + (deductions.section_80d || 0) + (deductions.section_80ccd1b || 0)
    + (deductions.section_24b || 0) + (deductions.other || 0);

  const reason = better === 'old'
    ? `Old regime saves ₹${saving.toLocaleString('en-IN')} due to ₹${deductionTotal.toLocaleString('en-IN')} in deductions`
    : `New regime saves ₹${saving.toLocaleString('en-IN')} — your deductions (₹${deductionTotal.toLocaleString('en-IN')}) don't offset the lower rates`;

  const recommendation = { better, saving, reason };
  oldResult.regime_recommendation = recommendation;
  newResult.regime_recommendation = recommendation;

  return { old: oldResult, new: newResult, recommendation };
}

// ─── Advance Tax ─────────────────────────────────────────────────────────────

export function calculateAdvanceTax(
  income: IncomeBreakdown,
  deductions: Deductions,
  regime: TaxRegime,
  tdsDeducted: number,
  paidInstallments: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
): AdvanceTaxSummary {
  const calc = calculateTax(income, deductions, regime);
  const totalTax = calc.total_tax;
  const netTaxAfterTds = Math.max(0, totalTax - tdsDeducted);
  const advanceTaxRequired = netTaxAfterTds > 10_000;

  const today = new Date();
  let cumulativePaid = 0;
  let totalInterest234c = 0;

  const installments: AdvanceTaxInstallment[] = ADVANCE_TAX_SCHEDULE.map(schedule => {
    const dueDate = new Date(schedule.due_date);
    const taxDue = Math.floor(netTaxAfterTds * schedule.cumulative_percent / 100);
    const paid = paidInstallments[schedule.quarter] ?? 0;
    cumulativePaid += paid;
    const shortfall = Math.max(0, taxDue - cumulativePaid);

    const interest234c = advanceTaxRequired && shortfall > 0 && dueDate < today
      ? Math.floor(shortfall * 0.01 * 3)
      : 0;
    totalInterest234c += interest234c;

    let status: AdvanceTaxInstallment['status'];
    if (cumulativePaid >= taxDue) status = 'paid';
    else if (dueDate < today) status = 'overdue';
    else if (Math.abs(dueDate.getTime() - today.getTime()) < 7 * 24 * 60 * 60 * 1000) status = 'due';
    else status = 'upcoming';

    return {
      quarter: schedule.quarter,
      due_date: schedule.due_date,
      cumulative_percent: schedule.cumulative_percent,
      tax_due: taxDue,
      paid: cumulativePaid,
      shortfall,
      interest_234c: interest234c,
      status,
    };
  });

  const totalPaid = Object.values(paidInstallments).reduce((a, b) => a + b, 0);
  const march31 = new Date('2026-03-31');
  const monthsFrom = today > march31
    ? Math.ceil((today.getTime() - march31.getTime()) / (30 * 24 * 60 * 60 * 1000))
    : 0;
  const interest234b = advanceTaxRequired && totalPaid < netTaxAfterTds * 0.9
    ? Math.floor((netTaxAfterTds - totalPaid) * 0.01 * Math.max(1, monthsFrom))
    : 0;

  const totalOutstanding = Math.max(0, netTaxAfterTds - totalPaid) + interest234b + totalInterest234c;

  return {
    financial_year: '2025-26',
    regime,
    gross_income: calc.gross_total_income,
    total_deductions: calc.total_deductions_applied,
    taxable_income: calc.taxable_income,
    total_tax_liability: totalTax,
    tds_deducted: tdsDeducted,
    self_assessment_tax_paid: 0,
    advance_tax_required: advanceTaxRequired,
    installments,
    interest_234b: interest234b,
    interest_234c: totalInterest234c,
    total_outstanding: totalOutstanding,
  };
}
