# TaxWise

Indian tax calculation API for salaried employees with RSU/equity compensation. Built with TypeScript + Express.

## Features

- **Tax calculation** — Old vs new regime comparison, slab-based tax with surcharge & cess
- **Advance tax** — Quarterly installment schedule with TDS credit
- **Tax optimizer** — Suggests deductions to minimize liability under both regimes
- **CTC decoder** — Breaks down annual CTC into take-home, PF, HRA, gratuity
- **Hike simulator** — Shows tax impact of a salary hike before/after
- **RSU tax** — Perquisite tax at vest + capital gains at sale, FIFO/LIFO/specific lot matching, DTAA (US/UK)
- **Document parsing** — Upload Form 16, 26AS, or salary slips (PDF/image) to extract income data via Gemini
- **ITR-1 prefill** — Downloads a pre-filled ITR-1 Excel utility (AY 2025-26)
- **Layoff tools** — Negotiation brief + separation agreement analysis for RSU holders
- **AI advisor** — Ask free-form tax questions, answered by Gemini
- **FX rate** — Historical USD/INR (and other pairs) via ECB/Frankfurter
- **Stock price** — Live price for any ticker via Yahoo Finance

## Setup

```bash
npm install
cp .env.example .env   # add your GEMINI_API_KEY
npm run dev            # starts on port 4000
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `GEMINI_API_KEY` | — | Required for AI features (advisor, document parsing, layoff brief) |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` | Gemini model to use |

## API Reference

All endpoints are under `/api/tax`.

### `POST /api/tax/calculate`
Full tax calculation for a given regime.

```json
{
  "income": { "salary": 1500000, "interest_fd": 50000 },
  "deductions": { "section_80c": 150000 },
  "regime": "new"
}
```

### `POST /api/tax/compare`
Returns old and new regime side-by-side with a recommendation.

### `POST /api/tax/advance`
Advance tax installment schedule (June / Sep / Dec / Mar).

```json
{
  "income": { "salary": 2000000 },
  "deductions": {},
  "regime": "new",
  "tds_deducted": 100000,
  "paid_installments": { "1": 0, "2": 0, "3": 0, "4": 0 }
}
```

### `POST /api/tax/optimize`
Suggests deduction investments to reduce tax under both regimes.

### `POST /api/tax/ctc`
Decodes CTC into monthly take-home.

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

### `POST /api/tax/hike`
Shows before/after tax and take-home for a salary hike.

```json
{
  "current_ctc": 1500000,
  "new_ctc": 2000000,
  "regime": "new"
}
```

### `POST /api/tax/rsu`
Calculates RSU perquisite tax + capital gains tax with DTAA relief.

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

### `POST /api/tax/rsu/parse`
Upload a broker statement, Form W-2, or Form 16 to auto-extract RSU lot data.
`multipart/form-data` with field `document` (PDF/JPEG/PNG/WEBP, max 10MB).

### `GET /api/tax/fx-rate?date=YYYY-MM-DD&from=USD&to=INR`
Historical exchange rate from ECB via Frankfurter.app.

### `GET /api/tax/stock-price?ticker=GOOGL`
Current market price via Yahoo Finance.

### `POST /api/tax/parse-document`
Upload Form 16, 26AS, or salary slip to extract structured income data.
`multipart/form-data` with field `document`.

### `POST /api/tax/itr-prefill`
Returns a pre-filled ITR-1 Excel file (AY 2025-26) as a download.

```json
{
  "first_name": "Rahul",
  "last_name": "Sharma",
  "pan": "ABCDE1234F",
  "dob": "01/01/1990",
  "mobile": "9999999999",
  "email": "rahul@example.com",
  "gross_salary": 1500000,
  "tds_employer": 120000,
  "regime": "new"
}
```

### `POST /api/tax/layoff-brief`
AI-generated negotiation brief for a layoff scenario with unvested RSUs.

### `POST /api/tax/layoff-agreement`
Upload a separation agreement PDF for AI analysis of equity clauses and red flags.

### `POST /api/tax/ask`
Ask a free-form tax question.

```json
{ "question": "Should I invest in NPS to save tax?" }
```

### `GET /health`
Returns `{ "status": "ok" }`.

## Deploy

**Docker**
```bash
docker build -t taxwise .
docker run -p 8080:8080 --env-file .env taxwise
```

**Railway / Fly.io** — `railway.toml` and `fly.toml` are included. Set `GEMINI_API_KEY` in the platform's environment variables.
