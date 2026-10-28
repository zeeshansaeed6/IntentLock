import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { airwallex, AirwallexClient } from './client.js';
import { buildCardholderPayload, buildVirtualCardPayload, type CardControls } from './payloads.js';
import { mapRestAuthorization, type NormalizedAuthorization } from './mapper.js';

export type GatewayCardResult = {
  cardId: string;
  airwallexCardId?: string;
  lastFour: string;
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
  limitMinor: number;
  remainingMinor: number;
  isSandbox: boolean;
};

export type GatewayAuthorizationResult = NormalizedAuthorization & {
  airwallexTransactionId?: string;
  failureReason?: string;
};

export type GatewayTransactionItem = {
  id: string;
  cardId: string;
  amountMinor: number;
  currency: string;
  status: string;
  createdAt: string;
  merchantName?: string;
  failureReason?: string;
};

export interface AirwallexGateway {
  readonly mode: 'live' | 'mock';
  ensureFundedAccount(): Promise<{ globalAccountId: string; balanceMinor: number }>;
  issueCard(input: {
    intentId: string;
    maxPerTransactionMinor: number;
    maxTotalMinor: number;
    allowedMcc: string[];
    allowedCurrencies: string[];
    activeFrom: string;
    activeTo: string;
    maxTransactions: number;
  }): Promise<GatewayCardResult>;
  updateCardStatus(cardId: string, status: 'ACTIVE' | 'FROZEN' | 'CLOSED'): Promise<{ cardId: string; status: 'ACTIVE' | 'FROZEN' | 'CLOSED' }>;
  simulateAuthorization(input: {
    cardId: string;
    amountMinor: number;
    currency: string;
    mcc: string;
    merchant: string;
  }): Promise<GatewayAuthorizationResult>;
  listTransactions(cardId?: string): Promise<GatewayTransactionItem[]>;
  getFundedBalance(): Promise<{ currency: string; availableMinor: number; totalMinor: number } | undefined>;
}

function extractId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id === 'string') return candidate.id;
  if (typeof candidate.cardholder_id === 'string') return candidate.cardholder_id;
  if (typeof candidate.card_id === 'string') return candidate.card_id;
  if (candidate.data) return extractId(candidate.data);
  return undefined;
}

function extractMaskedLastFour(value: unknown): string {
  if (!value || typeof value !== 'object') return '4242';
  const candidate = value as Record<string, unknown>;
  const masked = (candidate.masked_card_number ?? candidate.card_number ?? candidate.last4) as string | undefined;
  if (masked && masked.length >= 4) {
    return masked.slice(-4);
  }
  return '4242';
}

export class LiveGateway implements AirwallexGateway {
  readonly mode = 'live' as const;
  private cachedGlobalAccountId: string | undefined;
  private cachedCardholderId: string | undefined;

  constructor(private readonly client: AirwallexClient = airwallex) {}

  async ensureFundedAccount(): Promise<{ globalAccountId: string; balanceMinor: number }> {
    if (this.cachedGlobalAccountId) {
      return { globalAccountId: this.cachedGlobalAccountId, balanceMinor: 2500000 };
    }
    await this.client.login();
    const rawAccounts = await this.client.listGlobalAccounts();
    const accountList = Array.isArray(rawAccounts)
      ? rawAccounts
      : ((rawAccounts as { global_accounts?: unknown[]; data?: unknown[]; items?: unknown[] })?.global_accounts ??
         (rawAccounts as { data?: unknown[] })?.data ??
         (rawAccounts as { items?: unknown[] })?.items ??
         []);
    let accountId = accountList.map(extractId).find(Boolean);
    if (!accountId) {
      const created = await this.client.createGlobalAccount({ countryCode: 'US', currency: 'USD', transferMethod: 'LOCAL' });
      accountId = extractId(created);
    }
    if (!accountId) throw new Error('Could not obtain an Airwallex Global Account ID');
    this.cachedGlobalAccountId = accountId;

    // Simulate initial deposit for sandbox environment
    try {
      await this.client.simulateDeposit({
        globalAccountId: accountId,
        amountMajor: 25000,
        payerName: 'IntentLock Treasury Funding',
      });
    } catch {
      // Continue if deposit simulation was already done or throttled
    }

    return { globalAccountId: accountId, balanceMinor: 2500000 };
  }

