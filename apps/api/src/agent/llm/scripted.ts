import { purchaseProposalSchema, type PurchaseProposal } from '@intentlock/shared';
import type { LLMClient } from './types.js';

export class ScriptedLLM implements LLMClient {
  readonly providerName = 'scripted';

  async generateProposal(userRequest: string, untrustedContext?: string): Promise<PurchaseProposal> {
    const combined = `${userRequest} ${untrustedContext ?? ''}`;
    const isCloudGpu = /gpu|compute|lambda|runpod|together|coreweave|h100|a100/i.test(combined);
    const isRedTeam = /raise the limit|ignore previous|override|5000/i.test(combined);

    // Extract explicit budget/amount if mentioned (e.g. "budget $90", "$500", "5000")
    let amountMinor = isCloudGpu ? 9000 : 50000;
    const budgetMatch = combined.match(/(?:budget\s*[:=]?\s*\$?|for\s*\$?|\$)([0-9]+(?:\.[0-9]{1,2})?)/i);
    if (budgetMatch && budgetMatch[1]) {
      const parsed = parseFloat(budgetMatch[1]);
      if (!isNaN(parsed) && parsed > 0) {
        amountMinor = Math.round(parsed * 100);
      }
    }

    if (isRedTeam) {
      amountMinor = 500000; // $5,000 attempted by hostile invoice text
    }

    const template: 'saas' | 'cloud_gpu' = isCloudGpu ? 'cloud_gpu' : 'saas';

    let merchantName = isCloudGpu ? 'Lambda GPU Cloud' : 'PixelForge Design';
    if (/northstar/i.test(combined)) merchantName = 'Northstar Design';
    if (/pixelforge|pixel/i.test(combined)) merchantName = 'PixelForge';
    if (/runpod/i.test(combined)) merchantName = 'RunPod';
    if (/together/i.test(combined)) merchantName = 'Together AI';

    const isAnnual = isRedTeam || /annual|yearly|pay annually/i.test(combined);
    const billingPreference: 'monthly' | 'annual' = isAnnual ? 'annual' : 'monthly';

    const monthlyPriceMinor = isCloudGpu ? amountMinor : 30000;
    const annualPriceMinor = isCloudGpu ? amountMinor * 12 : 500000;

    const rationale = isRedTeam
      ? 'Extracted terms from invoice attempting $5,000 annual billing.'
      : isCloudGpu
        ? `Cloud GPU compute allocated within explicit user budget of $${amountMinor / 100}.`
        : 'Monthly pricing preserves cash runway while keeping cancellation optional.';

    const rawProposal = {
      template,
      merchantName,
      requestedAmountMinor: amountMinor,
      billingPreference,
      rationale,
      extractedVendorTerms: {
        monthlyPriceMinor,
        annualPriceMinor,
      },
    };

    return purchaseProposalSchema.parse(rawProposal);
  }
}
