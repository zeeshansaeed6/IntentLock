import { z } from 'zod';

export const intentStateSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'ACTIVE',
  'FROZEN',
  'COMPLETED',
  'REVOKED',
]);

export const contractSchema = z.object({
  intent_id: z.string(),
  template: z.enum(['saas', 'cloud_gpu']),
  user_request: z.string(),
  decision: z.enum(['monthly', 'annual', 'defer']),
  reconsider_on: z.string().datetime(),
  merchant: z.object({ name: z.string(), allowed_names: z.array(z.string()) }),
  allowed_mcc: z.array(z.string()),
  currency: z.string().length(3),
  allowed_currencies: z.array(z.string().length(3)),
  max_per_transaction_minor: z.number().int().nonnegative(),
  max_total_minor: z.number().int().nonnegative(),
  max_transactions: z.number().int().positive(),
  valid_from: z.string().datetime(),
  expires_at: z.string().datetime(),
  requires_human_approval: z.boolean(),
  policy_snapshot: z.object({
    reserve_floor_minor: z.number().int(),
    dept_budget_remaining_minor: z.number().int(),
    approval_threshold_minor: z.number().int(),
  }),
  rationale: z.string(),
  state: intentStateSchema,
  owner_id: z.string().optional(),
  signature: z.string(),
});

export type IntentContract = z.infer<typeof contractSchema>;

export const healthSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('intentlock-api'),
  mode: z.string(),
  airwallex: z.enum(['not_configured', 'sandbox']),
  fundedBalance: z
    .object({
      currency: z.string(),
      availableMinor: z.number().int(),
      totalMinor: z.number().int(),
    })
    .optional(),
});

export const purchaseProposalSchema = z.object({
  template: z.enum(['saas', 'cloud_gpu']),
  merchantName: z.string().min(1).max(100),
  requestedAmountMinor: z.number().int().nonnegative(),
  billingPreference: z.enum(['monthly', 'annual']),
  rationale: z.string().min(1).max(1000),
  extractedVendorTerms: z.object({
    monthlyPriceMinor: z.number().int().nonnegative(),
    annualPriceMinor: z.number().int().nonnegative(),
  }),
});

export type PurchaseProposal = z.infer<typeof purchaseProposalSchema>;