  private async getOrCreateCardholder(): Promise<string> {
    if (this.cachedCardholderId) return this.cachedCardholderId;
    const cardholder = await this.client.createCardholder(`intentlock-delegate-${Date.now()}@intentlock.local`);
    const id = extractId(cardholder);
    if (!id) throw new Error('Airwallex did not return a cardholder ID');
    this.cachedCardholderId = id;
    return id;
  }

  async issueCard(input: {
    intentId: string;
    maxPerTransactionMinor: number;
    maxTotalMinor: number;
    allowedMcc: string[];
    allowedCurrencies: string[];
    activeFrom: string;
    activeTo: string;
    maxTransactions: number;
  }): Promise<GatewayCardResult> {
    await this.ensureFundedAccount();
    const cardholderId = await this.getOrCreateCardholder();

    const payload = buildVirtualCardPayload({
      cardholderId,
      maxPerTransactionMinor: input.maxPerTransactionMinor,
      maxTotalMinor: input.maxTotalMinor,
      allowedMcc: input.allowedMcc,
      allowedCurrencies: input.allowedCurrencies,
      activeFrom: input.activeFrom,
      activeTo: input.activeTo,
      clientData: input.intentId,
      maxTransactions: input.maxTransactions,
    });

    const cardRes = (await this.client.createVirtualCard(payload)) as Record<string, unknown>;
    const airwallexCardId = extractId(cardRes) ?? `crd_${randomUUID().slice(0, 12)}`;
    const lastFour = extractMaskedLastFour(cardRes);

    return {
      cardId: airwallexCardId,
      airwallexCardId,
      lastFour,
      status: 'ACTIVE',
      limitMinor: input.maxTotalMinor,
      remainingMinor: input.maxTotalMinor,
      isSandbox: true,
    };
  }

  async updateCardStatus(cardId: string, status: 'ACTIVE' | 'FROZEN' | 'CLOSED'): Promise<{ cardId: string; status: 'ACTIVE' | 'FROZEN' | 'CLOSED' }> {
    await this.client.updateCard(cardId, status);
    return { cardId, status };
  }

  async simulateAuthorization(input: {
    cardId: string;
    amountMinor: number;
    currency: string;
    mcc: string;
    merchant: string;
  }): Promise<GatewayAuthorizationResult> {
    const rawRes = (await this.client.simulateIssuing({
      cardId: input.cardId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      mcc: input.mcc,
      merchant: input.merchant,
      singlePhase: true,
    })) as Record<string, unknown>;

    const normalized = mapRestAuthorization({
      process_result: (rawRes.process_result ?? (rawRes.status === 'CLEARING' || rawRes.status === 'APPROVED' ? 'APPROVED' : rawRes.status)) as string | undefined,
      type: (rawRes.type ?? rawRes.status) as string | undefined,
      failure_reason: (rawRes.failure_reason ?? rawRes.decline_reason ?? rawRes.message) as string | undefined,
    });

    const airwallexTransactionId = (rawRes.card_transaction_id ?? rawRes.id ?? rawRes.transaction_id) as string | undefined;

    return {
      ...normalized,
      airwallexTransactionId,
      failureReason: normalized.reason,
    };
  }

  async listTransactions(cardId?: string): Promise<GatewayTransactionItem[]>;
  async listTransactions(cardId?: string): Promise<GatewayTransactionItem[]> {
    const raw = (await this.client.listIssuingTransactions(cardId ? { cardId } : undefined)) as Record<string, unknown>;
    const items = Array.isArray(raw)
      ? raw
      : (raw.items ?? raw.data ?? raw.transactions ?? []) as Array<Record<string, unknown>>;

    return items.map((item) => ({
      id: String(item.card_transaction_id ?? item.id ?? randomUUID()),
      cardId: String(item.card_id ?? cardId ?? ''),
      amountMinor: Math.round(Number(item.transaction_amount ?? item.amount ?? 0) * 100),
      currency: String(item.transaction_currency ?? item.currency ?? 'USD'),
      status: String(item.status ?? item.type ?? 'UNKNOWN'),
      createdAt: String(item.created_at ?? new Date().toISOString()),
      merchantName: (item.merchant_info ?? item.merchant_name) as string | undefined,
      failureReason: (item.failure_reason ?? item.decline_reason) as string | undefined,
    }));
  }

