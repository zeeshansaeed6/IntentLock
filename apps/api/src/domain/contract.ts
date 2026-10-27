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

function unsignedContract(contract: IntentContract): Omit<IntentContract, 'signature'> {
  const { signature: _signature, ...unsigned } = contract;
  return unsigned;
}

export function signContract(draft: ContractDraft, secret: string): IntentContract {
  const sourceHash = createHash('sha256').update(canonicalize(draft)).digest('hex');
  const unsigned = { ...draft, intent_id: `intent_${sourceHash.slice(0, 24)}` };
  const signature = createHmac('sha256', secret).update(canonicalize(unsigned)).digest('hex');
  return contractSchema.parse({ ...unsigned, signature });
}

export function verifyContract(contract: IntentContract, secret: string): boolean {
  const parsed = contractSchema.safeParse(contract);
  if (!parsed.success) return false;
  const unsigned = unsignedContract(parsed.data);
  const { intent_id: intentId, ...draft } = unsigned;
  const sourceHash = createHash('sha256').update(canonicalize(draft)).digest('hex');
  if (intentId !== `intent_${sourceHash.slice(0, 24)}`) return false;
  const expected = createHmac('sha256', secret).update(canonicalize(unsigned)).digest('hex');
  const actualBuffer = Buffer.from(parsed.data.signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function tamperContract<T extends IntentContract>(contract: T, field: keyof T, value: T[keyof T]): T {
  return { ...contract, [field]: value };
}
