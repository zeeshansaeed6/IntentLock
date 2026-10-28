import { createHmac, timingSafeEqual } from 'node:crypto';
import { store, type TransactionRecord } from '../../store/memory.js';
import { emit } from '../../agent/graph.js';

const seenEvents = new Set<string>();

export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string,
  timestamp?: string | number,
  now = Date.now(),
  maxAgeMs = 5 * 60 * 1000
): boolean {
  if (!signature || !secret) return false;

  // Reject stale timestamps (tolerance window: 5 minutes)
  if (timestamp !== undefined) {
    const ts = typeof timestamp === 'number' ? timestamp : Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(now - ts) > maxAgeMs) {
      return false;
    }
  }

  const provided = signature.replace(/^sha256=/i, '').trim();
  const hmac = createHmac('sha256', secret);
  if (timestamp !== undefined) {
    hmac.update(String(timestamp));
  }
  hmac.update(rawBody);
  const expected = hmac.digest('hex');

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export type AirwallexWebhookPayload = {
  id?: string;
  event_id?: string;
  name?: string;
  type?: string;
  data?: {
    card_id?: string;
    transaction_amount?: number;
    transaction_currency?: string;
    merchant_category_code?: string;
    merchant_info?: string;
    card_transaction_id?: string;
    failure_reason?: string;
    created_at?: string;
    [key: string]: unknown;
  };
};

export function processWebhook(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string,
  timestamp?: string | number,
  now?: number
): { status: 'processed' | 'duplicate'; eventId?: string } {
  if (!verifyWebhookSignature(rawBody, signature, secret, timestamp, now)) {
    throw new Error('Invalid webhook signature');
  }

  const payload = JSON.parse(rawBody.toString('utf8')) as AirwallexWebhookPayload;
  const eventId = payload.id ?? payload.event_id;
  if (!eventId) throw new Error('Webhook event is missing an id');

  if (seenEvents.has(eventId)) return { status: 'duplicate', eventId };
  seenEvents.add(eventId);

  const eventType = payload.name ?? payload.type ?? 'unknown';
  const data = payload.data ?? {};
  const cardId = data.card_id;

  // Map to matching card and contract
  const card = cardId ? store.cards.find((c) => c.id === cardId || c.airwallexCardId === cardId) : undefined;
  const intent = card ? store.intents.find((i) => i.contract.intent_id === card.intentId) : undefined;

  const amountMinor = Math.round(Number(data.transaction_amount ?? 0) * 100);
  const isFailed = eventType.includes('failed') || eventType === 'issuing.transaction.failed';
  const isSucceeded = eventType.includes('succeeded') || eventType === 'issuing.transaction.succeeded';

  if (card && isSucceeded && amountMinor > 0) {
    card.remainingMinor = Math.max(0, card.remainingMinor - amountMinor);
  }

  if (isSucceeded || isFailed) {
    const txId = String(data.card_transaction_id ?? eventId);
    const existingTx = store.transactions.find((tx) => tx.id === txId || tx.airwallexTransactionId === txId);
    if (!existingTx) {
      const record: TransactionRecord = {
        id: txId,
        intentId: card?.intentId ?? intent?.contract.intent_id ?? 'unknown_intent',
        cardId: card?.id,
        airwallexCardId: cardId,
        airwallexTransactionId: txId,
        merchant: data.merchant_info ?? 'Unknown Merchant',
        amountMinor,
        currency: data.transaction_currency ?? 'USD',
        mcc: data.merchant_category_code ?? '',
        outcome: isSucceeded ? 'ALLOWED' : 'BLOCKED',
        reason: isFailed ? (data.failure_reason ?? 'AIRWALLEX_DECLINED') : undefined,
        rawFailureReason: data.failure_reason,
        isSandbox: true,
        createdAt: data.created_at ?? new Date().toISOString(),
      };
      store.transactions.unshift(record);
    }
  }

  const tone = isFailed ? 'rose' : 'green';
  store.addAudit({
    type: 'webhook',
    message: `Webhook reconciled · ${eventType}`,
    tone,
    metadata: {
      eventId,
      eventType,
      cardId: cardId ?? 'unknown',
    },
  });
  emit('reconcile', 'Webhook reconciled', `At-least-once event ${eventType} recorded without duplication.`, tone, { eventId, cardId });

  return { status: 'processed', eventId };
}

export function clearWebhookDedupeForTests(): void {
  seenEvents.clear();
}
