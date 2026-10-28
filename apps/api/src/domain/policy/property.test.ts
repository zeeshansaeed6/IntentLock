import { describe, expect, it } from 'vitest';
import { cardLimitMinor } from './engine.js';
import { createIntent } from '../../agent/graph.js';
import { store } from '../../store/memory.js';

describe('Milestone 5: Invariant Property-Style Tests', () => {
  it('property: cardLimitMinor(proposal, deptBudget) is invariant <= min(userBudget, deptBudget)', () => {
    // Generate 100 randomized budget pairs (both normal and edge cases)
    const testCases: Array<[number, number]> = [
      [0, 0],
      [0, 100000],
      [50000, 0],
      [50000, 50000],
      [100000, 50000], // user exceeds department
      [30000, 90000],  // department exceeds user
      [1, 1],
      [99999999, 100],
    ];

    for (let i = 0; i < 100; i++) {
      const userBudget = Math.floor(Math.random() * 5000000);
      const deptBudget = Math.floor(Math.random() * 5000000);
      testCases.push([userBudget, deptBudget]);
    }

    for (const [userBudget, deptBudget] of testCases) {
      const limit = cardLimitMinor(userBudget, deptBudget);
      const expectedCeiling = Math.max(0, Math.min(userBudget, deptBudget));

      expect(limit).toBeLessThanOrEqual(expectedCeiling);
      expect(limit).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(limit)).toBe(true);
    }
  });

  it('property: full intent pipeline enforces that contract max_total_minor never exceeds department budget', async () => {
    store.reset();
    const requests = [
      'Buy 40 GPU hours, budget $90',
      'Buy 500 GPU hours, budget $10000', // exceeds company department budget ($2,500)
      'Buy team Figma plan, budget $500',
      'Small dev tool, budget $25',
    ];

    for (const req of requests) {
      const record = await createIntent(req);
      const deptBudgetRemaining = record.contract.policy_snapshot.dept_budget_remaining_minor;

      // Invariant: The bound contract total cap CANNOT exceed remaining department budget
      expect(record.contract.max_total_minor).toBeLessThanOrEqual(deptBudgetRemaining);
    }
  });
});
