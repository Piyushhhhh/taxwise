<div align="center">

<img src="https://img.shields.io/badge/FY%202025–26-Updated-brightgreen?style=flat-square" alt="FY 2025-26" />
<img src="https://img.shields.io/badge/Built%20with-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/AI-Gemini%202.5-4285F4?style=flat-square&logo=google&logoColor=white" alt="Gemini" />
<img src="https://img.shields.io/badge/Deploy-Vercel-black?style=flat-square&logo=vercel&logoColor=white" alt="Vercel" />
<img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT" />

# TaxWise

### Indian Income Tax Calculator for FY 2025–26

**The only tax tool built for tech professionals — RSUs, Form 16 upload, layoff simulator, AI advisor, and pre-filled ITR-1. Free, accurate, no login.**

[**→ Open TaxWise**](https://taxwise-one.vercel.app)

</div>

---

## Who is this for?

| | |
|---|---|
| **RSU / ESOP holders** | Calculate perquisite tax at vesting, capital gains at sale, and DTAA credit for US withholding — all in one place |
| **Tech employees navigating a layoff** | See exactly which shares you keep, what you owe in tax, and get an AI-generated negotiation brief |
| **Anyone with Form 16 or 26AS** | Upload your document — AI reads it and fills your entire tax form automatically |
| **People filing ITR for the first time** | 5-question wizard tells you which form to file, then generates a pre-filled Excel ready to upload |
| **Salaried employees on old or new regime** | Side-by-side comparison with a personalised recommendation based on your actual numbers |

---

## Screenshots

### Upload Form 16 → Instant Tax Calculation
Drop in your Form 16, salary slip, capital gains statement, or home loan certificate. AI extracts every number and applies it to your tax calculation — no manual entry needed.

![TaxWise document upload and auto-parsed tax calculation](assets/image.png)

### Layoff Simulator + AI Negotiation Brief
Enter your termination date and vest schedule. See every lot's fate in real time — shares kept, shares forfeited, tax owed, net cash. Get an AI brief written specifically for your numbers to help you negotiate.

![TaxWise layoff simulator with AI negotiation brief](assets/image%20copy.png)

---

## Features

### Calculate & Compare
- **Tax Calculator** — Slab-wise breakdown covering salary, STCG/LTCG (equity, debt, property), crypto (30%), lottery, freelance, dividends, and house property for FY 2025–26
- **Regime Comparison** — Old vs new regime side-by-side with a data-driven recommendation
- **Advance Tax Planner** — Quarterly schedule (Jun / Sep / Dec / Mar) with 234B & 234C interest
- **Tax Optimizer** — Tells you exactly how much more to invest in 80C, 80D, and NPS to reach the optimal deduction

### Salary & CTC
- **CTC Decoder** — Enter your annual CTC; get your exact monthly take-home after PF, HRA exemption, gratuity, professional tax, and income tax
- **Hike Simulator** — See how much of a raise actually reaches your account vs how much goes to the government

### RSU & Equity
- **RSU Tax Calculator** — Perquisite tax at vesting + capital gains at sale, with FIFO/LIFO/specific lot matching and DTAA credit for US withholding
- **RSU Guide** — Everything an India-resident RSU holder needs: Form 67 sequence, ITR-2 schedules (FA, CG, FSI, TR), US estate tax trap, RNOR window planning, and annual compliance checklist
- **Layoff Simulator** — Real-time calculation of kept vs forfeited shares, pro-rata acceleration, cliff alerts, and AI negotiation brief

### Document Intelligence
- **Form 16 / 26AS / Salary Slip Upload** — AI parses and auto-fills your tax form (PDF, JPEG, PNG, WEBP — up to 10 MB)
- **Broker Statement Parser** — Extracts RSU lot data from E*Trade, Schwab, Fidelity, Form W-2, or Form 16
- **Separation Agreement Analyzer** — Upload your layoff PDF; AI flags equity clauses, waivers, and what to push back on

### Filing
- **ITR Form Finder** — 5-question wizard: are you ITR-1, 2, 3, or 4? Get the answer with an explanation
- **Pre-fill ITR-1** — Fill your details, download the official IT Dept Excel utility with everything pre-filled, click "Generate XML", upload to incometax.gov.in

### AI
- **TaxWise AI Advisor** — Ask anything about Indian income tax in plain English, powered by Gemini
- **AI Negotiation Brief** — Layoff-specific: generates a personalised negotiation script based on your cliff proximity, acceleration policy, and vest schedule

---

## Common Questions

<details>
<summary><b>Is this accurate for FY 2025–26?</b></summary>

Yes. Tax slabs, surcharge thresholds, LTCG rates (12.5% post-Budget 2024), STCG equity rates (20%), crypto at 30%, and the 87A rebate limit are all updated for AY 2026–27.
</details>

<details>
<summary><b>Do I need to create an account?</b></summary>

No. No login, no signup, no data stored on servers. Everything runs in your browser.
</details>

<details>
<summary><b>Can I actually use this to file my ITR?</b></summary>

The Pre-fill ITR-1 tool generates the official IT Department Excel utility with your data filled in. Open it in Excel, enable macros, click "Generate XML", and upload the file to incometax.gov.in. You stay in control of the actual filing.
</details>

<details>
<summary><b>Do I need a Gemini API key to use it?</b></summary>

Only for AI features — document parsing, the AI advisor, layoff brief, and separation agreement analysis. All calculators, regime comparison, advance tax, CTC decoder, RSU calculator, and ITR tools work without any API key.
</details>

<details>
<summary><b>I hold RSUs and live in the US. Is this useful for me?</b></summary>

Yes. The RSU guide covers NRI scenarios: W-2 income reporting, FBAR obligations, California source tax, RNOR window planning for returning Indians, and US estate tax exposure (the $60K NRA exemption most Indians don't know about).
</details>

---

## Self-Hosting

```bash
git clone https://github.com/Piyushhhhh/taxwise
cd taxwise
npm install
cp .env.example .env    # add GEMINI_API_KEY
npm run dev             # http://localhost:4000
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | For AI features | Free at [aistudio.google.com](https://aistudio.google.com) |
| `PORT` | No | Defaults to `4000` |
| `GEMINI_MODEL` | No | Defaults to `gemini-2.5-flash-lite` |

### Docker

```bash
docker build -t taxwise .
docker run -p 8080:8080 --env-file .env taxwise
```

`railway.toml` and `fly.toml` are included for one-click Railway / Fly.io deploys.

---

## API Reference

All endpoints live under `/api/tax`.

<details>
<summary><b>POST /api/tax/calculate</b> — Full tax calculation</summary>

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
<summary><b>POST /api/tax/compare</b> — Old vs new regime side-by-side</summary>

Same body as `/calculate`. Returns both regimes with a recommendation.
</details>

<details>
<summary><b>POST /api/tax/advance</b> — Advance tax schedule</summary>

```json
{
  "income": { "salary": 2000000 },
  "regime": "new",
  "tds_deducted": 100000,
  "paid_installments": { "1": 0, "2": 0, "3": 0, "4": 0 }
}
```
</details>

<details>
<summary><b>POST /api/tax/optimize</b> — Tax savings opportunities</summary>

Same body as `/calculate`. Returns how much more to invest per section to minimise tax.
</details>

<details>
<summary><b>POST /api/tax/ctc</b> — CTC to take-home breakdown</summary>

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
<summary><b>POST /api/tax/hike</b> — Salary hike impact</summary>

```json
{
  "current_ctc": 1500000,
  "new_ctc": 2000000,
  "regime": "new"
}
```
</details>

<details>
<summary><b>POST /api/tax/rsu</b> — RSU perquisite + capital gains</summary>

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
<summary><b>POST /api/tax/parse-document</b> — Upload Form 16 / 26AS / salary slip</summary>

`multipart/form-data`, field `document` (PDF/JPEG/PNG/WEBP, max 10 MB). Returns structured income and deduction data.
</details>

<details>
<summary><b>POST /api/tax/rsu/parse</b> — Parse broker statement</summary>

`multipart/form-data`, field `document`. Returns structured RSU lot data.
</details>

<details>
<summary><b>POST /api/tax/itr-prefill</b> — Download pre-filled ITR-1 Excel</summary>

Returns `.xlsx`. Required: `first_name`, `last_name`, `pan`, `dob` (DD/MM/YYYY), `mobile`, `email`, `gross_salary`.
</details>

<details>
<summary><b>POST /api/tax/layoff-brief</b> — AI negotiation brief</summary>

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
<summary><b>POST /api/tax/layoff-agreement</b> — Analyze separation agreement PDF</summary>

`multipart/form-data`, field `document`. Returns AI analysis: equity clauses, waivers, negotiation points.
</details>

<details>
<summary><b>POST /api/tax/ask</b> — AI tax advisor</summary>

```json
{ "question": "Should I invest in NPS to save tax under the new regime?" }
```
</details>

<details>
<summary><b>GET /api/tax/fx-rate?date=YYYY-MM-DD&from=USD&to=INR</b> — Historical FX rate</summary>

Free, no API key. Powered by ECB via Frankfurter.app.
</details>

<details>
<summary><b>GET /api/tax/stock-price?ticker=GOOGL</b> — Live stock price</summary>

Via Yahoo Finance.
</details>

---

## Tech Stack

| | |
|---|---|
| **Runtime** | Node.js 20 + TypeScript |
| **Framework** | Express 5 |
| **AI** | Google Gemini 2.5 Flash |
| **Validation** | Zod |
| **Excel** | ExcelJS |
| **Deploy** | Vercel · Railway · Fly.io · Docker |

---

## License

MIT — free to use, self-host, and build on.
