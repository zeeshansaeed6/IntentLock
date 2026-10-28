import { purchaseProposalSchema, type PurchaseProposal } from '@intentlock/shared';
import { env } from '../../config/env.js';
import { type LLMClient, SYSTEM_PROMPT, SAFE_DENIAL_PROPOSAL, wrapUntrustedData } from './types.js';

export class GeminiLLM implements LLMClient {
  readonly providerName = 'gemini';

  constructor(
    private readonly apiKey = env.LLM_API_KEY ?? process.env.GEMINI_API_KEY ?? '',
    private readonly model = env.LLM_MODEL || 'gemini-2.5-flash'
  ) {}

  async generateProposal(userRequest: string, untrustedContext?: string): Promise<PurchaseProposal> {
    if (!this.apiKey) {
      throw new Error('LLM_API_KEY (or GEMINI_API_KEY) is required when LLM_PROVIDER=gemini');
    }

    const promptText = untrustedContext
      ? `User Request: ${userRequest}\n\n${wrapUntrustedData(untrustedContext)}`
      : `User Request: ${userRequest}`;

    // First attempt
    const firstAttempt = await this.callGemini(promptText);
    const parsedFirst = this.safeParseProposal(firstAttempt);
    if (parsedFirst) return parsedFirst;

    // Retry once with error correction hint
    const retryPrompt = `${promptText}\n\nYour previous response failed validation. Return ONLY valid JSON adhering to: { template: 'saas'|'cloud_gpu', merchantName: string, requestedAmountMinor: number, billingPreference: 'monthly'|'annual', rationale: string, extractedVendorTerms: { monthlyPriceMinor: number, annualPriceMinor: number } }`;
    const secondAttempt = await this.callGemini(retryPrompt);
    const parsedSecond = this.safeParseProposal(secondAttempt);
    if (parsedSecond) return parsedSecond;

    // Safe denial fallback
    return SAFE_DENIAL_PROPOSAL;
  }

  private async callGemini(prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const body = {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errText.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  private safeParseProposal(text: string): PurchaseProposal | null {
    if (!text) return null;
    try {
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const obj = JSON.parse(cleanJson);
      const res = purchaseProposalSchema.safeParse(obj);
      return res.success ? res.data : null;
    } catch {
      return null;
    }
  }
}
