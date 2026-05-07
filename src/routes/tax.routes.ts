import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { calculateTax, compareRegimes, calculateAdvanceTax } from '../services/tax.calculator';
import { askTaxAdvisor } from '../services/ai.advisor';
import { parseDocument } from '../services/document.parser';
import { optimizeTax } from '../services/optimizer';
import { decodeCTC } from '../services/ctc.calculator';
import { simulateHike } from '../services/hike.simulator';
import { prefillITR1 } from '../services/itr.prefill';
import { calculateRSUTax } from '../services/rsu.calculator';
import { parseRSUDocument } from '../services/rsu.parser';

export const taxRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const IncomeSchema = z.object({
  salary:                    z.number().min(0).default(0),
  house_property:            z.number().default(0),
  capital_gains_stcg:        z.number().min(0).default(0),
  capital_gains_ltcg:        z.number().min(0).default(0),
  capital_gains_stcg_other:  z.number().min(0).default(0),
  capital_gains_ltcg_other:  z.number().min(0).default(0),
  interest_savings:          z.number().min(0).default(0),
  interest_fd:               z.number().min(0).default(0),
  dividends:                 z.number().min(0).default(0),
  other_sources:             z.number().min(0).default(0),
  lottery_winnings:          z.number().min(0).default(0),
  crypto_vda:                z.number().min(0).default(0),
  freelance_income:          z.number().min(0).default(0),
  freelance_expenses:        z.number().min(0).default(0),
  agriculture_income:        z.number().min(0).default(0),
});

const DeductionsSchema = z.object({
  section_80c:        z.number().min(0).default(0),
  section_80ccc:      z.number().min(0).default(0),
  section_80ccd1b:    z.number().min(0).default(0),
  section_80ccd2:     z.number().min(0).default(0),
  section_80d:        z.number().min(0).default(0),
  section_80d_senior: z.number().min(0).default(0),
  section_24b:        z.number().min(0).default(0),
  section_80tta:      z.number().min(0).default(0),
  section_80ttb:      z.number().min(0).default(0),
  section_80e:        z.number().min(0).default(0),
  section_80eea:      z.number().min(0).default(0),
  section_80g:        z.number().min(0).default(0),
  section_80gg:       z.number().min(0).default(0),
  other:              z.number().min(0).default(0),
});

const TaxInputSchema = z.object({
  income: IncomeSchema,
  deductions: DeductionsSchema.default({}),
  regime: z.enum(['old', 'new']).default('new'),
  tds_deducted: z.number().min(0).default(0),
  paid_installments: z.object({
    1: z.number().min(0).default(0),
    2: z.number().min(0).default(0),
    3: z.number().min(0).default(0),
    4: z.number().min(0).default(0),
  }).default({}),
});

