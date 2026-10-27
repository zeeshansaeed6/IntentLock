import { describe, expect, it } from 'vitest';
import { fromMajorUnits, minor, toMajorUnits } from './money.js';

describe('money', () => {
  it('converts decimal major units without floating point drift', () => {
    expect(fromMajorUnits('100.01')).toBe(10001);
    expect(fromMajorUnits('0.1')).toBe(10);
    expect(toMajorUnits(minor(12345))).toBe(123.45);
  });

  it('rejects fractions of a cent', () => {
    expect(() => fromMajorUnits('10.001')).toThrow();
  });
});
