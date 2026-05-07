// ─── Indian Tax Year ──────────────────────────────────────────────────────────
// Assessment Year e.g. "2025-26" means FY 2024-25

export type TaxRegime = 'old' | 'new';
export type IncomeCategory = 'salary' | 'other_sources' | 'capital_gains_stcg' | 'capital_gains_ltcg' | 'house_property';

// ─── Income ───────────────────────────────────────────────────────────────────

export interface IncomeBreakdown {
  // Salary
  salary: number;                       // Gross salary (before standard deduction)

  // House property
  house_property: number;               // Net annual value (negative = loss, max -2L deductible)

  // Capital gains
  capital_gains_stcg: number;           // Short-term CG u/s 111A (equity) — 20%
  capital_gains_ltcg: number;           // Long-term CG u/s 112A (equity) — 12.5% above ₹1.25L
  capital_gains_stcg_other: number;     // STCG other assets (debt MF, property etc.) — slab rate
  capital_gains_ltcg_other: number;     // LTCG other assets (property, debt MF) — 12.5%

  // Other sources
  interest_savings: number;             // Savings account interest (partially exempt u/s 80TTA)
  interest_fd: number;                  // FD/RD/post-office interest — fully taxable at slab
  dividends: number;                    // Dividends from shares/MFs — slab rate, TDS 10% if >5k
  other_sources: number;                // Family pension, gifts above ₹50k, any other

  // Special rate income
  lottery_winnings: number;             // Lottery/game show/crossword — 30% flat, no deductions
  crypto_vda: number;                   // Crypto/VDA — 30% flat + 1% TDS u/s 194S

  // Freelance / professional (non-presumptive)
  freelance_income: number;             // Gross professional receipts
  freelance_expenses: number;           // Allowable expenses against freelance

  // Agriculture (exempt but affects surcharge via partial integration)
  agriculture_income: number;           // Exempt u/s 10(1), but used for surcharge calc
}

// ─── Deductions (old regime unless noted) ────────────────────────────────────

export interface Deductions {
  // Chapter VI-A
  section_80c: number;                  // Max 1,50,000 — PPF, ELSS, LIC, PF etc.
  section_80ccc: number;                // Pension fund (sub-limit within 80C overall)
  section_80ccd1b: number;              // NPS additional — max 50,000 (beyond 80C limit)
  section_80ccd2: number;               // Employer NPS contribution — allowed in BOTH regimes
  section_80d: number;                  // Health insurance — self+family max 25k, parents extra 25k
  section_80d_senior: number;           // Additional 80D if parents are senior citizens (max 50k total)
  section_24b: number;                  // Home loan interest — max 2,00,000 (self-occupied)
  section_80tta: number;                // Savings interest — max 10,000 (non-senior)
  section_80ttb: number;                // Interest for seniors — max 50,000 (replaces 80TTA)
  section_80e: number;                  // Education loan interest — no limit, 8 yrs
  section_80eea: number;                // Affordable housing loan interest — max 1,50,000
  section_80g: number;                  // Donations — 50% or 100% depending on donee
  section_80gg: number;                 // Rent paid (if no HRA) — max 60,000/yr
  other: number;                        // Other deductions (80U, 80DD, 80DDB, etc.)
}

// ─── Advance Tax ─────────────────────────────────────────────────────────────

export interface AdvanceTaxInstallment {
  quarter: 1 | 2 | 3 | 4;
  due_date: string;
  cumulative_percent: number;
  tax_due: number;
  paid: number;
  shortfall: number;
  interest_234c: number;
  status: 'upcoming' | 'due' | 'paid' | 'overdue';
}

export interface AdvanceTaxSummary {
  financial_year: string;
  regime: TaxRegime;
  gross_income: number;
  total_deductions: number;
  taxable_income: number;
  total_tax_liability: number;
  tds_deducted: number;
  self_assessment_tax_paid: number;
  advance_tax_required: boolean;
  installments: AdvanceTaxInstallment[];
  interest_234b: number;
  interest_234c: number;
  total_outstanding: number;
}

// ─── Tax Calculation Result ───────────────────────────────────────────────────

export interface TaxSlabBreakdown {
  slab: string;
  rate: number;
  income_in_slab: number;
  tax: number;
}

export interface SpecialIncomeTax {
  stcg_111a: number;                    // STCG equity 20%
  ltcg_112a: number;                    // LTCG equity 12.5%
  stcg_other: number;                   // STCG other at slab
  ltcg_other: number;                   // LTCG other 12.5%
  lottery: number;                      // 30% flat
  crypto: number;                       // 30% flat
}

export interface TaxCalculationResult {
  regime: TaxRegime;
  taxable_income: number;               // Regular slab income
  gross_total_income: number;           // Before deductions
  total_deductions_applied: number;
  special_income_tax: SpecialIncomeTax;
  slab_breakdown: TaxSlabBreakdown[];
  income_tax: number;                   // Slab tax only
  surcharge: number;
  health_education_cess: number;
  total_tax: number;
  effective_rate: number;
  rebate_87a: number;
  regime_recommendation: {
    better: TaxRegime;
    saving: number;
    reason: string;
  };
}
