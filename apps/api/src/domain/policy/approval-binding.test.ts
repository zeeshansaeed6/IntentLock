import { beforeEach, describe, expect, it } from 'vitest';
import { createIntent, approveIntent } from '../../agent/graph.js';
import { store } from '../../store/memory.js';
import { authorize } from '../../enforcement/authorization.js';

describe('Milestone 3: Approval binding and decline isolation', () => {
  beforeEach(() => store.reset());

  it('reaches PENDING_APPROVAL for default SaaS request and binds approval to contract hash', async () => {
    // Default SaaS request is $500, which exceeds the $300 approval threshold
    const record = await createIntent('Buy a team plan for our design tool, 10 seats, keep it cost-efficient.');
    expect(record.contract.state).toBe('PENDING_APPROVAL');
    expect(record.policy.requiresApproval).toBe(true);
    expect(store.cards).toHaveLength(0); // Card not issued while pending approval

    // Attempt approval with tampered contract signature
    await expect(approveIntent(record.contract.intent_id, 'tampered_signature_hex')).rejects.toThrow('SIGNATURE_MISMATCH');

    // Attempt approval with tampered merchant field
    const originalMerchant = record.contract.merchant.name;
    record.contract.merchant.name = 'Malicious Unapproved Vendor';
    await expect(approveIntent(record.contract.intent_id)).rejects.toThrow('CONTRACT_TAMPERED');

    // Restore merchant and approve cleanly with valid signature
    record.contract.merchant.name = originalMerchant;
    const approved = await approveIntent(record.contract.intent_id, record.contract.signature);
    expect(approved?.contract.state).toBe('ACTIVE');
    expect(store.cards).toHaveLength(1);
    expect(store.cards[0].status).toBe('ACTIVE');
  });

  it('ordinary declines do NOT freeze the card, while integrity anomalies freeze the card', async () => {
    const record = await createIntent('Buy a team plan for our design tool, 10 seats, keep it cost-efficient.');
    const approved = await approveIntent(record.contract.intent_id);
    const card = store.cards[0];
    expect(card.status).toBe('ACTIVE');

    // 1. Ordinary decline: limit exceeded ($600 exceeds $500 cap)
    const limitDecline = authorize({
      intentId: record.contract.intent_id,
      cardId: card.id,
      merchant: record.contract.merchant.name,
      mcc: record.contract.allowed_mcc[0],
      amountMinor: 60000,
      currency: 'USD',
    });
    expect(limitDecline.accepted).toBe(false);
    expect(limitDecline.reason).toBe('LIMIT_EXCEEDED');
    expect(card.status).toBe('ACTIVE'); // Card NOT frozen!

    // 2. Ordinary decline: wrong MCC
    const mccDecline = authorize({
      intentId: record.contract.intent_id,
      cardId: card.id,
      merchant: record.contract.merchant.name,
      mcc: '5812',
      amountMinor: 1000,
      currency: 'USD',
    });
    expect(mccDecline.accepted).toBe(false);
    expect(mccDecline.reason).toBe('MERCHANT_CATEGORY_NOT_ALLOWED');
    expect(card.status).toBe('ACTIVE'); // Card NOT frozen!

    // 3. Ordinary decline: wrong currency
    const currencyDecline = authorize({
      intentId: record.contract.intent_id,
      cardId: card.id,
      merchant: record.contract.merchant.name,
      mcc: record.contract.allowed_mcc[0],
      amountMinor: 1000,
      currency: 'EUR',
    });
    expect(currencyDecline.accepted).toBe(false);
    expect(currencyDecline.reason).toBe('CURRENCY_NOT_ALLOWED');
    expect(card.status).toBe('ACTIVE'); // Card NOT frozen!

    // 4. Integrity anomaly: unknown/unauthorized merchant
    const merchantAnomaly = authorize({
      intentId: record.contract.intent_id,
      cardId: card.id,
      merchant: 'Suspicious Hacker Store',
      mcc: record.contract.allowed_mcc[0],
      amountMinor: 1000,
      currency: 'USD',
    });
    expect(merchantAnomaly.accepted).toBe(false);
    expect(merchantAnomaly.reason).toBe('MERCHANT_NOT_ALLOWED');
    expect(card.status).toBe('FROZEN'); // Integrity anomaly FREEZES the card!
  });
});
