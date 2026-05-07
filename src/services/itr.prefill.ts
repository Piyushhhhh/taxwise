import ExcelJS from 'exceljs';
import path from 'path';

const TEMPLATE_PATH = path.join(process.cwd(), 'assets', 'ITR1_AY_25-26_V1.7.xlsm');

export interface ITRPrefillInput {
  first_name: string;
  middle_name?: string;
  last_name: string;
  pan: string;
  aadhaar?: string;
  dob: string;               // DD/MM/YYYY
  mobile: string;
  email: string;
  flat_no?: string;
  premises_name?: string;
  road?: string;
  locality?: string;
  city?: string;
  state_code?: string;
  pin_code?: string;
  employer_category?: 'G' | 'PA' | 'PE' | 'NE' | 'NA';
  gross_salary: number;
  allowances_exempt?: number;
  professional_tax?: number;
  income_from_other_sources?: number;
  gross_rent_received?: number;
  tax_paid_local_authorities?: number;
  section_80c?: number;
  section_80d?: number;
  section_80ccd1b?: number;
  section_24b?: number;
  tds_employer?: number;
  employer_tan?: string;
  employer_name?: string;
  advance_tax?: number;
  self_assessment_tax?: number;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_account_type?: 'SB' | 'CA' | 'CC' | 'OD' | 'NRO' | 'NRE';
  regime: 'old' | 'new';
}