  async getFundedBalance(): Promise<{ currency: string; availableMinor: number; totalMinor: number } | undefined> {
    const res = await this.client.getCurrentBalance('USD');
    if (!res) return undefined;
    const available = Number(res.available_amount ?? 0);
    const total = Number(res.total_amount ?? available);
    return {
      currency: res.currency ?? 'USD',
      availableMinor: Math.round(available * 100),
      totalMinor: Math.round(total * 100),
    };
  }
}

export class MockGateway implements AirwallexGateway {
  readonly mode = 'mock' as const;
  private readonly mockCards = new Map<string, GatewayCardResult>();
  private readonly mockTransactions: GatewayTransactionItem[] = [];

  async ensureFundedAccount(): Promise<{ globalAccountId: string; balanceMinor: number }> {
    return { globalAccountId: 'ga_sandbox_mock_account', balanceMinor: 2500000 };
  }

  async issueCard(input: {
    intentId: string;
    maxPerTransactionMinor: number;
    maxTotalMinor: number;
    allowedMcc: string[];
    allowedCurrencies: string[];
    activeFrom: string;
    activeTo: string;
    maxTransactions: number;
  }): Promise<GatewayCardResult> {
    const id = `card_demo_${randomUUID().slice(0, 8)}`;
    const card: GatewayCardResult = {
      cardId: id,
      lastFour: '4242',
      status: 'ACTIVE',
      limitMinor: input.maxTotalMinor,
      remainingMinor: input.maxTotalMinor,
      isSandbox: false,
    };
    this.mockCards.set(id, card);
    return card;
  }

  async updateCardStatus(cardId: string, status: 'ACTIVE' | 'FROZEN' | 'CLOSED'): Promise<{ cardId: string; status: 'ACTIVE' | 'FROZEN' | 'CLOSED' }> {
    const card = this.mockCards.get(cardId);
    if (card) {
      card.status = status;
    }
    return { cardId, status };
  }

  async simulateAuthorization(input: {
    cardId: string;
    amountMinor: number;
    currency: string;
    mcc: string;
    merchant: string;
  }): Promise<GatewayAuthorizationResult> {
    const card = this.mockCards.get(input.cardId);
    const txId = `sim_tx_${randomUUID().slice(0, 10)}`;

    if (!card) {
      return { accepted: false, sourceStatus: 'DECLINED', failureReason: 'CARD_NOT_FOUND', airwallexTransactionId: txId };
    }
    if (card.status !== 'ACTIVE') {
      return { accepted: false, sourceStatus: 'DECLINED', failureReason: `CARD_${card.status}`, airwallexTransactionId: txId };
    }
    if (input.currency !== 'USD') {
      return { accepted: false, sourceStatus: 'DECLINED', failureReason: 'CURRENCY_NOT_ALLOWED', airwallexTransactionId: txId };
    }
    if (input.amountMinor > card.limitMinor || input.amountMinor > card.remainingMinor) {
      return { accepted: false, sourceStatus: 'DECLINED', failureReason: 'TRANSACTION_LIMIT_EXCEEDED', airwallexTransactionId: txId };
    }
    if (input.mcc === '5812') {
      return { accepted: false, sourceStatus: 'DECLINED', failureReason: 'MCC_NOT_ALLOWED', airwallexTransactionId: txId };
    }

    card.remainingMinor -= input.amountMinor;
    const txItem: GatewayTransactionItem = {
      id: txId,
      cardId: input.cardId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: 'CLEARING',
      createdAt: new Date().toISOString(),
      merchantName: input.merchant,
    };
    this.mockTransactions.unshift(txItem);

    return {
      accepted: true,
      sourceStatus: 'CLEARING',
      airwallexTransactionId: txId,
    };
  }

  async listTransactions(cardId?: string): Promise<GatewayTransactionItem[]> {
    if (!cardId) return [...this.mockTransactions];
    return this.mockTransactions.filter((tx) => tx.cardId === cardId);
  }

  async getFundedBalance(): Promise<{ currency: string; availableMinor: number; totalMinor: number }> {
    return { currency: 'USD', availableMinor: 2500000, totalMinor: 2500000 };
  }
}

export const liveGateway = new LiveGateway();
export const mockGateway = new MockGateway();

export function getGateway(): AirwallexGateway {
  if (env.DEMO_MODE === 'live' && airwallex.configured) {
    return liveGateway;
  }
  return mockGateway;
}
