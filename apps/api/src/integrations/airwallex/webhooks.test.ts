import { createHmac } from 'node:crypto';
import { describe, expect, it, beforeEach } from 'vitest';
import { clearWebhookDedupeForTests, processWebhook, verifyWebhookSignature } from './webhooks.js';

describe('Airwallex webhook verification', () => {
  beforeEach(() => clearWebhookDedupeForTests());

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
});
