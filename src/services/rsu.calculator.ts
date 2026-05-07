// RSU Tax Calculator — FY 2025-26 (AY 2026-27)
// Handles India Residents holding foreign company stock (US MNCs, etc.)
//
// Two tax events:
//   1. VESTING  → Perquisite income u/s 17(2), taxed at slab rate
//   2. SALE     → Capital gains (foreign unlisted stock rules apply)
//                 < 24 months from vest → STCG at slab rate
//                 ≥ 24 months from vest → LTCG at 12.5% (no indexation, post Budget 2024)

export interface RSULot {
  lot_id:           string;   // e.g. "Q1-2024"
  vest_date:        string;   // YYYY-MM-DD
  shares_vested:    number;
  fmv_usd:          number;   // Fair Market Value per share at vest (USD)
  exchange_rate_vest: number; // SBI TT selling rate on vest date (INR per USD)
  exercise_price_usd: number; // Always 0 for RSUs, non-zero for ESOPs
  tds_deducted_inr: number;   // TDS already deducted by employer on perquisite
  employer_reported: boolean; // Whether this appeared in Form 16 as perquisite
}

export interface RSUSale {
  sale_date:        string;   // YYYY-MM-DD
  shares_sold:      number;
  sale_price_usd:   number;   // Per share
  exchange_rate_sale: number; // SBI TT selling rate on sale date
  us_tax_withheld_pct: number; // US supplemental withholding % (typically 22-37%)
  lot_id?:          string;   // Which lot these shares came from (for specific ID)
}

export interface RSUCalculatorInput {
  lots:             RSULot[];
  sales:            RSUSale[];
  slab_rate:        number;   // Marginal rate: 0.05, 0.10, 0.15, 0.20, 0.30
  surcharge_rate:   number;   // 0, 0.10, 0.15, 0.25, 0.37 based on income
  lot_matching:     'FIFO' | 'LIFO' | 'SPECIFIC'; // Default: FIFO
  dtaa_country:     'US' | 'UK' | 'OTHER'; // For DTAA credit calc
}

export interface RSULotTax {
  lot_id:            string;
  vest_date:         string;
  shares_vested:     number;
  fmv_inr:           number;   // fmv_usd × exchange_rate_vest
  perquisite_inr:    number;   // (fmv_usd - exercise_price_usd) × shares × rate
  tax_on_perquisite: number;   // perquisite × effective slab rate
  tds_already_paid:  number;
  tax_payable_on_vest: number; // net after TDS
}

export interface RSUSaleTax {
  sale_date:          string;
  shares_sold:        number;
  sale_price_inr:     number;   // sale_price_usd × exchange_rate_sale
  cost_basis_inr:     number;   // fmv at vest × shares (in INR) — this is the COST BASIS
  holding_months:     number;
  is_ltcg:            boolean;  // ≥ 24 months = LTCG
  capital_gain_inr:   number;   // sale_price_inr - cost_basis_inr
  tax_rate:           number;   // LTCG: 0.125, STCG: slab rate
  tax_on_gain:        number;
  us_tax_withheld_inr: number;
  dtaa_credit_inr:    number;   // min(us_tax, indian_tax) — relief u/s 90
  net_tax_payable:    number;   // tax_on_gain - dtaa_credit
  lot_breakdown:      { lot_id: string; shares: number; cost_basis_inr: number; gain_inr: number }[];
}

export interface RSUTaxSummary {
  // Perquisite summary (vesting events)
  total_perquisite_inr:       number;
  total_tax_on_perquisite:    number;
  total_tds_on_perquisite:    number;
  net_perquisite_tax_payable: number;

  // Capital gains summary (sale events)
  total_stcg_inr:     number;
  total_ltcg_inr:     number;
  tax_on_stcg:        number;
  tax_on_ltcg:        number;
  total_us_withheld:  number;
  total_dtaa_credit:  number;
  net_cg_tax_payable: number;

  // Grand total
  total_tax_payable:  number;

  // Per-lot and per-sale breakdown
  lot_taxes:   RSULotTax[];
  sale_taxes:  RSUSaleTax[];

