import { beforeEach, describe, expect, it } from 'vitest';
import { store } from '../store/memory.js';
import { runScenario } from './runner.js';

describe('scripted scenarios', () => {
  beforeEach(() => store.reset());

  it('shows a pass and distinct enforcement declines', async () => {
    const result = await runScenario('judge');
    const reasons = result.transactions.map((transaction) => transaction.reason).filter(Boolean);
    expect(result.transactions.some((transaction) => transaction.outcome === 'ALLOWED')).toBe(true);
    expect(reasons).toEqual(expect.arrayContaining(['LIMIT_EXCEEDED', 'MERCHANT_CATEGORY_NOT_ALLOWED', 'CURRENCY_NOT_ALLOWED']));
    expect(store.cards.filter((card) => card.status === 'FROZEN').length).toBeGreaterThan(0);
  });
});
