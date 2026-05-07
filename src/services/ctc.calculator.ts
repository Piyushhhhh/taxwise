// CTC → Monthly Take-Home Decoder
// Handles standard Indian salary structure: Basic, HRA, LTA, Special allowance,
// Employer PF, Gratuity, and optional components.

export interface CTCInput {
  annual_ctc: number;

  // Salary structure — if not provided, we use standard industry defaults
  basic_percent?: number;        // % of CTC. Default: 40%
  hra_percent?: number;          // % of Basic. Default: 50% (metro) or 40% (non-metro)
  is_metro?: boolean;            // Affects HRA exemption. Default: true

  // Actual rent paid (for HRA exemption calculation)
  monthly_rent?: number;         // 0 = no rent/own house

  // Other inputs
  pf_employee_percent?: number;  // Default: 12% of basic (statutory)
  include_gratuity?: boolean;    // Deduct gratuity from CTC. Default: true
  lta_annual?: number;           // LTA component per year, default 5% of basic
  professional_tax?: number;     // Monthly professional tax. Default: 200
  other_monthly_deductions?: number; // Loans, etc.

  // Additional income for tax calculation
  other_income?: number;
  regime?: 'old' | 'new';
}

export interface SalaryComponent {
  name: string;
  annual: number;
  monthly: number;
  note?: string;
}

export interface CTCResult {
  annual_ctc: number;

  // Gross structure
  components: SalaryComponent[];

  // Key figures
  basic_annual: number;
  hra_annual: number;
  hra_exemption: number;    // actual HRA exempt from tax
  lta_annual: number;
  special_allowance: number;
  employer_pf: number;
  gratuity_annual: number;

  // Deductions from gross
  employee_pf: number;
  professional_tax_annual: number;
  income_tax_annual: number;

  // Take-home
  gross_monthly: number;
  gross_annual: number;
  net_monthly: number;
  net_annual: number;
  effective_tax_rate: number;

  // Breakdown for display
  deduction_breakdown: SalaryComponent[];
  regime: 'old' | 'new';
}

import { calculateTax } from './tax.calculator.js';