// POST /tax/calculate — full tax calculation
taxRouter.post('/calculate', (req, res, next) => {
  try {
    const input = TaxInputSchema.parse(req.body);
    const result = calculateTax(input.income, input.deductions, input.regime);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /tax/compare — old vs new regime comparison
taxRouter.post('/compare', (req, res, next) => {
  try {
    const input = TaxInputSchema.parse(req.body);
    const result = compareRegimes(input.income, input.deductions);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /tax/advance — advance tax schedule
taxRouter.post('/advance', (req, res, next) => {
  try {
    const input = TaxInputSchema.parse(req.body);
    const result = calculateAdvanceTax(
      input.income,
      input.deductions,
      input.regime,
      input.tds_deducted,
      input.paid_installments as Record<1 | 2 | 3 | 4, number>
    );
    res.json(result);
  } catch (err) { next(err); }
});

// POST /tax/parse-document — upload Form 16 / 26AS / salary slip / etc.
taxRouter.post('/parse-document', upload.single('document'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded. Send a PDF or image as multipart/form-data field "document".' });
      return;
    }
    const result = await parseDocument(req.file.buffer, req.file.mimetype, req.file.originalname);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /tax/optimize — tax optimizer
taxRouter.post('/optimize', (req, res, next) => {
  try {
    const input = TaxInputSchema.parse(req.body);
    const result = optimizeTax(input.income, input.deductions);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /tax/ctc — CTC to take-home decoder
taxRouter.post('/ctc', (req, res, next) => {
  try {
    const schema = z.object({
      annual_ctc:               z.number().min(1),
      basic_percent:            z.number().min(1).max(100).default(40),
      hra_percent:              z.number().min(0).max(100).default(50),
      is_metro:                 z.boolean().default(true),
      monthly_rent:             z.number().min(0).default(0),
      pf_employee_percent:      z.number().min(0).max(12).default(12),
      include_gratuity:         z.boolean().default(true),
      lta_annual:               z.number().min(0).optional(),
      professional_tax:         z.number().min(0).default(200),
      other_monthly_deductions: z.number().min(0).default(0),
      other_income:             z.number().min(0).default(0),
      regime:                   z.enum(['old','new']).default('new'),
    });
    const input = schema.parse(req.body);
    const result = decodeCTC(input);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /tax/hike — salary hike simulator
taxRouter.post('/hike', (req, res, next) => {
  try {
    const schema = z.object({
      current_ctc:  z.number().min(1),
      new_ctc:      z.number().min(1),
      regime:       z.enum(['old','new']).default('new'),
      other_income: z.number().min(0).default(0),
      deductions:   DeductionsSchema.default({}),
    });
    const input = schema.parse(req.body);
    const result = simulateHike(input);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /tax/rsu — calculate RSU tax (perquisite + capital gains + DTAA)
taxRouter.post('/rsu', (req, res, next) => {
  try {
    const LotSchema = z.object({
      lot_id:              z.string(),
      vest_date:           z.string(),
      shares_vested:       z.number().min(1),
      fmv_usd:             z.number().min(0),
      exchange_rate_vest:  z.number().min(1),
      exercise_price_usd:  z.number().min(0).default(0),
      tds_deducted_inr:    z.number().min(0).default(0),
      employer_reported:   z.boolean().default(false),
    });
    const SaleSchema = z.object({
      sale_date:             z.string(),
      shares_sold:           z.number().min(1),
      sale_price_usd:        z.number().min(0),
      exchange_rate_sale:    z.number().min(1),
      us_tax_withheld_pct:   z.number().min(0).max(100).default(0),
      lot_id:                z.string().optional(),
    });
    const schema = z.object({
      lots:           z.array(LotSchema).min(1),
      sales:          z.array(SaleSchema).default([]),
      slab_rate:      z.number().min(0).max(0.30).default(0.30),
      surcharge_rate: z.number().min(0).max(0.37).default(0),
      lot_matching:   z.enum(['FIFO','LIFO','SPECIFIC']).default('FIFO'),
      dtaa_country:   z.enum(['US','UK','OTHER']).default('US'),
    });
    const input = schema.parse(req.body);
    const result = calculateRSUTax(input);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /tax/fx-rate?date=YYYY-MM-DD&from=USD&to=INR — historical exchange rate proxy
taxRouter.get('/fx-rate', async (req, res, next) => {
  try {
    const { date, from = 'USD', to = 'INR' } = req.query as Record<string, string>;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'date required in YYYY-MM-DD format' });
      return;
    }
    // Frankfurter.app — ECB historical rates, free, no key
    const url = `https://api.frankfurter.app/${date}?from=${from}&to=${to}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Rate lookup failed: ${r.status}`);
    const data = await r.json() as { date: string; rates: Record<string, number> };
    const rate = data.rates?.[to];
    if (!rate) throw new Error(`No rate found for ${from}/${to} on ${date}`);
    res.json({ date: data.date, from, to, rate });
  } catch (err) { next(err); }
});

// POST /tax/rsu/parse — parse broker statement / Form W-2 / Form 16 for RSU data
taxRouter.post('/rsu/parse', upload.single('document'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded. Send PDF or image as "document".' });
      return;
    }
    const result = await parseRSUDocument(req.file.buffer, req.file.mimetype, req.file.originalname);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /tax/itr-prefill — prefill ITR-1 Excel utility and return for download
taxRouter.post('/itr-prefill', async (req, res, next) => {
  try {
    const schema = z.object({
      first_name:                  z.string().min(1),
      middle_name:                 z.string().optional(),
      last_name:                   z.string().min(1),
      pan:                         z.string().length(10),
      aadhaar:                     z.string().optional(),
      dob:                         z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Use DD/MM/YYYY'),
      gender:                      z.enum(['M','F','T']).optional(),
      mobile:                      z.string().min(10),
      email:                       z.string().email(),
      flat_no:                     z.string().optional(),
      premises_name:               z.string().optional(),
      road:                        z.string().optional(),
      locality:                    z.string().optional(),
      city:                        z.string().optional(),
      state_code:                  z.string().optional(),
      pin_code:                    z.string().optional(),
      employer_category:           z.enum(['G','PA','PE','NE','NA']).optional(),
      gross_salary:                z.number().min(0),
      allowances_exempt:           z.number().min(0).default(0),
      standard_deduction:          z.number().min(0).optional(),
      professional_tax:            z.number().min(0).default(0),
      income_from_other_sources:   z.number().min(0).default(0),
      gross_rent_received:         z.number().min(0).default(0),
      interest_borrowed_capital:   z.number().min(0).default(0),
      section_80c:                 z.number().min(0).default(0),
      section_80d:                 z.number().min(0).default(0),
      section_80ccd1b:             z.number().min(0).default(0),
      section_24b:                 z.number().min(0).default(0),
      tds_employer:                z.number().min(0).default(0),
      employer_tan:                z.string().optional(),
      employer_name:               z.string().optional(),
      tds_other:                   z.number().min(0).default(0),
      advance_tax:                 z.number().min(0).default(0),
      self_assessment_tax:         z.number().min(0).default(0),
      bank_account_number:         z.string().optional(),
      bank_ifsc:                   z.string().optional(),
      bank_account_type:           z.enum(['SB','CA','CC','OD','NRO','NRE']).optional(),
      regime:                      z.enum(['old','new']).default('new'),
    });
    const input = schema.parse(req.body);
    const buffer = await prefillITR1(input);
    const filename = `ITR1_${input.pan}_AY2025-26_prefilled.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) { next(err); }
});

// POST /tax/layoff-brief — Gemini-generated negotiation brief
taxRouter.post('/layoff-brief', async (req, res, next) => {
  try {
    const schema = z.object({
      company_type:       z.string(),
      termination_date:   z.string(),
      total_unvested:     z.number().min(0),
      shares_accelerated: z.number().min(0),
      shares_forfeited:   z.number().min(0),
      gross_value_inr:    z.number().min(0),
      tax_inr:            z.number().min(0),
      cliff_days:         z.number().min(0).optional(),
      cliff_value_inr:    z.number().min(0).optional(),
      accel_policy:       z.string(),
    });
    const d = schema.parse(req.body);
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

    const prompt = `You are an expert Indian employment and equity compensation advisor helping a tech employee navigate a layoff at a ${d.company_type} company.

Context:
- Termination date: ${d.termination_date}
- Total unvested shares: ${d.total_unvested}
- Shares accelerating: ${d.shares_accelerated} (policy: ${d.accel_policy})
- Shares forfeiting: ${d.shares_forfeited}
- Gross value of kept shares: ₹${Math.round(d.gross_value_inr).toLocaleString('en-IN')}
- Tax liability: ₹${Math.round(d.tax_inr).toLocaleString('en-IN')}
${d.cliff_days && d.cliff_days > 0 ? `- CRITICAL: Next cliff vest is ${d.cliff_days} days away, worth ₹${Math.round(d.cliff_value_inr||0).toLocaleString('en-IN')}` : ''}

Write a concise, actionable negotiation brief for this person. Structure it as:

**YOUR LEVERAGE**
What's in your favor (cliff proximity, vested tenure, etc.)

**WHAT TO ASK FOR**
3-4 specific asks in priority order (e.g., extend last working day past cliff, additional acceleration %, severance continuation of vesting)

**WHAT NEVER TO SIGN**
Red flags to watch for in the separation agreement

**THE ASK SCRIPT**
2-3 sentences they can actually say to HR

Keep it direct, India-context aware, under 300 words. No legal disclaimer needed.`;

    const response = await client.models.generateContent({
      model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite',
      contents: prompt,
    });
    res.json({ brief: response.text?.trim() ?? '' });
  } catch (err) { next(err); }
});

// POST /tax/layoff-agreement — analyze separation agreement PDF
taxRouter.post('/layoff-agreement', upload.single('document'), async (req, res, next) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No file uploaded.' }); return; }
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });
    const base64 = req.file.buffer.toString('base64');

    const response = await client.models.generateContent({
      model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: req.file.mimetype, data: base64 } },
          { text: `You are an expert at analyzing tech company separation agreements, specifically for Indian employees with RSU/equity holdings.

Analyze this separation agreement and identify:

1. **EQUITY CLAUSES** — Any clauses about RSUs, stock options, ESPP. Flag anything that reduces your standard equity rights.
2. **WAIVER FLAGS** — Any language asking you to waive equity claims, accelerated vesting rights, or disputed amounts.
3. **NON-STANDARD TERMS** — Anything unusual compared to standard FAANG separation agreements.
4. **SIGNING DEADLINE** — When must this be signed? (important for negotiation window)
5. **WHAT TO NEGOTIATE** — Top 2-3 items worth pushing back on.

Format as clear sections. Be direct — this person needs to act quickly. Under 400 words.` }
        ]
      }]
    });
    res.json({ analysis: response.text?.trim() ?? '' });
  } catch (err) { next(err); }
});

// GET /tax/stock-price?ticker=GOOGL — get current stock price via Yahoo Finance
taxRouter.get('/stock-price', async (req, res, next) => {
  try {
    const { ticker } = req.query as { ticker: string };
    if (!ticker) { res.status(400).json({ error: 'ticker required' }); return; }
    // Yahoo Finance unofficial endpoint
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker.toUpperCase()}?interval=1d&range=1d`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) throw new Error('Stock price fetch failed');
    const data = await r.json() as any;
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (!price) throw new Error('Price not found');
    res.json({ ticker: ticker.toUpperCase(), price: parseFloat(price.toFixed(2)) });
  } catch (err) { next(err); }
});

// POST /tax/ask — AI tax advisor
taxRouter.post('/ask', async (req, res, next) => {
  try {
    const { question, context } = z.object({
      question: z.string().min(1).max(1000),
      context: z.any().optional(),
    }).parse(req.body);

    const answer = await askTaxAdvisor(question, context);
    res.json({ answer });
  } catch (err) { next(err); }
});
