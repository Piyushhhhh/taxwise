import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_MODEL   = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite';

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (_client) return _client;
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
  _client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  return _client;
}

// What the extraction prompt returns
export interface ParsedTaxDocument {
  document_type: string;         // e.g. "Form 16", "Form 26AS", "Salary Slip", etc.
  confidence: 'high' | 'medium' | 'low';
  extracted: {
    income?: {
      salary?: number;
      other_sources?: number;
      capital_gains_stcg?: number;
      capital_gains_ltcg?: number;
      house_property?: number;
    };
    deductions?: {
      section_80c?: number;
      section_80d?: number;
      section_80ccd1b?: number;
      section_24b?: number;
      other?: number;
    };
    tds_deducted?: number;
    advance_tax_paid?: {
      q1?: number;
      q2?: number;
      q3?: number;
      q4?: number;
    };
    suggested_regime?: 'old' | 'new';
    financial_year?: string;
  };
  notes: string[];   // Human-readable notes about what was found / couldn't be found
}

const EXTRACTION_PROMPT = `You are an expert Indian tax document parser for FY 2025-26 (AY 2026-27).

Analyse the provided document image or PDF and extract tax-relevant information.

The document could be any of these types:
- Form 16 Part A: TDS certificate from employer — contains salary, TDS deducted
- Form 16 Part B: Detailed breakup of salary, all deductions claimed (80C, 80D, 80CCD, 24B, etc.)
- Form 26AS / AIS / TIS: Consolidated tax statement — TDS from all sources, advance tax paid, capital gains
- Salary Slip: Monthly payslip — gross salary, PF deduction (counts toward 80C)
- Capital Gains Statement (Zerodha/Groww/Kite P&L): STCG and LTCG breakup
- Home Loan Statement / Interest Certificate: Annual interest paid on home loan (Section 24B)
- Insurance Premium Receipt: Health insurance premium (Section 80D)
- PPF/ELSS/NPS Statement: Investment amounts (Section 80C / 80CCD)

Return ONLY a JSON object with this exact structure (no markdown, no prose):
{
  "document_type": "<detected document type>",
  "confidence": "<high|medium|low>",
  "extracted": {
    "income": {
      "salary": <annual gross salary in rupees or null>,
      "other_sources": <interest income, dividends in rupees or null>,
      "capital_gains_stcg": <short term capital gains in rupees or null>,
      "capital_gains_ltcg": <long term capital gains in rupees or null>,
      "house_property": <rental income, negative if loss, or null>
    },
    "deductions": {
      "section_80c": <total 80C investments in rupees or null>,
      "section_80d": <health insurance premium in rupees or null>,
      "section_80ccd1b": <NPS contribution in rupees or null>,
      "section_24b": <home loan interest in rupees or null>,
      "other": <other deductions in rupees or null>
    },
    "tds_deducted": <total TDS deducted in rupees or null>,
    "advance_tax_paid": {
      "q1": <Q1 advance tax paid or null>,
      "q2": <Q2 advance tax paid or null>,
      "q3": <Q3 advance tax paid or null>,
      "q4": <Q4 advance tax paid or null>
    },
    "suggested_regime": "<old|new|null — suggest based on deductions found>",
    "financial_year": "<e.g. 2025-26 or null>"
  },
  "notes": [
    "<note about any important finding or assumption>",
    "<note about anything that couldn't be extracted>"
  ]
}

Rules:
- All monetary values in rupees as plain numbers (no commas, no ₹ symbol)
- If a field is not present in the document, set it to null
- For salary slips showing monthly amounts, multiply by 12 for the annual figure and note this in notes
- For Form 16 Part A+B combined, extract everything available
- If the document is a capital gains statement, sum up all STCG trades and all LTCG trades separately
- If PF contribution is visible on a salary slip, include it in section_80c
- Suggest regime: if total deductions (80C+80D+NPS+24B) exceed ₹2.5 lakh, suggest "old", otherwise suggest "new"
- Be conservative: only include values you can clearly see — don't estimate
- Set confidence: "high" if this is a standard tax document with clear figures, "medium" if some inference was needed, "low" if the document is unclear or not a tax document`;

export async function parseDocument(
  fileBuffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<ParsedTaxDocument> {
  const client = getClient();

  const base64 = fileBuffer.toString('base64');

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64,
            },
          },
          {
            text: `${EXTRACTION_PROMPT}\n\nFile name: ${originalName}`,
          },
        ],
      },
    ],
  });

  const raw = response.text?.trim() ?? '';

  // Strip markdown code fences if Gemini wraps in ```json
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let parsed: ParsedTaxDocument;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Gemini returned non-JSON response: ${raw.slice(0, 200)}`);
  }

  return parsed;
}
