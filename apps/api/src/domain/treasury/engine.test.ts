import { describe, expect, it } from 'vitest';
import { decideTreasury } from './engine.js';

describe('treasury decision engine', () => {
  it('selects monthly when annual crosses the reserve floor in week seven', () => {
    const result = decideTreasury({
      currentBalanceMinor: 2100000,
      reserveFloorMinor: 1200000,
      terms: { monthlyPriceMinor: 30000, annualPriceMinor: 500000 },
      weeks: Array.from({ length: 12 }, () => ({ inflowMinor: 0, outflowMinor: 60000 })),
    });
    expect(result.annual.breachWeek).toBe(7);
    expect(result.monthly.breachWeek).toBeNull();
    expect(result.recommendation).toBe('monthly');
  });

  it('defers when both options breach', () => {
    const result = decideTreasury({ currentBalanceMinor: 1000000, reserveFloorMinor: 900000, terms: { monthlyPriceMinor: 100000, annualPriceMinor: 300000 }, weeks: Array.from({ length: 12 }, () => ({ inflowMinor: 0, outflowMinor: 30000 })) });
    expect(result.recommendation).toBe('defer');
  });
});
