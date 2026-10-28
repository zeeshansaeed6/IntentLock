import cors from 'cors';
import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { env } from './config/env.js';
import { logger, maskSecrets } from './config/logger.js';
import { approveIntent, createIntent } from './agent/graph.js';
import { eventBus } from './agent/events.js';
import { store } from './store/memory.js';
import { runScenario, type ScenarioName } from './scenarios/runner.js';
import { processWebhook } from './integrations/airwallex/webhooks.js';
import { getGateway } from './integrations/airwallex/gateway.js';
import { getRepository } from './store/repository.js';
import { getCompanyConfig } from './seed/loader.js';
import {
  authMiddleware,
  requireAuth,
  requireAdmin,
  registerAccount,
  authenticateCredentials,
  revokeSession,
  type AuthenticatedRequest,
} from './auth/auth.js';

export const app = express();

// Disable X-Powered-By header (Security Hardening Item 12)
app.disable('x-powered-by');

// Trust reverse proxy for secure cookies and rate-limiting
app.set('trust proxy', 1);

// Content Security Policy & Security Headers (Security Hardening Item 8)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", env.WEB_ORIGIN],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  })
);

// Lock CORS to exact web origin with credentials allowed
app.use(
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true,
  })
);

// HTTPS Redirect in production
app.use((req, res, next) => {
  if (env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// Cookie parser for secure httpOnly sessions
app.use(cookieParser());

// Rate Limiters (Security Hardening Item 7)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many authentication attempts. Please try again later.' } },
});

const expensiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded. Please slow down.' } },
});

// Airwallex Webhook route: MUST accept raw bytes before json parsing
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

// JSON body parser with strict 100kb limit (Security Hardening Item 6)
app.use(express.json({ limit: '100kb' }));

import { sanitizeNoSql } from './config/sanitizer.js';

app.use((req, _res, next) => {
  if (req.body) req.body = sanitizeNoSql(req.body);
  if (req.query) req.query = sanitizeNoSql(req.query) as any;
  if (req.params) req.params = sanitizeNoSql(req.params) as any;
  next();
});

// Attach authenticated session context to request
app.use(authMiddleware as express.RequestHandler);

// Health Check
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

// --- Authentication Routes (Security Hardening Item 4 & 9) ---

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const schema = z.object({
    email: z.string().trim().email().max(100),
    password: z.string().min(8).max(100),
    role: z.enum(['admin', 'user']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid input.' } });
  }

  try {
    const user = await registerAccount(parsed.data);
    return res.status(201).json({ status: 'ok', user });
  } catch (error) {
    return res.status(400).json({
      error: { code: 'REGISTRATION_FAILED', message: error instanceof Error ? error.message : 'Registration failed.' },
    });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const schema = z.object({
    email: z.string().trim().email().max(100),
    password: z.string().min(1).max(100),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Enter a valid email and password.' } });
  }

  try {
    const session = await authenticateCredentials(parsed.data.email, parsed.data.password);

    // Set secure httpOnly cookie
    res.cookie('intentlock_session', session.token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 3600 * 1000,
      path: '/',
    });

    return res.json({
      user: { id: session.userId, email: session.email, role: session.role },
      token: session.token,
    });
  } catch (error) {
    return res.status(401).json({
      error: { code: 'AUTHENTICATION_FAILED', message: 'Invalid email or password.' },
    });
  }
});

app.post('/api/auth/logout', (req: AuthenticatedRequest, res) => {
  const token = req.cookies?.intentlock_session || req.headers.authorization?.slice(7);
  if (token) revokeSession(token);
  res.clearCookie('intentlock_session', { path: '/' });
  return res.status(204).send();
});

app.get('/api/auth/me', (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Session expired or not found.' } });
  }
  return res.json({ user: req.user });
});

// --- Intent Management (Multi-Tenant Scoped: Security Hardening Item 5) ---

app.post('/api/intents', expensiveLimiter, async (req: AuthenticatedRequest, res) => {
  const input = z
    .object({
      userRequest: z.string().trim().min(5).max(2000),
      untrustedContext: z.string().max(10000).optional(),
    })
    .safeParse(req.body);
  if (!input.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'userRequest must be between 5 and 2000 characters.' } });
  }

  const ownerId = req.user?.id || 'usr_default';
  const record = await createIntent(input.data.userRequest, input.data.untrustedContext, ownerId);
  return res.status(201).json(record);
});

app.get('/api/intents', (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  const isAdmin = req.user?.role === 'admin';
  const scoped = store.intents.filter((item) => isAdmin || !item.owner_id || item.owner_id === userId);
  return res.json(scoped);
});

app.get('/api/intents/:id', (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  const isAdmin = req.user?.role === 'admin';
  const record = store.intents.find((item) => item.contract.intent_id === req.params.id);

  if (!record) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Intent not found.' } });
  if (!isAdmin && record.owner_id && record.owner_id !== userId) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Intent not found.' } });
  }

  return res.json(record);
});

