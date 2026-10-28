import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { LiveGateway } from './gateway.js';
import { AirwallexClient } from './client.js';
import { env } from '../../config/env.js';

describe('Milestone 5: LiveGateway Contract Tests with Mocked Fetch', () => {
  const originalFetch = global.fetch;
  const originalClientId = env.AIRWALLEX_CLIENT_ID;
  const originalApiKey = env.AIRWALLEX_API_KEY;

  beforeEach(() => {
    vi.resetAllMocks();
    (env as any).AIRWALLEX_CLIENT_ID = 'mock_client_id';
    (env as any).AIRWALLEX_API_KEY = 'mock_api_key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    (env as any).AIRWALLEX_CLIENT_ID = originalClientId;
    (env as any).AIRWALLEX_API_KEY = originalApiKey;
  });

  it('authenticates, ensures account, creates virtual card, and freezes it with correct API calls', async () => {
    const mockResponses: Record<string, any> = {
      '/api/v1/authentication/login': {
        token: 'mock_bearer_token_xyz',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
      '/api/v1/global_accounts': {
        items: [{ id: 'ga_sandbox_123', currency: 'USD', status: 'ACTIVE' }],
      },
      '/api/v1/simulation/deposit': {
        status: 'SUCCEEDED',
      },
      '/api/v1/issuing/cardholders/create': {
        cardholder_id: 'ch_sandbox_9999',
        status: 'ACTIVE',
      },
      '/api/v1/issuing/cards/create': {
        card_id: 'card_airwallex_live_1234',
        card_number: '5105105105101234',
        card_status: 'ACTIVE',
      },
      '/api/v1/issuing/cards/card_airwallex_live_1234/update': {
        card_id: 'card_airwallex_live_1234',
        card_status: 'INACTIVE',
      },
      '/api/v1/simulation/issuing/create': {
        type: 'CLEARING',
        status: 'CLEARING',
        transaction_id: 'tx_sim_5678',
      },
    };

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const urlStr = url.toString();
      for (const [endpoint, data] of Object.entries(mockResponses)) {
        if (urlStr.includes(endpoint)) {
          return {
            ok: true,
            status: 200,
            json: async () => data,
            text: async () => JSON.stringify(data),
          };
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => '{}',
      };
    });

    const client = new AirwallexClient('https://api-sandbox.airwallex.com');
    const gateway = new LiveGateway(client);

    // 1. Issue Card
    const card = await gateway.issueCard({
      intentId: 'intent_test_123',
      maxTotalMinor: 50000,
      maxPerTransactionMinor: 50000,
      allowedMcc: ['5734'],
      allowedCurrencies: ['USD'],
      activeFrom: new Date().toISOString(),
      activeTo: new Date(Date.now() + 86400000).toISOString(),
      maxTransactions: 1,
    });

    expect(card.cardId).toBe('card_airwallex_live_1234');
    expect(card.lastFour).toBe('1234');
    expect(card.status).toBe('ACTIVE');
    expect(card.isSandbox).toBe(true);

    // Verify fetch was called with Authorization Bearer
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/issuing/cards/create'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock_bearer_token_xyz',
        }),
      })
    );

    // 2. Simulate Authorization
    const authRes = await gateway.simulateAuthorization({
      cardId: card.cardId,
      amountMinor: 5000,
      currency: 'USD',
      mcc: '5734',
      merchant: 'OpenAI API',
    });
    expect(authRes.accepted).toBe(true);
    expect(authRes.sourceStatus).toBe('CLEARING');

    // 3. Freeze Card (POST /api/v1/issuing/cards/{id}/update with card_status: 'INACTIVE')
    const updated = await gateway.updateCardStatus('card_airwallex_live_1234', 'FROZEN');
    expect(updated.status).toBe('FROZEN');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/issuing/cards/card_airwallex_live_1234/update'),
      expect.objectContaining({
        body: expect.stringContaining('"card_status":"INACTIVE"'),
      })
    );
  });
});