  // ITR filing guidance
  itr_form:        'ITR-1' | 'ITR-2';  // RSU always needs ITR-2 (capital gains)
  schedules_needed: string[];           // e.g. ["Schedule FA", "Schedule FSI", "Schedule CG"]
  notes:            string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function monthsBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function effectiveSlabRate(slabRate: number, surchargeRate: number): number {
  // Tax + surcharge on tax + 4% cess
  const withSurcharge = slabRate * (1 + surchargeRate);
  return withSurcharge * 1.04;
}

// FIFO lot allocation: assign sold shares to lots in vest-date order
function allocateFIFO(
  lots: RSULot[],
  sales: RSUSale[]
): Map<string, { lot: RSULot; shares: number }[]> {
  // saleId → array of { lot, shares }
  const result = new Map<string, { lot: RSULot; shares: number }[]>();

  // Available shares per lot (mutable copy)
  const available = lots
    .slice()
    .sort((a, b) => new Date(a.vest_date).getTime() - new Date(b.vest_date).getTime())
    .map(l => ({ lot: l, remaining: l.shares_vested }));

  for (const sale of sales) {
    let toAllocate = sale.shares_sold;
    const allocations: { lot: RSULot; shares: number }[] = [];

    for (const entry of available) {
      if (toAllocate <= 0) break;
      if (entry.remaining <= 0) continue;
      // Only use lots vested before sale date
      if (new Date(entry.lot.vest_date) >= new Date(sale.sale_date)) continue;

      const use = Math.min(entry.remaining, toAllocate);
      allocations.push({ lot: entry.lot, shares: use });
      entry.remaining -= use;
      toAllocate -= use;
    }

    result.set(`${sale.sale_date}-${sale.shares_sold}`, allocations);
  }

  return result;
}

// ── Main calculator ───────────────────────────────────────────────────────────

export function calculateRSUTax(input: RSUCalculatorInput): RSUTaxSummary {
  const effRate = effectiveSlabRate(input.slab_rate, input.surcharge_rate);

  // ── Step 1: Perquisite tax per lot ──
  const lotTaxes: RSULotTax[] = input.lots.map(lot => {
    const fmvInr      = lot.fmv_usd * lot.exchange_rate_vest;
    const costInr     = lot.exercise_price_usd * lot.exchange_rate_vest;
    const perquisite  = (fmvInr - costInr) * lot.shares_vested;
    const taxOnPerq   = perquisite * effRate;
    const netPayable  = Math.max(0, taxOnPerq - lot.tds_deducted_inr);

    return {
      lot_id:              lot.lot_id,
      vest_date:           lot.vest_date,
      shares_vested:       lot.shares_vested,
      fmv_inr:             fmvInr,
      perquisite_inr:      perquisite,
      tax_on_perquisite:   taxOnPerq,
      tds_already_paid:    lot.tds_deducted_inr,
      tax_payable_on_vest: netPayable,
    };
  });

  // ── Step 2: Allocate sale shares to lots (FIFO default) ──
  const allocationMap = allocateFIFO(input.lots, input.sales);

  // ── Step 3: Capital gains per sale ──
  const saleTaxes: RSUSaleTax[] = input.sales.map(sale => {
    const saleKey    = `${sale.sale_date}-${sale.shares_sold}`;
    const allocations = allocationMap.get(saleKey) ?? [];

    const salePriceInr = sale.sale_price_usd * sale.exchange_rate_sale;
    const usTaxInr     = salePriceInr * sale.shares_sold * (sale.us_tax_withheld_pct / 100);

    let totalCostBasis = 0;
    let totalGain      = 0;
    const lotBreakdown: RSUSaleTax['lot_breakdown'] = [];

    for (const alloc of allocations) {
      const costPerShare = alloc.lot.fmv_usd * alloc.lot.exchange_rate_vest;
      const basisForAlloc = costPerShare * alloc.shares;
      const saleForAlloc  = salePriceInr * alloc.shares;
      const gain          = saleForAlloc - basisForAlloc;

      totalCostBasis += basisForAlloc;
      totalGain      += gain;

      lotBreakdown.push({
        lot_id:          alloc.lot.lot_id,
        shares:          alloc.shares,
        cost_basis_inr:  basisForAlloc,
        gain_inr:        gain,
      });
    }

    // Holding period — use oldest lot's vest date for FIFO
    const oldestVest = allocations[0]?.lot.vest_date ?? sale.sale_date;
    const holdingMonths = monthsBetween(oldestVest, sale.sale_date);
    const isLTCG = holdingMonths >= 24;

    // Tax rate on gain
    // LTCG on foreign unlisted stock: 12.5% (no indexation, post Budget 2024)
    // STCG: taxed at slab rate (as normal income)
    const gainTaxRate = isLTCG ? 0.125 : input.slab_rate;
    const taxableGain = isLTCG ? Math.max(0, totalGain) : Math.max(0, totalGain);
    const taxOnGain   = taxableGain * gainTaxRate * (1 + (isLTCG ? 0 : input.surcharge_rate)) * 1.04;

    // DTAA credit: credit for US withholding against Indian tax
    // Under Article 13 of India-US DTAA, gains on shares taxable in both.
    // Credit = min(US tax paid, Indian tax on that income)
    const dtaaCredit = input.dtaa_country === 'US'
      ? Math.min(usTaxInr, taxOnGain)
      : 0;

    return {
      sale_date:           sale.sale_date,
      shares_sold:         sale.shares_sold,
      sale_price_inr:      salePriceInr,
      cost_basis_inr:      totalCostBasis,
      holding_months:      holdingMonths,
      is_ltcg:             isLTCG,
      capital_gain_inr:    totalGain,
      tax_rate:            gainTaxRate,
      tax_on_gain:         taxOnGain,
      us_tax_withheld_inr: usTaxInr,
      dtaa_credit_inr:     dtaaCredit,
      net_tax_payable:     Math.max(0, taxOnGain - dtaaCredit),
      lot_breakdown:       lotBreakdown,
    };
  });

  // ── Step 4: Totals ──
  const totalPerquisite   = lotTaxes.reduce((s, l) => s + l.perquisite_inr, 0);
  const totalTaxOnPerq    = lotTaxes.reduce((s, l) => s + l.tax_on_perquisite, 0);
  const totalTDS          = lotTaxes.reduce((s, l) => s + l.tds_already_paid, 0);
  const netPerqTax        = lotTaxes.reduce((s, l) => s + l.tax_payable_on_vest, 0);

  const stcgSales  = saleTaxes.filter(s => !s.is_ltcg);
  const ltcgSales  = saleTaxes.filter(s =>  s.is_ltcg);
  const totalSTCG  = stcgSales.reduce((s, x) => s + x.capital_gain_inr, 0);
  const totalLTCG  = ltcgSales.reduce((s, x) => s + x.capital_gain_inr, 0);
  const taxSTCG    = stcgSales.reduce((s, x) => s + x.tax_on_gain, 0);
  const taxLTCG    = ltcgSales.reduce((s, x) => s + x.tax_on_gain, 0);
  const totalUS    = saleTaxes.reduce((s, x) => s + x.us_tax_withheld_inr, 0);
  const totalDTAA  = saleTaxes.reduce((s, x) => s + x.dtaa_credit_inr, 0);
  const netCGTax   = saleTaxes.reduce((s, x) => s + x.net_tax_payable, 0);

  // ── Step 5: ITR guidance ──
  const schedules = ['Schedule CG (Capital Gains)'];
  if (input.lots.length > 0) schedules.push('Schedule FA (Foreign Assets — disclose RSU holdings)');
  if (totalDTAA > 0)         schedules.push('Schedule FSI (Foreign Source Income — for DTAA credit)');
  if (totalDTAA > 0)         schedules.push('Schedule TR (Tax Relief — DTAA credit claim)');

  const notes: string[] = [];

  if (!input.lots.every(l => l.employer_reported)) {
    notes.push('Some vesting events may not be in your Form 16. Report them separately as perquisite income.');
  }
  if (ltcgSales.length > 0) {
    notes.push('Foreign unlisted stocks held ≥ 24 months qualify for LTCG at 12.5% (without indexation) under the Finance Act 2024.');
  }
  if (totalDTAA > 0) {
    notes.push(`DTAA credit of ₹${Math.round(totalDTAA).toLocaleString('en-IN')} claimed against US withholding. Attach Form 67 before filing ITR.`);
  }
  notes.push('Exchange rates used must be SBI TT selling rate on the respective dates. Keep proof of these rates.');
  notes.push('RSU holdings abroad must be disclosed in Schedule FA even if no tax is payable.');

  return {
    total_perquisite_inr:       totalPerquisite,
    total_tax_on_perquisite:    totalTaxOnPerq,
    total_tds_on_perquisite:    totalTDS,
    net_perquisite_tax_payable: netPerqTax,
    total_stcg_inr:     totalSTCG,
    total_ltcg_inr:     totalLTCG,
    tax_on_stcg:        taxSTCG,
    tax_on_ltcg:        taxLTCG,
    total_us_withheld:  totalUS,
    total_dtaa_credit:  totalDTAA,
    net_cg_tax_payable: netCGTax,
    total_tax_payable:  netPerqTax + netCGTax,
    lot_taxes:          lotTaxes,
    sale_taxes:         saleTaxes,
    itr_form:           'ITR-2',
    schedules_needed:   schedules,
    notes,
  };
}
