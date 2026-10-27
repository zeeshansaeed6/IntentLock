import { describe, expect, it } from 'vitest';
import { signContract, tamperContract, verifyContract } from './contract.js';
import type { ContractDraft } from './contract.js';

const draft: ContractDraft = {
  template: 'saas', user_request: 'Buy a design tool', decision: 'monthly', reconsider_on: '2026-11-10T00:00:00.000Z',
  merchant: { name: 'PixelForge', allowed_names: ['PixelForge'] }, allowed_mcc: ['5734'], currency: 'USD', allowed_currencies: ['USD'],
  max_per_transaction_minor: 50000, max_total_minor: 50000, max_transactions: 1, valid_from: '2026-10-27T00:00:00.000Z', expires_at: '2026-11-10T00:00:00.000Z',
  requires_human_approval: false, policy_snapshot: { reserve_floor_minor: 1200000, dept_budget_remaining_minor: 1000000, approval_threshold_minor: 100000 }, rationale: 'Monthly preserves the reserve.', state: 'ACTIVE',
};

describe('signed contracts', () => {
  it('signs and verifies canonical data', () => {
    const contract = signContract(draft, 'test-secret');
    expect(verifyContract(contract, 'test-secret')).toBe(true);
    expect(verifyContract(contract, 'wrong-secret')).toBe(false);
  });

  it('fails verification after tampering', () => {
    const contract = signContract(draft, 'test-secret');
    expect(verifyContract(tamperContract(contract, 'max_total_minor', 50001), 'test-secret')).toBe(false);
  });
});