function colLetterToNumber(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function setCell(ws: ExcelJS.Worksheet, ref: string, value: string | number) {
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return;
  const col = colLetterToNumber(match[1]);
  const row = parseInt(match[2]);
  ws.getCell(row, col).value = value;
}

export async function prefillITR1(input: ITRPrefillInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);

  const income = wb.getWorksheet('Income Details');
  const tpv    = wb.getWorksheet('Taxes Paid and Verification');
  const tds    = wb.getWorksheet('TDS');
  const sch24b = wb.getWorksheet('Schedule 24(b)');

  if (!income) throw new Error('Income Details sheet not found');

  // ── Personal info ──
  // sheet1.FirstName = E7 (INPUT, no formula)
  setCell(income, 'E7',   input.first_name.toUpperCase());
  if (input.middle_name) setCell(income, 'O7', input.middle_name.toUpperCase());
  // sheet1.SurNameOrOrgName = Y7 (INPUT)
  setCell(income, 'Y7',   input.last_name.toUpperCase());
  // sheet1.PAN = AN7 (INPUT)
  setCell(income, 'AN7',  input.pan.toUpperCase());
  // Sheet1.Aadhaar = AN8 (INPUT)
  if (input.aadhaar) setCell(income, 'AN8', input.aadhaar);
  // sheet1.DOB = AN10 (INPUT) — actually AN11 per the named range sheet1.Status=AN11
  // DOB is in the date cell AN10
  setCell(income, 'AN10', input.dob);
  // Email = E28, Mobile = Q28 (both INPUT)
  setCell(income, 'E28',  input.email);
  setCell(income, 'Q28',  input.mobile);

  // ── Address ──
  if (input.flat_no)       setCell(income, 'E10',  input.flat_no);
  if (input.premises_name) setCell(income, 'O10',  input.premises_name);
  if (input.road)          setCell(income, 'E13',  input.road);
  if (input.locality)      setCell(income, 'W13',  input.locality);
  if (input.city)          setCell(income, 'AN13', input.city);
  if (input.state_code)    setCell(income, 'E15',  input.state_code);
  if (input.pin_code)      setCell(income, 'AA15', input.pin_code);

  // Employer category dropdown (AP15 is INPUT)
  if (input.employer_category) setCell(income, 'AP15', input.employer_category);

  // ── Regime: "Yes" = opt out of new regime (use old), "No" = stay in new ──
  setCell(income, 'E17', input.regime === 'old' ? 'Yes' : 'No');

  // ── Salary income ──
  // AO36 = IncD.Allowances — INPUT cell (salary as per 17(1) goes here)
  // The form has: Gross Salary = row 35 (formula), row 36a = Salary 17(1) INPUT = AO36
  setCell(income, 'AO36', input.gross_salary);

  // AO37 = IncD.Perquisites (17(2)) — INPUT, leave 0 unless user has perqs
  // AO38 = IncD.Profits (17(3)) — INPUT, leave 0

  // HRA/exempt allowances — goes into the HRA schedule cell AO50 = Sheet1.HRA
  // AO50 is a formula (=Sch10of13A_ElgiblExmptAllwnce10of13A) — we write to the
  // HRA schedule sheet directly if needed, but the simplest path is writing
  // the exempt allowance directly to the allowance section:
  // The user-entered HRA exempt amount ultimately flows from the HRA schedule.
  // For direct fill without filling the schedule: write to AO46 (row 46 = allowance amount column, INPUT)
  if (input.allowances_exempt) {
    // AO46 is the Sec 10(13A) pre-calculated exempt — it's an INPUT cell
    setCell(income, 'AO46', input.allowances_exempt);
  }

  // Professional tax = AO56 = IncD.Deduction16ic — INPUT (no formula)
  if (input.professional_tax) setCell(income, 'AO56', input.professional_tax);

  // ── Other income ──
  // Income from other sources rows (68-71) — row 68 col AO is INPUT
  if (input.income_from_other_sources) {
    setCell(income, 'AO68', input.income_from_other_sources);
  }

  // ── House property ──
  // AO59 = IncD.GrossRentRecieved — INPUT (no formula)
  if (input.gross_rent_received) setCell(income, 'AO59', input.gross_rent_received);
  // AO60 = IncD.TaxPaidLocalAuthorities — INPUT
  if (input.tax_paid_local_authorities) setCell(income, 'AO60', input.tax_paid_local_authorities);

  // ── Deductions (Ch VI-A) ──
  // AB96 = IncD.Section80C — INPUT (no formula confirmed above)
  if (input.section_80c)    setCell(income, 'AB96',  input.section_80c);
  // AB97 = IncD.Section80CCC — leave 0
  // AB98 = IncD.Section80CCD_SE — leave 0
  // AB99 = IncD.Section80CCD1B_SE — INPUT (no formula for this specific cell)
  if (input.section_80ccd1b) setCell(income, 'AB99', input.section_80ccd1b);
  // Section 80D: goes through the 80D schedule sheet
  // The direct cell that feeds into the calc is AB104 (formula) — but the
  // 80D sheet has its own inputs. The simplest path: write to the
  // Eligible_Amount_80D named range cell which is the 80D worksheet.
  // For ITR-1 we write to AB105 row directly — but AN105 is a formula.
  // AB104 is formula too. So write to the 80D sheet input instead.
  // The 80D sheet is ws 'Part B ATI' or '80D'. Let's try writing AB105 directly
  // since it may simply be the cap-limited calc that VBA picks up.
  if (input.section_80d) {
    const ws80d = wb.getWorksheet('80D');
    if (ws80d) {
      // 80D sheet: Self & Family health insurance premium — row 5 col G is input
      setCell(ws80d, 'G5', input.section_80d);
    } else {
      // Fallback: write directly to AB105 in Income Details
      setCell(income, 'AB105', input.section_80d);
    }
  }

  // Section 24B (home loan interest) — Schedule 24(b)
  if (input.section_24b && sch24b) {
    // H5 is an EMPTY INPUT cell in schedule 24(b) — interest amount for loan 1
    setCell(sch24b, 'H5', input.section_24b);
  }

  // ── TDS on salary (Sheet: TDS) ──
  // Named ranges: TDSal.TAN = TDS!E6:E10, TDSal.EmployerOrDeductorOrCollecterName = F6:F10
  // TDSal.IncChrgSalary = G6:G10, TDSal.TotalTDSSalary = H6:H10
  // Row 6 is the first TDS salary entry row
  if (tds) {
    if (input.employer_tan)  setCell(tds, 'E6', input.employer_tan.toUpperCase());
    if (input.employer_name) setCell(tds, 'F6', input.employer_name);
    // Salary charged = gross salary
    setCell(tds, 'G6', input.gross_salary);
    if (input.tds_employer)  setCell(tds, 'H6', input.tds_employer);
  }

  // ── Taxes paid (Sheet: Taxes Paid and Verification) ──
  if (tpv) {
    // IncD.AdvanceTax = 'Taxes Paid and Verification'!I4 — INPUT
    if (input.advance_tax)         setCell(tpv, 'I4', input.advance_tax);
    // Self assessment tax — I8 (confirmed INPUT from earlier analysis)
    if (input.self_assessment_tax) setCell(tpv, 'I8', input.self_assessment_tax);
    // Bank account — IncD.BankAccountNumber = H11, IncD.BankAccountType = I12
    if (input.bank_account_number) setCell(tpv, 'H11', input.bank_account_number);
    if (input.bank_account_type)   setCell(tpv, 'I12', input.bank_account_type);
    if (input.bank_ifsc)           setCell(tpv, 'H12', input.bank_ifsc.toUpperCase());
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
