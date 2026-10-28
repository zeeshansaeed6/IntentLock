import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { env } from './config/env.js';
import { approveIntent, createIntent } from './agent/graph.js';
import { eventBus } from './agent/events.js';
import { store } from './store/memory.js';
import { runScenario, type ScenarioName } from './scenarios/runner.js';
import { processWebhook } from './integrations/airwallex/webhooks.js';
import { getGateway } from './integrations/airwallex/gateway.js';
import { getDemoUser, loginDemo, logoutDemo } from './auth/demo.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN }));

app.post('/api/webhooks/airwallex', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const signature = req.header('x-signature') ?? req.header('x-airwallex-signature');
    const timestamp = req.header('x-timestamp');
    const result = processWebhook(req.body as Buffer, signature, env.AIRWALLEX_WEBHOOK_SECRET ?? '', timestamp);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(401).json({
      error: {
        code: 'INVALID_WEBHOOK',
        message: error instanceof Error ? error.message : 'Webhook signature verification failed',
      },
    });
  }
});

app.use(express.json({ limit: '100kb' }));

app.get('/api/health', async (_req, res) => {
  const gateway = getGateway();
  let fundedBalance: { currency: string; availableMinor: number; totalMinor: number } | undefined;
  if (gateway.mode === 'live') {
    try {
      fundedBalance = await gateway.getFundedBalance();
    } catch {
      // Gracefully handle if balance query fails
    }
  }

  res.json({
    status: 'ok',
    service: 'intentlock-api',
    mode: env.DEMO_MODE,
    airwallex: env.AIRWALLEX_CLIENT_ID && env.AIRWALLEX_API_KEY ? 'sandbox' : 'not_configured',
    ...(fundedBalance ? { fundedBalance } : {}),
  });
});

app.post('/api/auth/login', (req, res) => {
  const input = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(200) }).safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Enter any valid email and a password for demo access.' } });
  return res.json(loginDemo(input.data.email, input.data.password));
});

app.get('/api/auth/me', (req, res) => {
  const user = getDemoUser(req.header('authorization')?.replace(/^Bearer\s+/i, ''));
  return user ? res.json({ user }) : res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Demo session not found' } });
});

app.post('/api/auth/logout', (req, res) => {
  logoutDemo(req.header('authorization')?.replace(/^Bearer\s+/i, ''));
  return res.status(204).send();
});

app.get('/api/overview', (_req, res) => {
  res.json({
    cashBalanceMinor: 1842000,
    reserveFloorMinor: 1200000,
    activeContracts: 1,
    blockedAttempts: 12,
    protectedMinor: 249900,
    runway: [
      { week: 'W1', monthly: 18420, annual: 18420 },
      { week: 'W2', monthly: 17580, annual: 17580 },
      { week: 'W3', monthly: 16810, annual: 16810 },
      { week: 'W4', monthly: 15940, annual: 15940 },
      { week: 'W5', monthly: 15100, annual: 15100 },
      { week: 'W6', monthly: 14280, annual: 14280 },
      { week: 'W7', monthly: 13420, annual: 10980 },
      { week: 'W8', monthly: 12600, annual: 10250 },
      { week: 'W9', monthly: 11720, annual: 9540 },
      { week: 'W10', monthly: 10880, annual: 8850 },
      { week: 'W11', monthly: 10040, annual: 8140 },
      { week: 'W12', monthly: 9220, annual: 7480 },
    ],
  });
});

app.post('/api/intents', async (req, res) => {
  const input = z.object({ userRequest: z.string().trim().min(5).max(2000) }).safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'userRequest must be between 5 and 2000 characters' } });
  const record = await createIntent(input.data.userRequest);
  return res.status(201).json(record);
});

app.get('/api/intents', (_req, res) => res.json(store.intents));

app.get('/api/intents/:id', (req, res) => {
  const record = store.intents.find((item) => item.contract.intent_id === req.params.id);
  return record ? res.json(record) : res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Intent not found' } });
});

app.post('/api/intents/:id/approve', async (req, res) => {
  const record = await approveIntent(req.params.id);
  return record ? res.json(record) : res.status(409).json({ error: { code: 'INVALID_STATE', message: 'Intent is not awaiting approval' } });
});

app.post('/api/intents/:id/reject', (req, res) => {
  const record = store.intents.find((item) => item.contract.intent_id === req.params.id);
  if (!record) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Intent not found' } });
  record.contract = { ...record.contract, state: 'REVOKED' };
  store.addAudit({ type: 'rejection', message: 'Human rejected the purchase contract.', tone: 'rose', metadata: { intentId: req.params.id } });
  return res.json(record);
});

