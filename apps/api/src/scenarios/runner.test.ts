import { beforeEach, describe, expect, it } from 'vitest';
import { store } from '../store/memory.js';
import { runScenario } from './runner.js';
import { env } from '../config/env.js';

describe('scripted scenarios', () => {
  beforeEach(() => {
    store.reset();
    env.DEMO_MODE = 'scripted';
  });

  it('shows a pass and distinct enforcement declines', async () => {
    const result = await runScenario('judge');
    const reasons = result.transactions.map((transaction) => transaction.reason).filter(Boolean);
    expect(result.transactions.some((transaction) => transaction.outcome === 'ALLOWED')).toBe(true);
    expect(reasons).toEqual(expect.arrayContaining(['LIMIT_EXCEEDED', 'MERCHANT_CATEGORY_NOT_ALLOWED', 'CURRENCY_NOT_ALLOWED']));
    expect(store.cards.filter((card) => card.status === 'FROZEN').length).toBeGreaterThan(0);
    expect(result.isSimulated).toBe(false);
    expect(result.transactions.some((transaction) => transaction.isSimulated)).toBe(false);
  });

  it('runs each red-team attack and never lets one bypass the controls', async () => {
    for (const attack of ['prompt_injection', 'limit_raise', 'mcc_evasion'] as const) {
      store.reset();
      const result = await runScenario('redteam', { attack });
      const outcome = result.outcomes[0] as { attack: string; result: string };
      expect(outcome.attack).toBe(attack);
      expect(outcome.result).not.toBe('bypassed');
      const event = store.audit.find((a) => a.type === 'redteam');
      expect(event?.metadata?.attack).toBe(attack);
      expect(event?.metadata?.result).toBe(outcome.result);
    }
  });

  it('declines the MCC-evasion and limit-raise probes for the right reasons', async () => {
    store.reset();
    await runScenario('redteam', { attack: 'mcc_evasion' });
    expect(store.transactions[0]?.reason).toBe('MERCHANT_CATEGORY_NOT_ALLOWED');
    store.reset();
    await runScenario('redteam', { attack: 'limit_raise' });
    expect(store.transactions[0]?.reason).toBe('LIMIT_EXCEEDED');
  });
});
