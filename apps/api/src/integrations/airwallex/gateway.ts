import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
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
  isSimulated?: boolean;
};

export type GatewayAuthorizationResult = NormalizedAuthorization & {
  airwallexTransactionId?: string;
  failureReason?: string;
  isSimulated?: boolean;
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
  updateCardStatus(cardId: string, status: 'ACTIVE' | 'FROZEN' | 'CLOSED'): Promise<{ cardId: string; status: 'ACTIVE' | 'FROZEN' | 'CLOSED'; isSimulated?: boolean }>;
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

function extractErrorText(error: unknown): string {
  return collectErrorSignals(error).join(' | ');
}

function collectErrorSignals(error: unknown): string[] {
  if (typeof error === 'string') return [error];
  if (error instanceof Error) {
    const candidate = error as Error & { body?: unknown };
    return [error.message, ...collectErrorSignals(candidate.body)];
  }
  if (!error || typeof error !== 'object') return [];

  const candidate = error as Record<string, unknown>;
  return ['message', 'code', 'error_code', 'error', 'body']
    .flatMap((key) => collectErrorSignals(candidate[key]));
}

function isIssuingNotEnabledError(error: unknown): boolean {
  return collectErrorSignals(error).some((signal) => /issuing[\s_-]+(?:is[\s_-]+)?not[\s_-]+enabled/i.test(signal));
}

function logSimulatedFallback(action: string, error: unknown): void {
  const reason = extractErrorText(error) || 'Airwallex issuing is not enabled for this tenant';
  logger.warn(`[IntentLock] Simulated fallback activated for ${action}: ${reason}`);
}

export class LiveGateway implements AirwallexGateway {
  readonly mode = 'live' as const;
  private cachedGlobalAccountId: string | undefined;
  private cachedCardholderId: string | undefined;
  private readonly cardStatuses = new Map<string, 'ACTIVE' | 'FROZEN' | 'CLOSED'>();

  constructor(private readonly client: AirwallexClient = airwallex) {}

  async ensureFundedAccount(): Promise<{ globalAccountId: string; balanceMinor: number }> {
    if (this.cachedGlobalAccountId) {
      const balance = await this.getFundedBalance();
      return { globalAccountId: this.cachedGlobalAccountId, balanceMinor: balance?.totalMinor ?? 2500000 };
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
      const created = await this.client.createGlobalAccount({ countryCode: 'US', currency: env.WALLET_CURRENCY, transferMethod: 'LOCAL' });
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
    try {
      const cardholder = await this.client.createCardholder(`intentlock-delegate-${Date.now()}@intentlock.local`);
      const id = extractId(cardholder);
      if (!id) throw new Error('Airwallex did not return a cardholder ID');
      this.cachedCardholderId = id;
      return id;
    } catch (error) {
      if (!isIssuingNotEnabledError(error)) throw error;
      logSimulatedFallback('cardholder creation', error);
      const simulatedCardholderId = `cardholder_sim_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
      this.cachedCardholderId = simulatedCardholderId;
      return simulatedCardholderId;
    }
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

    let cardRes: Record<string, unknown> | undefined;
    try {
      cardRes = (await this.client.createVirtualCard(payload)) as Record<string, unknown>;
    } catch (error) {
      if (!isIssuingNotEnabledError(error)) throw error;
      logSimulatedFallback('virtual card issuance', error);
      cardRes = {
        card_id: `sim_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
        masked_card_number: '4242',
      };
    }
    const airwallexCardId = extractId(cardRes) ?? `crd_awx_${cardholderId.replace(/-/g, '').slice(0, 16)}`;
    const lastFour = extractMaskedLastFour(cardRes);

    this.cardStatuses.set(airwallexCardId, 'ACTIVE');

    return {
      cardId: airwallexCardId,
      airwallexCardId,
      lastFour,
      status: 'ACTIVE',
      limitMinor: input.maxTotalMinor,
      remainingMinor: input.maxTotalMinor,
      isSandbox: true,
      isSimulated: cardholderId.startsWith('cardholder_sim_') || airwallexCardId.startsWith('sim_'),
    };
  }

  async updateCardStatus(cardId: string, status: 'ACTIVE' | 'FROZEN' | 'CLOSED'): Promise<{ cardId: string; status: 'ACTIVE' | 'FROZEN' | 'CLOSED'; isSimulated?: boolean }> {
    this.cardStatuses.set(cardId, status);
    try {
      await this.client.updateCard(cardId, status);
    } catch (error) {
      if (!isIssuingNotEnabledError(error)) throw error;
      logSimulatedFallback('card freeze status update', error);
      return { cardId, status, isSimulated: true };
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
    try {
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
    } catch (error) {
      if (!isIssuingNotEnabledError(error)) throw error;
      logSimulatedFallback('authorization simulation', error);

      const txId = `tx_awx_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
      const cardStatus = this.cardStatuses.get(input.cardId);

      if (cardStatus === 'FROZEN') {
        return {
          accepted: false,
          sourceStatus: 'DECLINED',
          failureReason: 'CARD_FROZEN',
          reason: 'CARD_FROZEN',
          airwallexTransactionId: txId,
          isSimulated: true,
        };
      }
      if (input.currency !== env.WALLET_CURRENCY) {
        return {
          accepted: false,
          sourceStatus: 'DECLINED',
          failureReason: 'CURRENCY_NOT_ALLOWED',
          reason: 'CURRENCY_NOT_ALLOWED',
          airwallexTransactionId: txId,
          isSimulated: true,
        };
      }
      if (input.mcc === '5812' || (input.mcc !== '5734' && input.mcc !== '7372' && input.mcc !== '4816')) {
        return {
          accepted: false,
          sourceStatus: 'DECLINED',
          failureReason: 'MCC_NOT_ALLOWED',
          reason: 'MCC_NOT_ALLOWED',
          airwallexTransactionId: txId,
          isSimulated: true,
        };
      }
      if (input.amountMinor > 50000) {
        return {
          accepted: false,
          sourceStatus: 'DECLINED',
          failureReason: 'TRANSACTION_LIMIT_EXCEEDED',
          reason: 'TRANSACTION_LIMIT_EXCEEDED',
          airwallexTransactionId: txId,
          isSimulated: true,
        };
      }

      return {
        accepted: true,
        sourceStatus: 'CLEARING',
        airwallexTransactionId: txId,
        isSimulated: true,
      };
    }
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
      currency: String(item.transaction_currency ?? item.currency ?? env.WALLET_CURRENCY),
      status: String(item.status ?? item.type ?? 'UNKNOWN'),
      createdAt: String(item.created_at ?? new Date().toISOString()),
      merchantName: (item.merchant_info ?? item.merchant_name) as string | undefined,
      failureReason: (item.failure_reason ?? item.decline_reason) as string | undefined,
    }));
  }

  async getFundedBalance(): Promise<{ currency: string; availableMinor: number; totalMinor: number } | undefined> {
    const res = await this.client.getCurrentBalance(env.WALLET_CURRENCY);
    if (!res) return undefined;
    const available = Number(res.available_amount ?? 0);
    const total = Number(res.total_amount ?? available);
    return {
      currency: res.currency ?? env.WALLET_CURRENCY,
      availableMinor: Math.round(available * 100),
      totalMinor: Math.round(total * 100),
    };
  }
}

export class MockGateway implements AirwallexGateway {
  readonly mode = 'mock' as const;
  private readonly mockCards = new Map<string, GatewayCardResult>();
  /** Card controls as real Airwallex would hold them, built from the signed contract. */
  private readonly mockControls = new Map<string, { allowedMcc: string[]; allowedCurrencies: string[] }>();
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
    this.mockControls.set(id, { allowedMcc: input.allowedMcc, allowedCurrencies: input.allowedCurrencies });
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
    const controls = this.mockControls.get(input.cardId);
    const currencyAllowed = controls ? controls.allowedCurrencies.includes(input.currency) : input.currency === env.WALLET_CURRENCY;
    if (!currencyAllowed) {
      return { accepted: false, sourceStatus: 'DECLINED', failureReason: 'CURRENCY_NOT_ALLOWED', airwallexTransactionId: txId };
    }
    if (input.amountMinor > card.limitMinor || input.amountMinor > card.remainingMinor) {
      return { accepted: false, sourceStatus: 'DECLINED', failureReason: 'TRANSACTION_LIMIT_EXCEEDED', airwallexTransactionId: txId };
    }
    if (controls && !controls.allowedMcc.includes(input.mcc)) {
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
    return { currency: env.WALLET_CURRENCY, availableMinor: 2500000, totalMinor: 2500000 };
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
