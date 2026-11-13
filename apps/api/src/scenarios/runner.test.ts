import { beforeEach, describe, expect, it } from 'vitest';
import { store } from '../store/memory.js';
import { runScenario } from './runner.js';
import { env } from '../config/env.js';
import { createIntent } from '../agent/graph.js';
import { decideTreasury, DEFAULT_SAAS_TERMS } from '../domain/treasury/engine.js';
import { loadCompanySeed } from '../seed/loader.js';

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

  it('hero scenario: annual breaches the floor in week 7, monthly is chosen', async () => {
    const record = await createIntent('Buy a team plan for our design tool, 10 seats, keep it cost-efficient.');
    expect(record.contract.decision).toBe('monthly');
    const plan = store.audit.find((a) => a.type === 'plan');
    expect(plan?.message).toContain('Monthly recommendation');
    const seed = loadCompanySeed();
    const d = decideTreasury({
      currentBalanceMinor: seed.currentBalanceMinor,
      reserveFloorMinor: seed.reserveFloorMinor,
      weeks: seed.weeks,
      terms: DEFAULT_SAAS_TERMS,
    });
    expect(d.annual.breachWeek).toBe(7);
    expect(d.monthly.breachWeek).toBeNull();
  });

  it('price hike revises monthly to defer, freezes the old card and issues no new card', async () => {
    store.reset();
    const result = await runScenario('pricehike');
    const outcome = result.outcomes[0] as { previousDecision: string; revisedDecision: string; oldCardId: string };
    expect(outcome.previousDecision).toBe('monthly');
    expect(outcome.revisedDecision).toBe('defer');
    expect(store.cards.find((c) => c.id === outcome.oldCardId)?.status).toBe('FROZEN');
    const deferred = store.intents[0];
    expect(deferred.contract.state).toBe('DRAFT');
    expect(deferred.contract.max_total_minor).toBe(0);
    expect(store.cards.filter((c) => c.intentId === deferred.contract.intent_id)).toHaveLength(0);
  });

  it('mock card controls agree with local enforcement, so no false anomalies are raised', async () => {
    for (const attack of ['prompt_injection', 'limit_raise', 'mcc_evasion'] as const) {
      store.reset();
      await runScenario('redteam', { attack });
      expect(store.audit.filter((a) => a.type === 'anomaly')).toHaveLength(0);
    }
  });
});
