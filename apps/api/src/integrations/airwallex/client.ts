import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { airwallexQueue } from './queue.js';
import { buildCardholderPayload, buildIssuingSimulationPayload, buildVirtualCardPayload, type CardControls } from './payloads.js';

type TokenCache = { value: string; expiresAt: number };
type LoginResponse = { token?: string; access_token?: string; expires_at?: string };

export type AirwallexTransaction = {
  process_result?: string;
  type?: string;
  failure_reason?: string;
  transaction_amount?: number;
  transaction_currency?: string;
  card_transaction_id?: string;
};

export class AirwallexError extends Error {
  constructor(public readonly status: number, message: string, public readonly body?: unknown) {
    super(message);
    this.name = 'AirwallexError';
  }
}

export class AirwallexClient {
  private token: TokenCache | undefined;

  constructor(private readonly baseUrl = env.AIRWALLEX_BASE_URL) {}

  get configured(): boolean {
    return Boolean(env.AIRWALLEX_CLIENT_ID && env.AIRWALLEX_API_KEY);
  }

  async login(): Promise<string> {
    if (!this.configured) throw new Error('Airwallex credentials are not configured');
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;

    const response = await this.enqueue('/api/v1/authentication/login', {
      method: 'POST',
      headers: { 'x-client-id': env.AIRWALLEX_CLIENT_ID!, 'x-api-key': env.AIRWALLEX_API_KEY! },
    }, false);
    const body = (await this.readJson(response)) as LoginResponse;
    const value = body.token ?? body.access_token;
    if (!value) throw new Error('Airwallex login response did not contain a token');
    const expiresAt = body.expires_at ? Date.parse(body.expires_at) : Date.now() + 30 * 60_000;
    this.token = { value, expiresAt };
    return value;
  }

  async listGlobalAccounts(): Promise<unknown> {
    return this.request('/api/v1/global_accounts');
  }

  async createGlobalAccount(input: { countryCode: string; currency: string; transferMethod: string }) {
    return this.request('/api/v1/global_accounts/create', {
      method: 'POST',
      body: {
        request_id: randomUUID(),
        country_code: input.countryCode,
        required_features: [{ currency: input.currency, transfer_method: input.transferMethod }],
      },
    });
  }

  async simulateDeposit(input: { globalAccountId: string; amountMajor: number; payerName: string }) {
    return this.request('/api/v1/simulation/deposit/create', {
      method: 'POST',
      body: { request_id: randomUUID(), global_account_id: input.globalAccountId, amount: input.amountMajor, payer_name: input.payerName },
    });
  }

  async createCardholder(email: string) {
    return this.request('/api/v1/issuing/cardholders/create', { method: 'POST', body: buildCardholderPayload(email) });
  }

  async createVirtualCard(input: CardControls | ReturnType<typeof buildVirtualCardPayload>) {
    const body = 'cardholder_id' in input ? input : buildVirtualCardPayload(input);
    return this.request('/api/v1/issuing/cards/create', { method: 'POST', body });
  }

  async getCardLimits(cardId: string) {
    return this.request(`/api/v1/issuing/cards/${encodeURIComponent(cardId)}/limits`);
  }

  async updateCard(cardId: string, cardStatus: 'ACTIVE' | 'FROZEN' | 'CLOSED') {
    const airwallexStatus = cardStatus === 'FROZEN' ? 'INACTIVE' : cardStatus;
    return this.request(`/api/v1/issuing/cards/${encodeURIComponent(cardId)}/update`, { method: 'POST', body: { request_id: randomUUID(), card_status: airwallexStatus } });
  }

  async simulateIssuing(input: Parameters<typeof buildIssuingSimulationPayload>[0]) {
    return this.request('/api/v1/simulation/issuing/create', { method: 'POST', body: buildIssuingSimulationPayload(input) });
  }

  async captureIssuing(transactionId: string) {
    return this.request(`/api/v1/simulation/issuing/${encodeURIComponent(transactionId)}/capture`, { method: 'POST', body: { request_id: randomUUID() } });
  }

  async reverseIssuing(transactionId: string) {
    return this.request(`/api/v1/simulation/issuing/${encodeURIComponent(transactionId)}/reverse`, { method: 'POST', body: { request_id: randomUUID() } });
  }

  async refundIssuing(input: { cardId: string; lifecycleId: string; amountMajor: number; currency: string }) {
    return this.request('/api/v1/simulation/issuing/refund', { method: 'POST', body: { request_id: randomUUID(), card_id: input.cardId, card_transaction_lifecycle_id: input.lifecycleId, transaction_amount: input.amountMajor, transaction_currency: input.currency } });
  }

  async listIssuingTransactions(params?: { cardId?: string; pageSize?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.cardId) searchParams.set('card_id', params.cardId);
    if (params?.pageSize) searchParams.set('page_size', String(params.pageSize));
    const query = searchParams.toString();
    return this.request(`/api/v1/issuing/transactions${query ? `?${query}` : ''}`);
  }

  async getCurrentBalance(currency = 'USD'): Promise<{ available_amount?: number; total_amount?: number; currency?: string } | undefined> {
    const res = (await this.request(`/api/v1/balances/current?currency=${encodeURIComponent(currency)}`)) as {
      items?: Array<{ available_amount?: number; total_amount?: number; currency?: string }>;
      available_amount?: number;
      total_amount?: number;
      currency?: string;
    };
    if (res && Array.isArray(res.items)) {
      return res.items.find((i) => i.currency === currency) ?? res.items[0];
    }
    return res;
  }

  private async request(path: string, options: { method?: string; body?: unknown } = {}, retryAuth = true): Promise<unknown> {
    const token = await this.login();
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await this.enqueue(path, { method: options.method ?? 'GET', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    if (response.status === 401 && retryAuth) {
      this.token = undefined;
      return this.request(path, options, false);
    }
    return this.readJson(response);
  }

  private enqueue(path: string, init: RequestInit, retry429 = true): Promise<Response> {
    return airwallexQueue.add(async () => {
      const response = await fetch(`${this.baseUrl}${path}`, init);
      if (response.status === 429 && retry429) {
        const retryAfter = Number(response.headers.get('retry-after') ?? '0.25');
        await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(retryAfter * 1000, 250), 5000)));
        return this.enqueue(path, init, false);
      }
      if (!response.ok) throw new AirwallexError(response.status, `Airwallex request failed: ${response.status} ${path}`, await this.safeJson(response));
      return response;
    });
  }

  private async readJson(response: Response): Promise<unknown> {
    const body = await this.safeJson(response);
    if (!response.ok) throw new AirwallexError(response.status, `Airwallex request failed: ${response.status}`, body);
    return body;
  }

  private async safeJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return undefined;
    try { return JSON.parse(text); } catch { return { message: text.slice(0, 500) }; }
  }
}

export const airwallex = new AirwallexClient();
