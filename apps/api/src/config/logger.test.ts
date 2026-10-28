import { describe, expect, it } from 'vitest';
import { maskSecrets } from './logger.js';

describe('Milestone 6, Item 1: Secret Masking and Credential Hygiene', () => {
  it('masks Bearer tokens, API keys, PANs, and passwords from log strings', () => {
    const rawLog = 'Request with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 and {"api_key":"secret_1234567890"}';
    const masked = maskSecrets(rawLog);

    expect(masked).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(masked).not.toContain('secret_1234567890');
    expect(masked).toContain('***REDACTED***');
  });

  it('masks full card PAN numbers', () => {
    const panLog = 'Processing card 5105105105104242 for authorization';
    const masked = maskSecrets(panLog);

    expect(masked).not.toContain('5105105105104242');
    expect(masked).toContain('***REDACTED***');
  });

  it('masks env file credential strings', () => {
    const envLog = 'Config: AIRWALLEX_API_KEY=super_secret_airwallex_key&LLM_API_KEY=ai_secret_xyz';
    const masked = maskSecrets(envLog);

    expect(masked).not.toContain('super_secret_airwallex_key');
    expect(masked).not.toContain('ai_secret_xyz');
    expect(masked).toContain('***REDACTED***');
  });
});
