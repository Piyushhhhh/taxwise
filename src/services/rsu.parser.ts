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

export interface ParsedRSUDocument {
  document_type: 'broker_statement' | 'form_w2' | 'award_agreement' | 'form_16' | 'unknown';
  broker?: 'etrade' | 'schwab' | 'fidelity' | 'morgan_stanley' | 'other';
  company_name?: string;
  company_ticker?: string;
  lots: {
    lot_id:           string;
    vest_date:        string;  // YYYY-MM-DD
    shares_vested:    number;
    fmv_usd:          number;
    exercise_price_usd: number;
    tds_deducted_inr: number;
    employer_reported: boolean;
  }[];
  sales: {
    sale_date:           string;  // YYYY-MM-DD
    shares_sold:         number;
    sale_price_usd:      number;
    us_tax_withheld_pct: number;
    proceeds_usd:        number;
  }[];
  perquisite_inr?: number;   // If extracted from Form 16
  tds_on_perquisite?: number;
  notes: string[];
  confidence: 'high' | 'medium' | 'low';
}

const PROMPT = `You are an expert at parsing equity compensation documents for Indian tax purposes.

Analyse the provided document and extract all RSU (Restricted Stock Unit) or ESOP vest and sale information.

The document may be any of:
- **E*Trade / Morgan Stanley broker statement**: Contains "Vest Date", "FMV at Vest", "Shares Released", "Shares Sold", "Sale Price", "Tax Withholding"
- **Charles Schwab statement**: Contains "Release Date", "Market Value", "Shares Released", "Shares Withheld for Taxes"
- **Fidelity NetBenefits statement**: Contains "Award Type", "Grant Date", "Vest Date", "Release Price"
- **Form W-2 (US)**: Box 1 income includes RSU compensation; Box 2 = federal tax withheld
- **Form 16 Part B**: "Value of perquisites u/s 17(2)" contains RSU perquisite value
- **Award Agreement**: Contains grant date, vesting schedule, number of shares

Return ONLY valid JSON (no markdown, no prose) in this exact structure:
{
  "document_type": "broker_statement|form_w2|award_agreement|form_16|unknown",
  "broker": "etrade|schwab|fidelity|morgan_stanley|other|null",
  "company_name": "string or null",
  "company_ticker": "string or null",
  "lots": [
    {
      "lot_id": "descriptive ID like Q1-2025 or Vest-Mar-2025",
      "vest_date": "YYYY-MM-DD",
      "shares_vested": number,
      "fmv_usd": number (FMV per share at vest in USD),
      "exercise_price_usd": 0 (always 0 for RSUs, may be non-zero for ESOPs),
      "tds_deducted_inr": 0 (fill from Form 16 if available, else 0),
      "employer_reported": false (true only if this is from Form 16)
    }
  ],
  "sales": [
    {
      "sale_date": "YYYY-MM-DD",
      "shares_sold": number,
      "sale_price_usd": number (per share),
      "us_tax_withheld_pct": number (percentage, e.g. 22 for 22%),
      "proceeds_usd": number (total proceeds)
    }
  ],
  "perquisite_inr": null or number (only from Form 16),
  "tds_on_perquisite": null or number (only from Form 16),
  "notes": ["array of important notes or caveats"],
  "confidence": "high|medium|low"
}

Rules:
- If broker withholds shares for taxes (common in E*Trade), set us_tax_withheld_pct based on shares withheld / total vested × 100
- FMV at vest = "Release Price", "Market Value at Release", "FMV", or similar field
- If you see "Shares Released" vs "Shares Vested" — Shares Vested is gross, Shares Released is after tax withholding
- For lot_id: use the vest quarter + year (e.g. "Q1-2025") or the exact vest date if available
- If document only has vesting schedule (award agreement) with no actual prices, set fmv_usd to null
- All monetary amounts: USD values as plain numbers, no currency symbols
- Exchange rates are NOT in broker documents — leave them for the user to enter
- Set confidence "high" for standard broker PDFs with clear tabular data, "medium" if you had to infer, "low" if unclear`;

export async function parseRSUDocument(
  fileBuffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<ParsedRSUDocument> {
  const client = getClient();
  const base64 = fileBuffer.toString('base64');

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: base64 } },
        { text: `${PROMPT}\n\nFile: ${originalName}` },
      ],
    }],
  });

  const raw = response.text?.trim() ?? '';
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let parsed: ParsedRSUDocument;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Could not parse document response: ${raw.slice(0, 200)}`);
  }

  return parsed;
}
