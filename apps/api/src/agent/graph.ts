import { randomUUID } from 'node:crypto';
import { signContract, verifyContract, type ContractDraft } from '../domain/contract.js';
import { decideTreasury } from '../domain/treasury/engine.js';
import { cardLimitMinor, evaluatePolicy } from '../domain/policy/engine.js';
import { getTemplateConfig } from '../domain/templates/index.js';
import { loadCompanySeed } from '../seed/loader.js';
import { env } from '../config/env.js';
import { store, type IntentRecord, type CardRecord } from '../store/memory.js';
import { eventBus, type AgentEvent } from './events.js';
import { getGateway } from '../integrations/airwallex/gateway.js';
import { getLLMClient } from './llm/index.js';

export function emit(type: string, title: string, detail: string, tone: AgentEvent['tone'], data?: Record<string, unknown>): void {
  const event = { id: randomUUID(), type, title, detail, tone, timestamp: new Date().toISOString(), data };
  eventBus.publish(event);
  store.addAudit({ type, message: `${title}: ${detail}`, tone, metadata: data ? Object.fromEntries(Object.entries(data).filter(([, value]) => typeof value === 'string') as [string, string][]) : undefined });
}

export async function issueCard(record: IntentRecord): Promise<CardRecord> {
  const existing = store.cards.find((card) => card.intentId === record.contract.intent_id);
  if (existing) return existing;
  const gateway = getGateway();
  const issued = await gateway.issueCard({
    intentId: record.contract.intent_id,
    maxPerTransactionMinor: record.contract.max_per_transaction_minor,
    maxTotalMinor: record.contract.max_total_minor,
    allowedMcc: record.contract.allowed_mcc,
    allowedCurrencies: record.contract.allowed_currencies,
    activeFrom: record.contract.valid_from,
    activeTo: record.contract.expires_at,
    maxTransactions: record.contract.max_transactions,
  });

  const card: CardRecord = {
    id: issued.cardId,
    airwallexCardId: issued.airwallexCardId,
    intentId: record.contract.intent_id,
    lastFour: issued.lastFour,
    status: issued.status,
    limitMinor: issued.limitMinor,
    remainingMinor: issued.remainingMinor,
    isSandbox: issued.isSandbox,
  };
  record.cardId = card.id;
  store.cards.unshift(card);
  emit('issue_card', 'Virtual card issued', `Masked card ending ${card.lastFour} · limit bound to ${card.limitMinor} minor units.${card.isSandbox ? ' (Airwallex Sandbox)' : ''}`, 'green', { cardId: card.id });
  return card;
}

