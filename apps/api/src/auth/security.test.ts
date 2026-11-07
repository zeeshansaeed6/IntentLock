import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  registerAccount,
  authenticateCredentials,
  requireAuth,
  requireAdmin,
  type AuthenticatedRequest,
} from './auth.js';
import { store, verifyAuditLog } from '../store/memory.js';
import { createIntent } from '../agent/graph.js';
import { eventBus } from '../agent/events.js';

describe('Milestone 6: Security Hardening Automated Test Suite', () => {
  beforeEach(() => {
    store.reset();
  });

  describe('Item 3: Admin Endpoint Protection & RBAC', () => {
    it('returns 401 for unauthenticated anonymous visitor', () => {
      let statusCode = 0;
      let responseBody: any = null;

      const req = {} as AuthenticatedRequest;
      const res = {
        status: (code: number) => {
          statusCode = code;
          return { json: (body: any) => { responseBody = body; } };
        },
      } as any;
      const next = () => {};

      requireAdmin(req, res, next);
      expect(statusCode).toBe(401);
      expect(responseBody.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 for authenticated non-admin regular user', () => {
      let statusCode = 0;
      let responseBody: any = null;

      const req = {
        user: { id: 'usr_normal_123', email: 'user@intentlock.io', role: 'user' },
      } as AuthenticatedRequest;
      const res = {
        status: (code: number) => {
          statusCode = code;
          return { json: (body: any) => { responseBody = body; } };
        },
      } as any;
      const next = () => {};

      requireAdmin(req, res, next);
      expect(statusCode).toBe(403);
      expect(responseBody.error.code).toBe('FORBIDDEN');
    });

    it('allows access for authenticated admin user', () => {
      let nextCalled = false;
      const req = {
        user: { id: 'usr_admin_001', email: 'admin@intentlock.io', role: 'admin' },
      } as AuthenticatedRequest;
      const res = {} as any;
      const next = () => { nextCalled = true; };

      requireAdmin(req, res, next);
      expect(nextCalled).toBe(true);
    });
  });

  describe('Item 4 & Item 9: Password Hashing & Robust Authentication', () => {
    it('rejects passwords shorter than 8 characters', async () => {
      await expect(
        registerAccount({ email: 'newuser@intentlock.io', password: 'abc' })
      ).rejects.toThrow('Password must be at least 8 characters long.');
    });

    it('rejects common dictionary passwords', async () => {
      await expect(
        registerAccount({ email: 'newuser@intentlock.io', password: 'password123' })
      ).rejects.toThrow('This password is too common and cannot be used.');
    });

    it('successfully registers with secure password and authenticates', async () => {
      const email = `test_dev_${Date.now()}@intentlock.io`;
      const account = await registerAccount({ email, password: 'ComplexPassword!2026' });
      expect(account.id).toBeDefined();
      expect(account.role).toBe('user');

      const session = await authenticateCredentials(email, 'ComplexPassword!2026');
      expect(session.token).toMatch(/^sess_/);
      expect(session.userId).toBe(account.id);
    });

    it('returns generic failure message for both unknown user and wrong password', async () => {
      await expect(
        authenticateCredentials('nonexistent@intentlock.io', 'SomePassword123!')
      ).rejects.toThrow('Invalid email or password.');

      await expect(
        authenticateCredentials('admin@intentlock.io', 'WrongPassword123!')
      ).rejects.toThrow('Invalid email or password.');
    });
  });

  describe('Item 5: Multi-Tenant Object-Level Authorization Scoping', () => {
    it('scopes intents by owner_id and prevents cross-user access', async () => {
      const userAId = 'usr_tenant_A';
      const userBId = 'usr_tenant_B';

      // User A creates an intent
      const intentA = await createIntent('40 GPU hours, budget $90', undefined, userAId);
      expect(intentA.owner_id).toBe(userAId);
      expect(intentA.contract.owner_id).toBe(userAId);

      // Verify User A's intent is stored
      const stored = store.intents.find((i) => i.contract.intent_id === intentA.contract.intent_id);
      expect(stored).toBeDefined();
      expect(stored?.owner_id).toBe(userAId);

      // Simulate User B querying User A's resource:
      const userBQuery = store.intents.filter((i) => i.owner_id === userBId);
      expect(userBQuery).toHaveLength(0); // User B sees 0 intents

      // Attempting to access User A's intent as User B
      const canUserBAccess = stored?.owner_id === userBId;
      expect(canUserBAccess).toBe(false);
    });
  });
  describe('Item 6: NoSQL Operator Injection Protection', () => {
    it('sanitizes and strips malicious MongoDB operators ($gt, $where, nested dots)', async () => {
      const { sanitizeNoSql } = await import('../config/sanitizer.js');

      const maliciousPayload = {
        username: 'admin',
        password: { $gt: '' },
        nested: {
          'config.injection': 'evil',
          safeKey: 12345,
        },
      };

      const sanitized: any = sanitizeNoSql(maliciousPayload);
      expect(sanitized.password).toEqual({});
      expect(sanitized.nested['config.injection']).toBeUndefined();
      expect(sanitized.nested.safeKey).toBe(12345);
    });
  });

  describe('Stream Isolation & Audit Integrity', () => {
    it('keeps user A events hidden from user B while admins see all events', () => {
      const userAWrite = vi.fn();
      const userBWrite = vi.fn();
      const adminWrite = vi.fn();

      const disconnectA = eventBus.connect({ write: userAWrite } as any, 'user-a', 'user');
      const disconnectB = eventBus.connect({ write: userBWrite } as any, 'user-b', 'user');
      const disconnectAdmin = eventBus.connect({ write: adminWrite } as any, 'admin-1', 'admin');

      eventBus.publish({ id: 'evt-a', type: 'execute', title: 'User A event', detail: 'A-only event', tone: 'green', timestamp: new Date().toISOString(), ownerId: 'user-a' });
      eventBus.publish({ id: 'evt-b', type: 'execute', title: 'User B event', detail: 'B-only event', tone: 'green', timestamp: new Date().toISOString(), ownerId: 'user-b' });

      expect(userAWrite).toHaveBeenCalledTimes(1);
      expect(userBWrite).toHaveBeenCalledTimes(1);
      expect(adminWrite).toHaveBeenCalledTimes(2);
      expect(String(userAWrite.mock.calls[0][0])).toContain('user-a');
      expect(String(userBWrite.mock.calls[0][0])).toContain('user-b');

      disconnectA();
      disconnectB();
      disconnectAdmin();
    });

    it('verifies the append-only audit log hash chain', () => {
      const first = store.addAudit({ type: 'snapshot', message: 'first event', tone: 'green' });
      const second = store.addAudit({ type: 'snapshot', message: 'second event', tone: 'green', owner_id: 'user-a' });

      expect(verifyAuditLog(store.audit)).toBe(true);
      expect(first.prevHash).toBe('');
      expect(second.prevHash).toBe(first.hash);

      const tampered = { ...store.audit[0], message: 'tampered' };
      expect(verifyAuditLog([tampered, ...store.audit.slice(1)])).toBe(false);
    });
  });
});