export function decodeCTC(input: CTCInput): CTCResult {
  const ctc         = input.annual_ctc;
  const basicPct    = (input.basic_percent ?? 40) / 100;
  const hraPct      = (input.hra_percent  ?? 50) / 100;
  const isMetro     = input.is_metro      ?? true;
  const monthlyRent = input.monthly_rent  ?? 0;
  const pfPct       = (input.pf_employee_percent ?? 12) / 100;
  const regime      = input.regime        ?? 'new';

  // ── Components ──
  // Gratuity is part of CTC but not take-home
  const gratuityRate   = 4.81 / 100;           // standard: 4.81% of basic
  const employerPfRate = 12 / 100;

  // Back-calculate basic: CTC = gross + employer_pf + gratuity
  // gross ≈ CTC - employer_pf - gratuity
  // basic = basicPct * gross  ← we approximate
  const basicAnnual       = Math.round(ctc * basicPct);
  const hraAnnual         = Math.round(basicAnnual * hraPct);
  const ltaAnnual         = Math.round(input.lta_annual ?? basicAnnual * 0.05);
  const employerPf        = Math.round(basicAnnual * employerPfRate);
  const gratuityAnnual    = Math.round(basicAnnual * gratuityRate);
  const specialAllowance  = Math.max(0, ctc - basicAnnual - hraAnnual - ltaAnnual - employerPf - gratuityAnnual);

  const grossAnnual = basicAnnual + hraAnnual + ltaAnnual + specialAllowance;

  // ── HRA Exemption (Section 10(13A)) ──
  // Least of:
  //   1. Actual HRA received
  //   2. Rent paid - 10% of basic
  //   3. 50% of basic (metro) / 40% (non-metro)
  const rentAnnual = monthlyRent * 12;
  const hraExemption = monthlyRent > 0
    ? Math.min(
        hraAnnual,
        Math.max(0, rentAnnual - basicAnnual * 0.10),
        basicAnnual * (isMetro ? 0.50 : 0.40),
      )
    : 0;

  // ── Employee deductions ──
  const employeePf         = Math.round(basicAnnual * pfPct);
  const professionalTaxAnnual = (input.professional_tax ?? 200) * 12;

  // ── Taxable salary (old regime) ──
  const stdDeduction       = regime === 'new' ? 75_000 : 50_000;
  const taxableHRA         = hraAnnual - hraExemption;
  const taxableSalary      = Math.max(0, grossAnnual - stdDeduction - hraExemption);

  const taxResult = calculateTax(
    {
      salary: grossAnnual,
      other_sources: input.other_income ?? 0,
      capital_gains_stcg: 0,
      capital_gains_ltcg: 0,
      house_property: 0,
    },
    regime === 'old'
      ? { section_80c: employeePf, section_80d: 0, section_80ccd1b: 0, section_24b: 0, other: 0 }
      : { section_80c: 0, section_80d: 0, section_80ccd1b: 0, section_24b: 0, other: 0 },
    regime,
  );

  const incomeTaxAnnual    = Math.round(taxResult.total_tax);
  const otherDeductionsAnn = (input.other_monthly_deductions ?? 0) * 12;

  // ── Net take-home ──
  const totalDeductions = employeePf + professionalTaxAnnual + incomeTaxAnnual + otherDeductionsAnn;
  const netAnnual       = Math.max(0, grossAnnual - totalDeductions);
  const netMonthly      = Math.round(netAnnual / 12);
  const grossMonthly    = Math.round(grossAnnual / 12);

  // ── Component list for UI ──
  const components: SalaryComponent[] = [
    { name: 'Basic Salary',      annual: basicAnnual,      monthly: Math.round(basicAnnual / 12) },
    { name: 'HRA',               annual: hraAnnual,        monthly: Math.round(hraAnnual / 12),   note: hraExemption > 0 ? `₹${Math.round(hraExemption/12).toLocaleString('en-IN')}/mo exempt` : 'No exemption (no rent)' },
    { name: 'LTA',               annual: ltaAnnual,        monthly: Math.round(ltaAnnual / 12),   note: 'Exempt 2x in 4yr block' },
    { name: 'Special Allowance', annual: specialAllowance, monthly: Math.round(specialAllowance / 12), note: 'Fully taxable' },
    { name: 'Employer PF',       annual: employerPf,       monthly: Math.round(employerPf / 12),  note: 'Part of CTC, not in hand' },
    { name: 'Gratuity',          annual: gratuityAnnual,   monthly: Math.round(gratuityAnnual / 12), note: 'Part of CTC, paid on exit' },
  ];

  const deductionBreakdown: SalaryComponent[] = [
    { name: 'Employee PF (12% of basic)', annual: employeePf,          monthly: Math.round(employeePf / 12) },
    { name: 'Professional Tax',           annual: professionalTaxAnnual, monthly: Math.round(professionalTaxAnnual / 12) },
    { name: `Income Tax (${regime} regime)`, annual: incomeTaxAnnual,  monthly: Math.round(incomeTaxAnnual / 12) },
  ];
  if (otherDeductionsAnn > 0) {
    deductionBreakdown.push({ name: 'Other Deductions', annual: otherDeductionsAnn, monthly: input.other_monthly_deductions! });
  }

  return {
    annual_ctc: ctc,
    components,
    basic_annual: basicAnnual,
    hra_annual: hraAnnual,
    hra_exemption: hraExemption,
    lta_annual: ltaAnnual,
    special_allowance: specialAllowance,
    employer_pf: employerPf,
    gratuity_annual: gratuityAnnual,
    employee_pf: employeePf,
    professional_tax_annual: professionalTaxAnnual,
    income_tax_annual: incomeTaxAnnual,
    gross_monthly: grossMonthly,
    gross_annual: grossAnnual,
    net_monthly: netMonthly,
    net_annual: netAnnual,
    effective_tax_rate: taxResult.effective_rate,
    deduction_breakdown: deductionBreakdown,
    regime,
  };
}
