import { describe, expect, it } from 'vitest';
import { cardLimitMinor, evaluatePolicy } from './engine.js';

const base = { template: 'saas' as const, merchantName: 'PixelForge', amountMinor: 50000, maxPerTransactionMinor: 50000, maxTotalMinor: 50000, allowedMcc: ['5734'], currency: 'USD', expiresAt: new Date('2026-11-10T00:00:00Z'), now: new Date('2026-10-27T00:00:00Z'), reserveFloorMinor: 1200000, deptBudgetRemainingMinor: 1000000, approvalThresholdMinor: 100000 };

describe('policy engine', () => {
  it('returns all independent failures', () => {
    const result = evaluatePolicy({ ...base, amountMinor: 2000000, allowedMcc: ['7995'], currency: 'EUR', activeMerchants: ['PixelForge'] });
    expect(result.ok).toBe(false);
    expect(result.failures.map((failure) => failure.rule)).toEqual(expect.arrayContaining(['department_budget', 'mcc_allowlist', 'currency_allowlist', 'duplicate_active_contract']));
  });

  it('marks threshold approvals without treating them as a policy failure', () => {
    expect(evaluatePolicy(base).requiresApproval).toBe(false);
    expect(evaluatePolicy({ ...base, amountMinor: 150000, maxPerTransactionMinor: 150000, maxTotalMinor: 150000 }).requiresApproval).toBe(true);
    expect(cardLimitMinor(150000, 90000)).toBe(90000);
  });
});
