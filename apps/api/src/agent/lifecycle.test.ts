import { beforeEach, describe, expect, it } from 'vitest';
import { store } from '../store/memory.js';
import { createIntent, approveIntent, rejectIntent, revokeIntent } from './graph.js';
import { verifyContract } from '../domain/contract.js';
import { env } from '../config/env.js';

describe('intent reject / revoke', () => {
  beforeEach(() => {
    store.reset();
    env.DEMO_MODE = 'scripted';
  });

  it('rejecting a pending contract issues no card and keeps the signature valid', async () => {
    const record = await createIntent('Buy a team plan for our design tool, 10 seats, keep it cost-efficient.');
    if (record.contract.state !== 'PENDING_APPROVAL') return;
    const id = record.contract.intent_id;
    const rejected = await rejectIntent(id);
    expect(rejected?.contract.state).toBe('REVOKED');
    expect(store.cards.find((c) => c.intentId === id)).toBeUndefined();
    expect(verifyContract(rejected!.contract, env.INTENT_HMAC_SECRET)).toBe(true);
    expect(await approveIntent(id)).toBeUndefined();
    expect(await rejectIntent(id)).toBeUndefined();
  });

  it('revoking an active contract freezes its card', async () => {
    const record = await createIntent('Buy a team plan for our design tool, 10 seats, keep it cost-efficient.');
    const id = record.contract.intent_id;
    if (record.contract.state === 'PENDING_APPROVAL') await approveIntent(id);
    const revoked = await revokeIntent(id);
    expect(revoked?.contract.state).toBe('REVOKED');
    const card = store.cards.find((c) => c.intentId === id);
    if (card) expect(card.status).toBe('FROZEN');
    expect(await revokeIntent(id)).toBeUndefined();
  });
});