app.post('/api/intents/:id/approve', async (req: AuthenticatedRequest, res) => {
  const input = z.object({ expectedSignature: z.string().optional() }).safeParse(req.body ?? {});
  const userId = req.user?.id;
  const isAdmin = req.user?.role === 'admin';

  const intentId = String(req.params.id);
  const existing = store.intents.find((i) => i.contract.intent_id === intentId);
  if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Intent not found.' } });
  if (!isAdmin && existing.owner_id && existing.owner_id !== userId) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not authorized to approve this intent.' } });
  }

  try {
    const record = await approveIntent(intentId, input.success ? input.data.expectedSignature : undefined);
    return record
      ? res.json(record)
      : res.status(409).json({ error: { code: 'INVALID_STATE', message: 'Intent is not awaiting approval.' } });
  } catch (err) {
    return res.status(409).json({
      error: {
        code: 'APPROVAL_INTEGRITY_FAILED',
        message: err instanceof Error ? err.message : 'Approval failed.',
      },
    });
  }
});

// --- Admin Protected Actions (Security Hardening Item 3) ---

app.post('/api/reset', (req: AuthenticatedRequest, res, next) => {
  if (env.NODE_ENV === 'production') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Reset route is strictly disabled in production.' } });
  }
  // In non-production, check admin privileges if user is authenticated
  if (req.user && req.user.role !== 'admin') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin privileges required.' } });
  }
  next();
}, async (_req, res) => {
  const repo = getRepository();
  await repo.reset();
  return res.json({ status: 'ok', message: 'Demo store reset successfully.' });
});

app.post('/api/scenarios/:name/run', expensiveLimiter, (req: AuthenticatedRequest, res, next) => {
  // If user context exists, require admin
  if (req.user && req.user.role !== 'admin') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin privileges required to run scenarios.' } });
  }
  next();
}, async (req, res) => {
  const allowed = ['pass', 'limit', 'mcc', 'currency', 'redteam', 'pricehike', 'judge'];
  const scenarioName = String(req.params.name);
  if (!allowed.includes(scenarioName)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown scenario.' } });
  const result = await runScenario(scenarioName as ScenarioName);
  return res.status(202).json(result);
});

app.post('/api/reconcile', (req: AuthenticatedRequest, res, next) => {
  if (req.user && req.user.role !== 'admin') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin privileges required to trigger manual reconciliation.' } });
  }
  next();
}, async (_req, res) => {
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
        message: 'Fallback reconciliation failed.',
      },
    });
  }
});

// --- Scoped Card and Transaction Endpoints (Security Hardening Item 5) ---

app.get('/api/cards', (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  const isAdmin = req.user?.role === 'admin';
  const scoped = store.cards.filter((c) => isAdmin || !c.owner_id || c.owner_id === userId);
  return res.json(scoped);
});

app.post('/api/cards/:id/freeze', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ status: z.enum(['ACTIVE', 'FROZEN', 'CLOSED']) }).safeParse(req.body);
  const card = store.cards.find((item) => item.id === req.params.id || item.airwallexCardId === req.params.id);

  if (!schema.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'status must be ACTIVE, FROZEN, or CLOSED.' } });
  if (!card) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Card not found.' } });

  const userId = req.user?.id;
  const isAdmin = req.user?.role === 'admin';
  if (!isAdmin && card.owner_id && card.owner_id !== userId) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not authorized to update this card.' } });
  }

  const intent = store.intents.find((item) => item.contract.intent_id === card.intentId);
  if (schema.data.status === 'ACTIVE' && intent?.contract.state === 'FROZEN') {
    return res.status(409).json({ error: { code: 'CONTRACT_FROZEN', message: 'This card is bound to a frozen contract; issue a replacement instead.' } });
  }

  const gateway = getGateway();
  try {
    await gateway.updateCardStatus(card.airwallexCardId ?? card.id, schema.data.status);
  } catch {
    return res.status(502).json({
      error: { code: 'GATEWAY_ERROR', message: 'Airwallex card update failed.' },
    });
  }

  card.status = schema.data.status;
  store.addAudit({
    type: 'card_status',
    message: `Card ${card.id} changed to ${card.status}`,
    tone: card.status === 'ACTIVE' ? 'green' : 'amber',
    owner_id: card.owner_id,
    metadata: { cardId: card.id, status: card.status },
  });
  return res.json(card);
});

app.get('/api/transactions', (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  const isAdmin = req.user?.role === 'admin';
  const scoped = store.transactions.filter((tx) => isAdmin || !tx.owner_id || tx.owner_id === userId);
  return res.json(scoped);
});

app.get('/api/audit', (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  const isAdmin = req.user?.role === 'admin';
  const scoped = store.audit.filter((a) => isAdmin || !a.owner_id || a.owner_id === userId);
  return res.json(scoped);
});

app.get('/api/company', (_req, res) => res.json(getCompanyConfig()));

app.get('/api/stream', (req, res) => {
  res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const disconnect = eventBus.connect(res);
  req.on('close', disconnect);
});

// Centralized 404 Route Handler
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
});

// Centralized Error Handler (Security Hardening Item 13)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const requestId = randomUUID();
  const errorMessage = err instanceof Error ? err.message : 'Unknown error';
  logger.error(`[${requestId}] Internal error: ${errorMessage}`);

  // Never return raw internal error or stack traces to client
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred. Please try again or contact support.',
      requestId,
    },
  });
});
