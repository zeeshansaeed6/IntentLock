import { purchaseProposalSchema, type PurchaseProposal } from '@intentlock/shared';
import { env } from '../../config/env.js';
import { type LLMClient, SYSTEM_PROMPT, SAFE_DENIAL_PROPOSAL, wrapUntrustedData } from './types.js';

export class OpenAILLM implements LLMClient {
  readonly providerName = 'openai';

  constructor(
    private readonly apiKey = env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? '',
    private readonly model = env.LLM_MODEL || 'gpt-4o-mini',
    private readonly baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  ) {}

  async generateProposal(userRequest: string, untrustedContext?: string): Promise<PurchaseProposal> {
    if (!this.apiKey) {
      throw new Error('LLM_API_KEY (or OPENAI_API_KEY) is required when LLM_PROVIDER=openai');
    }

    const promptText = untrustedContext
      ? `User Request: ${userRequest}\n\n${wrapUntrustedData(untrustedContext)}`
      : `User Request: ${userRequest}`;

    const firstAttempt = await this.callOpenAI(promptText);
    const parsedFirst = this.safeParseProposal(firstAttempt);
    if (parsedFirst) return parsedFirst;

    const retryPrompt = `${promptText}\n\nYour previous response failed validation. Return ONLY valid JSON adhering to: { template: 'saas'|'cloud_gpu', merchantName: string, requestedAmountMinor: number, billingPreference: 'monthly'|'annual', rationale: string, extractedVendorTerms: { monthlyPriceMinor: number, annualPriceMinor: number } }`;
    const secondAttempt = await this.callOpenAI(retryPrompt);
    const parsedSecond = this.safeParseProposal(secondAttempt);
    if (parsedSecond) return parsedSecond;

    return SAFE_DENIAL_PROPOSAL;
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errText.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string };
      }>;
    };

    return data.choices?.[0]?.message?.content ?? '';
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
