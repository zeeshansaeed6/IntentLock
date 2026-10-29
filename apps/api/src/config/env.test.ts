import { describe, expect, it } from 'vitest';
import { loadEnvConfig } from './env.js';

describe('Environment Configuration & Security Invariants', () => {
  it('generates random INTENT_HMAC_SECRET and ADMIN_INITIAL_PASSWORD in development if not provided', () => {
    const config = loadEnvConfig({
      NODE_ENV: 'development',
    });

    expect(config.INTENT_HMAC_SECRET).toBeDefined();
    expect(config.INTENT_HMAC_SECRET.length).toBeGreaterThanOrEqual(16);
    expect(config.ADMIN_INITIAL_PASSWORD).toBeDefined();
    expect(config.ADMIN_INITIAL_PASSWORD.length).toBeGreaterThanOrEqual(16);
  });

  it('preserves user-provided INTENT_HMAC_SECRET and ADMIN_INITIAL_PASSWORD in development', () => {
    const config = loadEnvConfig({
      NODE_ENV: 'development',
      INTENT_HMAC_SECRET: 'custom-dev-hmac-secret-32-chars-long!',
      ADMIN_INITIAL_PASSWORD: 'custom-dev-admin-password-123!',
    });

    expect(config.INTENT_HMAC_SECRET).toBe('custom-dev-hmac-secret-32-chars-long!');
    expect(config.ADMIN_INITIAL_PASSWORD).toBe('custom-dev-admin-password-123!');
  });

  it('fails to start in production if both ADMIN_INITIAL_PASSWORD and INTENT_HMAC_SECRET are missing', () => {
    expect(() =>
      loadEnvConfig({
        NODE_ENV: 'production',
      })
    ).toThrow(/In production, INTENT_HMAC_SECRET and ADMIN_INITIAL_PASSWORD must be set/);
  });

  it('fails to start in production if only ADMIN_INITIAL_PASSWORD is missing', () => {
    expect(() =>
      loadEnvConfig({
        NODE_ENV: 'production',
        INTENT_HMAC_SECRET: 'super-secure-production-hmac-secret-123456789!',
      })
    ).toThrow(/In production, ADMIN_INITIAL_PASSWORD must be set/);
  });

  it('fails to start in production if only INTENT_HMAC_SECRET is missing', () => {
    expect(() =>
      loadEnvConfig({
        NODE_ENV: 'production',
        ADMIN_INITIAL_PASSWORD: 'super-secure-production-admin-password-123!',
      })
    ).toThrow(/In production, INTENT_HMAC_SECRET must be set/);
  });

  it('successfully starts in production when both required production secrets are supplied', () => {
    const config = loadEnvConfig({
      NODE_ENV: 'production',
      INTENT_HMAC_SECRET: 'production-intent-hmac-secret-at-least-32-bytes!',
      ADMIN_INITIAL_PASSWORD: 'production-admin-initial-password-secure!',
    });

    expect(config.NODE_ENV).toBe('production');
    expect(config.INTENT_HMAC_SECRET).toBe('production-intent-hmac-secret-at-least-32-bytes!');
    expect(config.ADMIN_INITIAL_PASSWORD).toBe('production-admin-initial-password-secure!');
  });
});
