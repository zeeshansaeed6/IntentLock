import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { contractSchema, type IntentContract } from '@intentlock/shared';

export type ContractDraft = Omit<IntentContract, 'intent_id' | 'signature'>;

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, sortValue(child)]));
  }
  return value;
}

export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export type ContractTerms = Omit<IntentContract, 'intent_id' | 'signature' | 'state'>;

export function contractTerms(contract: IntentContract | ContractDraft): ContractTerms {
  const {
    template,
    user_request,
    decision,
    reconsider_on,
    merchant,
    allowed_mcc,
    currency,
    allowed_currencies,
    max_per_transaction_minor,
    max_total_minor,
    max_transactions,
    valid_from,
    expires_at,
    requires_human_approval,
    policy_snapshot,
    rationale,
  } = contract as any;
  return {
    template,
    user_request,
    decision,
    reconsider_on,
    merchant,
    allowed_mcc,
    currency,
    allowed_currencies,
    max_per_transaction_minor,
    max_total_minor,
    max_transactions,
    valid_from,
    expires_at,
    requires_human_approval,
    policy_snapshot,
    rationale,
  };
}

export function signContract(draft: ContractDraft, secret: string): IntentContract {
  const terms = contractTerms(draft);
  const sourceHash = createHash('sha256').update(canonicalize(terms)).digest('hex');
  const intent_id = `intent_${sourceHash.slice(0, 24)}`;
  const unsigned = { ...draft, intent_id };
  const signature = createHmac('sha256', secret).update(canonicalize({ ...terms, intent_id })).digest('hex');
  return contractSchema.parse({ ...unsigned, signature });
}

export function verifyContract(contract: IntentContract, secret: string): boolean {
  const parsed = contractSchema.safeParse(contract);
  if (!parsed.success) return false;
  const terms = contractTerms(parsed.data);
  const sourceHash = createHash('sha256').update(canonicalize(terms)).digest('hex');
  if (parsed.data.intent_id !== `intent_${sourceHash.slice(0, 24)}`) return false;
  const expected = createHmac('sha256', secret).update(canonicalize({ ...terms, intent_id: parsed.data.intent_id })).digest('hex');
  const actualBuffer = Buffer.from(parsed.data.signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function tamperContract<T extends IntentContract>(contract: T, field: keyof T, value: T[keyof T]): T {
  return { ...contract, [field]: value };
}
