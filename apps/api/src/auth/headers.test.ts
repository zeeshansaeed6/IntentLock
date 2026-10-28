import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { app } from '../app.js';

describe('Milestone 6 Security: HTTP Security Headers, Cookies & Production Hardening', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('sets strict Content-Security-Policy (CSP) headers', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const csp = res.headers.get('content-security-policy');
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
  });

  it('disables x-powered-by header (Item 12)', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.headers.get('x-powered-by')).toBeNull();
  });

  it('sets X-Content-Type-Options: nosniff and X-Frame-Options', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  });

  it('sets Strict-Transport-Security (HSTS) header', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const hsts = res.headers.get('strict-transport-security');
    expect(hsts).toBeDefined();
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
  });

  it('sets httpOnly, sameSite, path cookie flags on login session', async () => {
    const testEmail = `header_user_${Date.now()}@intentlock.io`;
    const password = 'SecurePassword123!';

    // Register first
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password }),
    });

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password }),
    });

    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Path=/');
  });

  it('returns generic error responses redacting stack traces and internal details (Item 13)', async () => {
    const res = await fetch(`${baseUrl}/api/non_existent_route_test`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Route not found.');
    expect(body.stack).toBeUndefined();
    expect(body.error.stack).toBeUndefined();
  });
});
