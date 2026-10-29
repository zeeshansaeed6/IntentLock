import { describe, expect, it } from 'vitest';
import http from 'node:http';
import { Duplex } from 'node:stream';
import { app } from '../app.js';

interface DispatchOptions {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
}

interface DispatchResponse {
  status: number;
  headers: {
    get: (name: string) => string | null;
  };
  json: () => Promise<any>;
  text: () => Promise<string>;
}

function dispatchRequest(options: DispatchOptions): Promise<DispatchResponse> {
  return new Promise((resolve) => {
    const socket = new Duplex({ read() {}, write(_chunk, _enc, cb) { cb(); } }) as any;
    socket.remoteAddress = '127.0.0.1';
    socket.encrypted = false;
    const req = new http.IncomingMessage(socket);
    req.url = options.url;
    req.method = options.method || 'GET';
    const bodyBuf = options.body ? Buffer.from(options.body) : undefined;
    req.headers = {
      host: 'localhost',
      'x-forwarded-for': '127.0.0.1',
      ...(bodyBuf ? { 'content-length': String(bodyBuf.length) } : {}),
      ...options.headers,
    };

    const res = new http.ServerResponse(req);
    res.assignSocket(socket);

    const chunks: Buffer[] = [];
    const origWrite = res.write;
    res.write = function (chunk: any, ...args: any[]): boolean {
      if (chunk) chunks.push(Buffer.from(chunk));
      return (origWrite as any).apply(res, [chunk, ...args]);
    };
    const origEnd = res.end;
    res.end = function (chunk?: any, ...args: any[]): any {
      if (chunk && typeof chunk !== 'function') chunks.push(Buffer.from(chunk));
      const endResult = (origEnd as any).apply(res, [chunk, ...args]);
      const resBody = Buffer.concat(chunks).toString('utf8');
      const lowerHeaders: Record<string, string> = {};
      const rawHeaders = res.getHeaders();
      for (const [k, v] of Object.entries(rawHeaders)) {
        if (v !== undefined) {
          lowerHeaders[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
        }
      }

      resolve({
        status: res.statusCode,
        headers: {
          get: (name: string) => lowerHeaders[name.toLowerCase()] ?? null,
        },
        json: async () => JSON.parse(resBody),
        text: async () => resBody,
      });
      return endResult;
    };

    (app as any).handle(req, res);
    if (bodyBuf) {
      req.push(bodyBuf);
    }
    req.push(null);
  });
}

describe('Milestone 6 Security: HTTP Security Headers, Cookies & Production Hardening', () => {
  it('sets strict Content-Security-Policy (CSP) headers', async () => {
    const res = await dispatchRequest({ url: '/api/health' });
    const csp = res.headers.get('content-security-policy');
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
  });

  it('disables x-powered-by header (Item 12)', async () => {
    const res = await dispatchRequest({ url: '/api/health' });
    expect(res.headers.get('x-powered-by')).toBeNull();
  });

  it('sets X-Content-Type-Options: nosniff and X-Frame-Options', async () => {
    const res = await dispatchRequest({ url: '/api/health' });
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  });

  it('sets Strict-Transport-Security (HSTS) header', async () => {
    const res = await dispatchRequest({ url: '/api/health' });
    const hsts = res.headers.get('strict-transport-security');
    expect(hsts).toBeDefined();
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
  });

  it('sets httpOnly, sameSite, path cookie flags on login session', async () => {
    const testEmail = `header_user_${Date.now()}@intentlock.io`;
    const password = 'SecurePassword123!';

    // Register first
    await dispatchRequest({
      url: '/api/auth/register',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password }),
    });

    const res = await dispatchRequest({
      url: '/api/auth/login',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
    const res = await dispatchRequest({ url: '/api/non_existent_route_test' });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Route not found.');
    expect(body.stack).toBeUndefined();
    expect(body.error.stack).toBeUndefined();
  });
});
