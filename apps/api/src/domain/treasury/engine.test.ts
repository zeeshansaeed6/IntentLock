import { describe, expect, it } from 'vitest';
import { decideTreasury } from './engine.js';

describe('treasury decision engine', () => {
  it('annual-breaches-floor: selects monthly when annual crosses the reserve floor', () => {
    const result = decideTreasury({
      currentBalanceMinor: 2100000,
      reserveFloorMinor: 1200000,
      terms: { monthlyPriceMinor: 30000, annualPriceMinor: 500000 },
      weeks: Array.from({ length: 12 }, () => ({ inflowMinor: 0, outflowMinor: 60000 })),
    });
    expect(result.annual.breachWeek).toBe(7);
    expect(result.monthly.breachWeek).toBeNull();
    expect(result.recommendation).toBe('monthly');
    expect(result.reasons[0]).toContain('Annual billing breaches the reserve floor');
  });

  it('annual-safe: selects annual when reserves comfortably support upfront discount', () => {
    const result = decideTreasury({
      currentBalanceMinor: 5000000, // $50,000 cash balance
      reserveFloorMinor: 1000000,   // $10,000 floor
      terms: { monthlyPriceMinor: 50000, annualPriceMinor: 400000 },
      weeks: Array.from({ length: 12 }, () => ({ inflowMinor: 100000, outflowMinor: 50000 })),
    });
    expect(result.annual.breachWeek).toBeNull();
    expect(result.monthly.breachWeek).toBeNull();
    expect(result.recommendation).toBe('annual');
    expect(result.reasons[0]).toContain('Annual billing is cheaper');
  });

  it('neither-safe: defers when both monthly and annual breach the floor', () => {
    const result = decideTreasury({
      currentBalanceMinor: 1000000,
      reserveFloorMinor: 900000,
      terms: { monthlyPriceMinor: 100000, annualPriceMinor: 300000 },
      weeks: Array.from({ length: 12 }, () => ({ inflowMinor: 0, outflowMinor: 30000 })),
    });
    expect(result.annual.breachWeek).not.toBeNull();
    expect(result.monthly.breachWeek).not.toBeNull();
    expect(result.recommendation).toBe('defer');
    expect(result.reasons[0]).toContain('Both payment options breach');
  });
});