app.post('/api/intents/:id/revoke', (req, res) => {
  const record = store.intents.find((item) => item.contract.intent_id === req.params.id);
  if (!record) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Intent not found' } });
  record.contract = { ...record.contract, state: 'REVOKED' };
  return res.json(record);
});

app.get('/api/cards', (_req, res) => res.json(store.cards));

app.post('/api/cards/:id/status', async (req, res) => {
  const input = z.object({ status: z.enum(['ACTIVE', 'FROZEN', 'CLOSED']) }).safeParse(req.body);
  const card = store.cards.find((item) => item.id === req.params.id || item.airwallexCardId === req.params.id);
  if (!input.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'status must be ACTIVE, FROZEN, or CLOSED' } });
  if (!card) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Card not found' } });
  const intent = store.intents.find((item) => item.contract.intent_id === card.intentId);
  if (input.data.status === 'ACTIVE' && intent?.contract.state === 'FROZEN') {
    return res.status(409).json({ error: { code: 'CONTRACT_FROZEN', message: 'This card is bound to a frozen contract; issue a replacement instead.' } });
  }

  const gateway = getGateway();
  try {
    await gateway.updateCardStatus(card.airwallexCardId ?? card.id, input.data.status);
  } catch (error) {
    return res.status(502).json({
      error: { code: 'GATEWAY_ERROR', message: error instanceof Error ? error.message : 'Airwallex card update failed' },
    });
  }

  card.status = input.data.status;
  store.addAudit({
    type: 'card_status',
    message: `Card ${card.id} changed to ${card.status}`,
    tone: card.status === 'ACTIVE' ? 'green' : 'amber',
    metadata: { cardId: card.id, status: card.status },
  });
  return res.json(card);
});

app.get('/api/transactions', (_req, res) => res.json(store.transactions));
app.get('/api/audit', (_req, res) => res.json(store.audit));

app.post('/api/reconcile', async (_req, res) => {
  try {
    const gateway = getGateway();
    const remoteTransactions = await gateway.listTransactions();
    let reconciledCount = 0;

    for (const tx of remoteTransactions) {
      const existing = store.transactions.find(
        (local) => local.id === tx.id || local.airwallexTransactionId === tx.id
      );
      if (!existing) {
        const card = store.cards.find((c) => c.id === tx.cardId || c.airwallexCardId === tx.cardId);
        const isAllowed = tx.status === 'CLEARING' || tx.status === 'APPROVED';
        if (card && isAllowed && tx.amountMinor > 0) {
          card.remainingMinor = Math.max(0, card.remainingMinor - tx.amountMinor);
        }
        store.transactions.unshift({
          id: tx.id,
          intentId: card?.intentId ?? 'unknown_intent',
          cardId: card?.id,
          airwallexCardId: tx.cardId,
          airwallexTransactionId: tx.id,
          merchant: tx.merchantName ?? 'Unknown Merchant',
          amountMinor: tx.amountMinor,
          currency: tx.currency,
          mcc: '',
          outcome: isAllowed ? 'ALLOWED' : 'BLOCKED',
          reason: isAllowed ? undefined : (tx.failureReason ?? 'DECLINED'),
          rawFailureReason: tx.failureReason,
          isSandbox: true,
          createdAt: tx.createdAt,
        });
        reconciledCount++;
      }
    }

    store.addAudit({
      type: 'reconciliation',
      message: `Fallback poller reconciled ${reconciledCount} transactions from Airwallex`,
      tone: 'green',
      metadata: { reconciledCount: String(reconciledCount) },
    });

    return res.json({
      status: 'ok',
      reconciledCount,
      transactionsCount: store.transactions.length,
    });
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 'RECONCILE_FAILED',
        message: error instanceof Error ? error.message : 'Fallback reconciliation failed',
      },
    });
  }
});

app.get('/api/stream', (req, res) => {
  res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const disconnect = eventBus.connect(res);
  req.on('close', disconnect);
});

app.post('/api/scenarios/:name/run', async (req, res) => {
  const allowed = ['pass', 'limit', 'mcc', 'currency', 'redteam', 'pricehike', 'judge'];
  if (!allowed.includes(req.params.name)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown scenario' } });
  const result = await runScenario(req.params.name as ScenarioName);
  return res.status(202).json(result);
});

app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});
