import { randomUUID } from 'node:crypto';
import { verifyContract } from '../domain/contract.js';
import { env } from '../config/env.js';
import { emit } from '../agent/graph.js';
import { store, type TransactionRecord } from '../store/memory.js';

export type AuthorizationInput = { intentId: string; cardId: string; merchant: string; mcc: string; amountMinor: number; currency: string; now?: Date };
export type AuthorizationResult = { accepted: boolean; reason?: string; transaction: TransactionRecord };

function block(input: AuthorizationInput, reason: string): AuthorizationResult {
  const record = store.intents.find((item) => item.contract.intent_id === input.intentId);
  const card = store.cards.find((item) => item.id === input.cardId || item.airwallexCardId === input.cardId);
  const transaction: TransactionRecord = {
    id: randomUUID(),
    intentId: input.intentId,
    cardId: card?.id ?? input.cardId,
    airwallexCardId: card?.airwallexCardId,
    merchant: input.merchant,
    amountMinor: input.amountMinor,
    currency: input.currency,
    mcc: input.mcc,
    outcome: 'BLOCKED',
    reason,
    isSandbox: card?.isSandbox,
    createdAt: new Date().toISOString(),
  };
  store.transactions.unshift(transaction);
  store.addAudit({ type: 'authorization_blocked', message: `${reason} · ${input.merchant}`, tone: 'rose', metadata: { intentId: input.intentId, reason } });
  if (card && card.status === 'ACTIVE') {
    card.status = 'FROZEN';
    if (record) record.contract = { ...record.contract, state: 'FROZEN' };
    emit('anomaly', 'Authorization blocked and card frozen', reason, 'rose', { cardId: input.cardId, reason });
  }
  return { accepted: false, reason, transaction };
}

export function authorize(input: AuthorizationInput): AuthorizationResult {
  const record = store.intents.find((item) => item.contract.intent_id === input.intentId);
  const card = store.cards.find((item) => item.id === input.cardId || item.airwallexCardId === input.cardId);
  const now = input.now ?? new Date();
  if (!record || !card) return block(input, 'UNKNOWN_INTENT_OR_CARD');
  if (!verifyContract(record.contract, env.INTENT_HMAC_SECRET)) return block(input, 'INVALID_CONTRACT_SIGNATURE');
  if (record.contract.state !== 'ACTIVE') return block(input, `CONTRACT_${record.contract.state}`);
  if (card.status !== 'ACTIVE') return block(input, `CARD_${card.status}`);
  if (now < new Date(record.contract.valid_from) || now >= new Date(record.contract.expires_at)) return block(input, 'OUT_OF_CONTRACT_TIME_WINDOW');
  if (!record.contract.merchant.allowed_names.some((name) => name.toLowerCase() === input.merchant.toLowerCase())) return block(input, 'MERCHANT_NOT_ALLOWED');
  if (!record.contract.allowed_mcc.includes(input.mcc)) return block(input, 'MERCHANT_CATEGORY_NOT_ALLOWED');
  if (!record.contract.allowed_currencies.includes(input.currency)) return block(input, 'CURRENCY_NOT_ALLOWED');
  if (input.amountMinor > record.contract.max_per_transaction_minor) return block(input, 'LIMIT_EXCEEDED');
  if (input.amountMinor > card.remainingMinor) return block(input, 'ALL_TIME_LIMIT_EXCEEDED');

  const allowedCount = store.transactions.filter(
    (tx) => tx.intentId === input.intentId && tx.outcome === 'ALLOWED'
  ).length;
  if (allowedCount >= record.contract.max_transactions) {
    return block(input, 'MAX_TRANSACTIONS_EXCEEDED');
  }

  card.remainingMinor -= input.amountMinor;
  const transaction: TransactionRecord = {
    id: randomUUID(),
    intentId: input.intentId,
    cardId: card.id,
    airwallexCardId: card.airwallexCardId,
    merchant: input.merchant,
    amountMinor: input.amountMinor,
    currency: input.currency,
    mcc: input.mcc,
    outcome: 'ALLOWED',
    isSandbox: card.isSandbox,
    createdAt: now.toISOString(),
  };
  store.transactions.unshift(transaction);
  store.addAudit({ type: 'authorization_allowed', message: `Authorization cleared · ${input.merchant}`, tone: 'green', metadata: { intentId: input.intentId, transactionId: transaction.id } });
  emit('execute', 'Authorization verified', `Allowed ${input.currency} ${input.amountMinor / 100} at ${input.merchant}.`, 'green', { transactionId: transaction.id });
  return { accepted: true, transaction };
}
