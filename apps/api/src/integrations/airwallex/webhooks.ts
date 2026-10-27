import { createHmac, timingSafeEqual } from 'node:crypto';
import { store } from '../../store/memory.js';
import { emit } from '../../agent/graph.js';

const seenEvents = new Set<string>();

export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const provided = signature.replace(/^sha256=/i, '').trim();
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function processWebhook(rawBody: Buffer, signature: string | undefined, secret: string): { status: 'processed' | 'duplicate'; eventId?: string } {
  if (!verifyWebhookSignature(rawBody, signature, secret)) throw new Error('Invalid webhook signature');
  const payload = JSON.parse(rawBody.toString('utf8')) as { id?: string; event_id?: string; name?: string; type?: string };
  const eventId = payload.id ?? payload.event_id;
  if (!eventId) throw new Error('Webhook event is missing an id');
  if (seenEvents.has(eventId)) return { status: 'duplicate', eventId };
  seenEvents.add(eventId);
  const eventType = payload.name ?? payload.type ?? 'unknown';
  store.addAudit({ type: 'webhook', message: `Webhook reconciled · ${eventType}`, tone: eventType.includes('failed') ? 'rose' : 'green', metadata: { eventId } });
  emit('reconcile', 'Webhook reconciled', `At-least-once event ${eventType} recorded without duplication.`, eventType.includes('failed') ? 'rose' : 'green', { eventId });
  return { status: 'processed', eventId };
}

export function clearWebhookDedupeForTests(): void {
  seenEvents.clear();
}
