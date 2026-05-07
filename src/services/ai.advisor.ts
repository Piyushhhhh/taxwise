import { GoogleGenAI } from '@google/genai';
import type { AdvanceTaxSummary, TaxCalculationResult } from '../types/tax.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite';

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI | null {
  if (_client) return _client;
  if (GEMINI_API_KEY) {
    _client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    return _client;
  }
  return null;
}

const SYSTEM_PROMPT = `You are TaxWise, an expert Indian tax advisor specializing in FY 2024-25 (AY 2025-26) income tax for salaried individuals.

You help users understand:
- Advance tax calculations and quarterly installments (Section 208)
- Interest on late payment (Section 234B and 234C)
- Old vs new tax regime comparison
- Deductions (80C, 80D, 80CCD, 24B, etc.)
- TDS and Form 16

Rules:
- Give specific, actionable advice with amounts in Indian Rupees (₹)
- Cite the relevant section of the Income Tax Act when applicable
- Be concise — 2-4 sentences unless detailed explanation is needed
- If a question is outside Indian income tax scope, politely decline
- Never give advice on tax evasion
- Use Indian number formatting (lakhs, crores)`;

export async function askTaxAdvisor(
  question: string,
  context?: { summary?: AdvanceTaxSummary; calculation?: TaxCalculationResult }
): Promise<string> {
  const client = getClient();
  if (!client) {
    return 'AI advisor not configured. Please add GEMINI_API_KEY to your .env file.';
  }

  const contextText = context?.summary
    ? `\n\nUser's tax context:
- FY: ${context.summary.financial_year}
- Regime: ${context.summary.regime}
- Gross income: ₹${context.summary.gross_income.toLocaleString('en-IN')}
- Total tax liability: ₹${context.summary.total_tax_liability.toLocaleString('en-IN')}
- TDS deducted: ₹${context.summary.tds_deducted.toLocaleString('en-IN')}
- Total outstanding: ₹${context.summary.total_outstanding.toLocaleString('en-IN')}`
    : '';

  try {
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      config: { systemInstruction: SYSTEM_PROMPT },
      contents: `${question}${contextText}`,
    });
    return response.text?.trim() ?? 'Unable to generate response.';
  } catch (err) {
    console.error('[AI Advisor] Error:', err);
    return 'Failed to get AI response. Please try again.';
  }
}
