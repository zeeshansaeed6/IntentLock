import { createHmac } from 'node:crypto';
import { describe, expect, it, beforeEach } from 'vitest';
import { clearWebhookDedupeForTests, processWebhook, verifyWebhookSignature } from './webhooks.js';
import { store } from '../../store/memory.js';

describe('Airwallex webhook verification', () => {
  beforeEach(() => {
    clearWebhookDedupeForTests();
    store.reset();
  });

  it('verifies the raw bytes and deduplicates delivery retries', () => {
    const body = Buffer.from('{"id":"evt_1","name":"issuing.transaction.succeeded"}');
    const signature = createHmac('sha256', 'secret').update(body).digest('hex');
    expect(verifyWebhookSignature(body, signature, 'secret')).toBe(true);
    expect(processWebhook(body, signature, 'secret').status).toBe('processed');
    expect(processWebhook(body, signature, 'secret').status).toBe('duplicate');
  });

  it('rejects a re-serialized or altered payload', () => {
    const body = Buffer.from('{"id":"evt_2","name":"issuing.transaction.failed"}');
    const signature = createHmac('sha256', 'secret').update(body).digest('hex');
    expect(verifyWebhookSignature(Buffer.from('{ "id": "evt_2" }'), signature, 'secret')).toBe(false);
  });

  it('verifies concatenated timestamp and raw body', () => {
    const body = Buffer.from('{"id":"evt_3","name":"issuing.transaction.succeeded"}');
    const now = 1700000000000;
    const timestamp = String(now);
    const signature = createHmac('sha256', 'secret').update(timestamp).update(body).digest('hex');

    expect(verifyWebhookSignature(body, signature, 'secret', timestamp, now)).toBe(true);
    expect(processWebhook(body, signature, 'secret', timestamp, now).status).toBe('processed');
  });

  it('rejects stale timestamps older than 5 minutes', () => {
    const body = Buffer.from('{"id":"evt_4","name":"issuing.transaction.succeeded"}');
    const now = 1700000000000;
    const staleTimestamp = String(now - 10 * 60 * 1000); // 10 minutes ago
    const signature = createHmac('sha256', 'secret').update(staleTimestamp).update(body).digest('hex');

    expect(verifyWebhookSignature(body, signature, 'secret', staleTimestamp, now)).toBe(false);
    expect(() => processWebhook(body, signature, 'secret', staleTimestamp, now)).toThrow('Invalid webhook signature');
  });

  it('maps issuing.transaction.succeeded to card limit and transaction list', () => {
    store.cards.push({
      id: 'crd_test_1',
      airwallexCardId: 'crd_test_1',
      intentId: 'intent_1',
      lastFour: '4242',
      status: 'ACTIVE',
      limitMinor: 10000,
      remainingMinor: 10000,
    });

    const body = Buffer.from(JSON.stringify({
      id: 'evt_success_1',
      name: 'issuing.transaction.succeeded',
      data: {
        card_id: 'crd_test_1',
        transaction_amount: 35.50,
        transaction_currency: 'USD',
        merchant_category_code: '5734',
        merchant_info: 'Figma Inc',
        card_transaction_id: 'ctx_999',
      },
    }));

    const now = 1700000000000;
    const timestamp = String(now);
    const signature = createHmac('sha256', 'secret').update(timestamp).update(body).digest('hex');

    const result = processWebhook(body, signature, 'secret', timestamp, now);
    expect(result.status).toBe('processed');

    const card = store.cards.find((c) => c.id === 'crd_test_1');
    expect(card?.remainingMinor).toBe(10000 - 3550); // 6450
    expect(store.transactions).toHaveLength(1);
    expect(store.transactions[0].outcome).toBe('ALLOWED');
    expect(store.transactions[0].amountMinor).toBe(3550);
    expect(store.transactions[0].airwallexTransactionId).toBe('ctx_999');
  });
});
