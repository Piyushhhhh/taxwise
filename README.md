# TaxWise — Indian Tax Calculator for Salaried Employees & RSU Holders

**Free, accurate Indian income tax calculator for FY 2025–26.** Built for salaried professionals at tech companies — especially those with RSUs, ESOPs, and US equity compensation.

🌐 **Live at [taxwise-one.vercel.app](https://taxwise-one.vercel.app)**

---

## Who Is This For?

- Salaried employees trying to choose between **old vs new tax regime**
- Tech professionals with **RSUs or ESOPs** who need perquisite tax + capital gains calculation
- Anyone who wants to **upload Form 16 or 26AS** and get their tax computed instantly
- People navigating a **layoff** who need to know exactly what equity they keep
- Employees wanting a **pre-filled ITR-1 Excel** ready to upload to the IT portal

---

## Features

### Tax Calculation
- **Calculate Tax** — Full slab-wise breakdown for FY 2025–26. Salary, capital gains (STCG/LTCG equity, debt, property), crypto (30%), lottery, freelance income, house property
- **Compare Regimes** — Old vs new regime side-by-side with a personalised recommendation
- **Advance Tax** — Quarterly installment schedule (Jun / Sep / Dec / Mar) with 234B & 234C interest calculation
- **Tax Optimizer** — Shows exactly how much more to invest in 80C, 80D, NPS to reduce your tax liability

### Salary & CTC Tools
- **CTC Decoder** — Breaks your annual CTC into monthly take-home: PF, HRA exemption, gratuity, professional tax, income tax
- **Hike Simulator** — Enter current and new CTC; see exactly how much extra lands in your pocket vs how much goes to tax

### RSU & Equity
- **RSU Tax Calculator** — Perquisite tax at vesting (slab rate) + capital gains at sale (STCG/LTCG), FIFO/LIFO/specific lot matching, DTAA credit for US withholding
- **RSU Guide** — End-to-end guide: how RSUs are taxed, Form 67 filing sequence, Schedule FA/CG/FSI/TR in ITR-2, US estate tax trap, RNOR window planning
- **Layoff Simulator** — Enter your termination date and vest schedule; get instant calculation of shares kept vs forfeited, tax owed, net cash, and an AI-generated negotiation brief

### Document Intelligence
- **Upload Form 16 / 26AS / Salary Slip / Capital Gains Statement** — AI parses your documents and auto-fills the tax form. Supports PDF, JPEG, PNG, WEBP (up to 10 MB)
- **Upload Broker Statement** — Auto-extract RSU lot data from E*Trade / Schwab / Fidelity / Form W-2
- **Analyze Separation Agreement** — Upload your layoff separation agreement PDF; AI flags equity clauses, waivers, and what to negotiate

### Filing Tools
- **ITR Form Finder** — 5-question wizard that tells you exactly which ITR form to file (ITR-1, 2, 3, or 4) and why
- **Pre-fill ITR-1** — Fill in your details, download the official IT Dept Excel utility pre-filled with your data, enable macros, click "Generate XML", upload to incometax.gov.in

### AI Tools
- **TaxWise AI** — Ask any Indian tax question in plain English. Powered by Gemini.
- **AI Negotiation Brief** — For layoffs: generates a personalised negotiation script based on your vest schedule, cliff proximity, and acceleration policy

---

## Screenshots

### Document Upload & Auto-Parse
Upload Form 16, Capital Gains Statement, Home Loan certificate, salary slip — TaxWise extracts all values and applies them to your tax calculation automatically.

![TaxWise document upload and tax calculation](assets/image.png)

### RSU Layoff Simulator with AI Brief
Enter your termination date and vest schedule. See every lot's fate instantly, get an AI negotiation brief, and analyze your separation agreement.

![TaxWise layoff simulator and AI negotiation brief](assets/image%20copy.png)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 + TypeScript |
| Framework | Express 5 |
| AI | Google Gemini (`gemini-2.5-flash-lite`) |
| Validation | Zod |
| Excel | ExcelJS |
| Deploy | Vercel (serverless) / Railway / Fly.io / Docker |

---

## Self-Hosting

```bash
git clone https://github.com/Piyushhhhh/taxwise
cd taxwise
npm install
cp .env.example .env       # add GEMINI_API_KEY
npm run dev                # http://localhost:4000
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes (AI features) | Google AI Studio key — get free at aistudio.google.com |
| `PORT` | No | Defaults to `4000` |
| `GEMINI_MODEL` | No | Defaults to `gemini-2.5-flash-lite` |

### Docker

```bash
docker build -t taxwise .
docker run -p 8080:8080 --env-file .env taxwise
```

**Railway / Fly.io** — `railway.toml` and `fly.toml` are included. Add `GEMINI_API_KEY` in the platform dashboard.

---

## API Reference

All endpoints are under `/api/tax`. See below for the full reference.

<details>
<summary><strong>POST /api/tax/calculate</strong> — Full tax calculation</summary>

```json
{
  "income": {
    "salary": 2400000,
    "capital_gains_ltcg": 100000,
    "interest_fd": 50000
  },
  "deductions": { "section_80c": 150000, "section_80d": 25000 },
  "regime": "new"
}
```
</details>

<details>
<summary><strong>POST /api/tax/compare</strong> — Old vs new regime comparison</summary>

Same body as `/calculate`. Returns both regimes side-by-side with a recommendation.
</details>

<details>
<summary><strong>POST /api/tax/advance</strong> — Advance tax schedule</summary>

```json
{
  "income": { "salary": 2000000 },
  "deductions": {},
  "regime": "new",
  "tds_deducted": 100000,
  "paid_installments": { "1": 0, "2": 0, "3": 0, "4": 0 }
}
```
</details>

<details>
<summary><strong>POST /api/tax/optimize</strong> — Tax savings opportunities</summary>

Same body as `/calculate`. Returns how much more to invest in each section to minimise tax.
</details>

<details>
<summary><strong>POST /api/tax/ctc</strong> — CTC to take-home decoder</summary>

```json
{
  "annual_ctc": 2000000,
  "basic_percent": 40,
  "hra_percent": 50,
  "is_metro": true,
  "monthly_rent": 30000,
  "regime": "new"
}
```
</details>

<details>
<summary><strong>POST /api/tax/hike</strong> — Salary hike simulator</summary>

```json
{
  "current_ctc": 1500000,
  "new_ctc": 2000000,
  "regime": "new"
}
```
</details>

<details>
<summary><strong>POST /api/tax/rsu</strong> — RSU perquisite + capital gains tax</summary>

```json
{
  "lots": [{
    "lot_id": "L1",
    "vest_date": "2024-03-15",
    "shares_vested": 50,
    "fmv_usd": 180.00,
    "exchange_rate_vest": 83.5,
    "tds_deducted_inr": 120000
  }],
  "sales": [{
    "sale_date": "2024-09-01",
    "shares_sold": 20,
    "sale_price_usd": 210.00,
    "exchange_rate_sale": 84.0,
    "us_tax_withheld_pct": 15
  }],
  "slab_rate": 0.30,
  "lot_matching": "FIFO",
  "dtaa_country": "US"
}
```
</details>

<details>
<summary><strong>POST /api/tax/parse-document</strong> — Upload Form 16 / 26AS / salary slip</summary>

`multipart/form-data` with field `document` (PDF/JPEG/PNG/WEBP, max 10 MB). Returns structured income and deduction data.
</details>

<details>
<summary><strong>POST /api/tax/rsu/parse</strong> — Parse broker statement for RSU data</summary>

`multipart/form-data` with field `document`. Returns structured vest lot data.
</details>

<details>
<summary><strong>POST /api/tax/itr-prefill</strong> — Download pre-filled ITR-1 Excel</summary>

Returns an `.xlsx` file. Required fields: `first_name`, `last_name`, `pan`, `dob` (DD/MM/YYYY), `mobile`, `email`, `gross_salary`.
</details>

<details>
<summary><strong>POST /api/tax/layoff-brief</strong> — AI layoff negotiation brief</summary>

```json
{
  "company_type": "US MNC India subsidiary",
  "termination_date": "2025-09-16",
  "total_unvested": 400,
  "shares_accelerated": 64,
  "shares_forfeited": 336,
  "gross_value_inr": 113668022,
  "tax_inr": 78210000,
  "accel_policy": "pro-rata"
}
```
</details>

<details>
<summary><strong>POST /api/tax/layoff-agreement</strong> — Analyze separation agreement PDF</summary>

`multipart/form-data` with field `document`. Returns AI analysis of equity clauses, waivers, and negotiation points.
</details>

<details>
<summary><strong>POST /api/tax/ask</strong> — AI tax advisor</summary>

```json
{ "question": "Should I invest in NPS to save tax under the new regime?" }
```
</details>

<details>
<summary><strong>GET /api/tax/fx-rate</strong> — Historical exchange rate</summary>

`?date=2024-03-15&from=USD&to=INR` — Uses ECB/Frankfurter, no API key needed.
</details>

<details>
<summary><strong>GET /api/tax/stock-price</strong> — Live stock price</summary>

`?ticker=GOOGL` — Via Yahoo Finance.
</details>

<details>
<summary><strong>GET /health</strong> — Health check</summary>

Returns `{ "status": "ok", "service": "taxwise" }`.
</details>

---

## Common Questions

**Is this accurate for FY 2025–26?**
Yes. Tax slabs, surcharge thresholds, LTCG rates (12.5% post-Budget 2024), STCG equity rates (20%), crypto at 30%, and 87A rebate limits are all updated for AY 2026–27.

**Do I need a Gemini API key?**
Only for AI features: document parsing, the AI advisor, layoff brief, and separation agreement analysis. All calculators work without it.

**Can I use this to actually file my ITR?**
The Pre-fill ITR-1 tool generates the official IT Department Excel utility pre-filled with your data. You still need to open it in Excel, enable macros, generate XML, and upload to incometax.gov.in yourself.

**What about RSU holders in the US?**
The RSU guide covers NRI scenarios: W-2 income, FBAR obligations, California source tax, RNOR window planning, and US estate tax exposure.

---

## License

MIT
