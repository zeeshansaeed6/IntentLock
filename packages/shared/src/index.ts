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
  signature: z.string(),
});

export type IntentContract = z.infer<typeof contractSchema>;

export const healthSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('intentlock-api'),
  mode: z.string(),
  airwallex: z.enum(['not_configured', 'sandbox']),
});

export type HealthResponse = z.infer<typeof healthSchema>;