export async function createIntent(userRequest: string, untrustedContext?: string): Promise<IntentRecord> {
  emit('interpret', 'Intent interpreted', 'Mapped natural language into a typed purchase request.', 'violet');
  const llm = getLLMClient();
  const proposal = await llm.generateProposal(userRequest, untrustedContext);
  const templateConfig = getTemplateConfig(proposal.template);
  const company = loadCompanySeed();

  const treasury = decideTreasury({
    currentBalanceMinor: company.currentBalanceMinor,
    reserveFloorMinor: company.reserveFloorMinor,
    weeks: company.weeks.map((w) => ({ inflowMinor: w.inflowMinor, outflowMinor: w.outflowMinor })),
    terms: proposal.extractedVendorTerms,
  });
  emit('plan', 'Treasury projection complete', `${treasury.recommendation === 'monthly' ? 'Monthly' : treasury.recommendation === 'annual' ? 'Annual' : 'Defer'} recommendation · ${treasury.reasons[0]}`, 'violet', { recommendation: treasury.recommendation });

  const now = new Date();
  const validityDays = treasury.recommendation === 'annual' ? 365 : treasury.recommendation === 'monthly' ? 30 : 14;
  const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);
  const reconsiderOn = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000).toISOString();

  const perTransactionCap = Math.min(proposal.requestedAmountMinor, templateConfig.maxPerTransactionCapMinor);
  const totalCap = Math.min(proposal.requestedAmountMinor, templateConfig.maxTotalCapMinor);

  const policy = evaluatePolicy({
    template: proposal.template,
    merchantName: proposal.merchantName,
    amountMinor: proposal.requestedAmountMinor,
    maxPerTransactionMinor: perTransactionCap,
    maxTotalMinor: totalCap,
    allowedMcc: templateConfig.allowedMcc,
    currency: 'USD',
    expiresAt,
    now,
    reserveFloorMinor: company.reserveFloorMinor,
    deptBudgetRemainingMinor: company.departmentBudgetRemainingMinor,
    approvalThresholdMinor: company.approvalThresholdMinor,
  });

  const state = policy.ok ? (policy.requiresApproval ? 'PENDING_APPROVAL' : 'ACTIVE') : 'DRAFT';
  const decision = policy.ok ? treasury.recommendation : 'defer';
  const allowedMerchantNames = Array.from(new Set([proposal.merchantName, ...templateConfig.allowedMerchants]));

  const draft: ContractDraft = {
    template: proposal.template,
    user_request: userRequest,
    decision,
    reconsider_on: reconsiderOn,
    merchant: { name: proposal.merchantName, allowed_names: allowedMerchantNames },
    allowed_mcc: templateConfig.allowedMcc,
    currency: 'USD',
    allowed_currencies: templateConfig.allowedCurrencies,
    max_per_transaction_minor: policy.ok ? perTransactionCap : 0,
    max_total_minor: policy.ok ? cardLimitMinor(totalCap, company.departmentBudgetRemainingMinor) : 0,
    max_transactions: templateConfig.defaultMaxTransactions,
    valid_from: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    requires_human_approval: policy.requiresApproval,
    policy_snapshot: {
      reserve_floor_minor: company.reserveFloorMinor,
      dept_budget_remaining_minor: company.departmentBudgetRemainingMinor,
      approval_threshold_minor: company.approvalThresholdMinor,
    },
    rationale: proposal.rationale,
    state,
  };

  const contract = signContract(draft, env.INTENT_HMAC_SECRET);
  emit('policy_gate', policy.ok ? 'Policy gate passed' : 'Policy gate blocked proposal', policy.ok ? `Deterministic policy checks passed (${policy.requiresApproval ? 'awaiting human approval' : 'auto-approved'}).` : policy.failures.map((failure) => failure.reason).join(' '), policy.ok ? 'green' : 'rose', { intentId: contract.intent_id });
  emit('sign', policy.ok ? 'Intent contract sealed' : 'Safe denial sealed', `HMAC-SHA256 · ${contract.intent_id}`, policy.ok ? 'green' : 'rose');
  const record: IntentRecord = { contract, policy, createdAt: now.toISOString() };
  store.intents.unshift(record);
  if (record.contract.state === 'ACTIVE') await issueCard(record);
  return record;
}

export async function approveIntent(intentId: string, expectedSignature?: string): Promise<IntentRecord | undefined> {
  const record = store.intents.find((item) => item.contract.intent_id === intentId);
  if (!record || record.contract.state !== 'PENDING_APPROVAL') return undefined;

  // Enforce cryptographic contract binding
  if (!verifyContract(record.contract, env.INTENT_HMAC_SECRET)) {
    throw new Error('CONTRACT_TAMPERED: Contract signature verification failed at approval time.');
  }

  if (expectedSignature && record.contract.signature !== expectedSignature) {
    throw new Error('SIGNATURE_MISMATCH: Contract signature does not match presentation snapshot.');
  }

  record.contract = { ...record.contract, state: 'ACTIVE' };
  emit('approval', 'Human approval received', 'Approval matched the exact signed merchant, amount, currency, and terms.', 'green', { intentId, signature: record.contract.signature });
  await issueCard(record);
  return record;
}
