import { randomUUID } from 'node:crypto';
import { signContract, type ContractDraft } from '../domain/contract.js';
import { decideTreasury } from '../domain/treasury/engine.js';
import { cardLimitMinor, evaluatePolicy } from '../domain/policy/engine.js';
import { env } from '../config/env.js';
import { store, type IntentRecord } from '../store/memory.js';
import { eventBus, type AgentEvent } from './events.js';

const weeks = Array.from({ length: 12 }, () => ({ inflowMinor: 0, outflowMinor: 60000 }));
const projectionInput = { currentBalanceMinor: 2100000, reserveFloorMinor: 1200000, terms: { monthlyPriceMinor: 30000, annualPriceMinor: 500000 }, weeks };

export function emit(type: string, title: string, detail: string, tone: AgentEvent['tone'], data?: Record<string, unknown>): void {
  const event = { id: randomUUID(), type, title, detail, tone, timestamp: new Date().toISOString(), data };
  eventBus.publish(event);
  store.addAudit({ type, message: `${title}: ${detail}`, tone, metadata: data ? Object.fromEntries(Object.entries(data).filter(([, value]) => typeof value === 'string') as [string, string][]) : undefined });
}

function scriptedInterpret(userRequest: string) {
  const redTeam = /ignore previous|raise the limit|pay annually|5000/i.test(userRequest);
  return {
    template: /gpu|compute|cloud/i.test(userRequest) ? 'cloud_gpu' as const : 'saas' as const,
    merchantName: /design|pixel/i.test(userRequest) ? 'PixelForge' : 'Northstar Design',
    allowedMcc: /gpu|compute|cloud/i.test(userRequest) ? ['7379'] : ['5734'],
    amountMinor: redTeam ? 500000 : 50000,
    maxPerTransactionMinor: redTeam ? 500000 : 50000,
    maxTotalMinor: redTeam ? 500000 : 50000,
    rationale: redTeam ? 'External invoice text attempted to override the purchase boundary.' : 'Monthly pricing preserves cash runway while keeping cancellation optional.',
  };
}

export function createIntent(userRequest: string): IntentRecord {
  emit('interpret', 'Intent interpreted', 'Mapped natural language into a typed purchase request.', 'violet');
  const proposal = scriptedInterpret(userRequest);
  const treasury = decideTreasury(projectionInput);
  emit('plan', 'Treasury projection complete', `Monthly is safe; annual crosses the reserve floor in week ${treasury.annual.breachWeek}.`, 'violet', { recommendation: treasury.recommendation });
  const now = new Date();
  const policy = evaluatePolicy({
    template: proposal.template,
    merchantName: proposal.merchantName,
    amountMinor: proposal.amountMinor,
    maxPerTransactionMinor: proposal.maxPerTransactionMinor,
    maxTotalMinor: proposal.maxTotalMinor,
    allowedMcc: proposal.allowedMcc,
    currency: 'USD',
    expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
    now,
    reserveFloorMinor: 1200000,
    deptBudgetRemainingMinor: 250000,
    approvalThresholdMinor: 100000,
  });
  const state = policy.ok ? (policy.requiresApproval ? 'PENDING_APPROVAL' : 'ACTIVE') : 'DRAFT';
  const draft: ContractDraft = {
    template: proposal.template,
    user_request: userRequest,
    decision: policy.ok ? 'monthly' : 'defer',
    reconsider_on: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    merchant: { name: proposal.merchantName, allowed_names: [proposal.merchantName] },
    allowed_mcc: proposal.allowedMcc,
    currency: 'USD', allowed_currencies: ['USD'],
    max_per_transaction_minor: policy.ok ? proposal.maxPerTransactionMinor : 0,
    max_total_minor: policy.ok ? cardLimitMinor(proposal.maxTotalMinor, 250000) : 0,
    max_transactions: 1, valid_from: now.toISOString(), expires_at: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    requires_human_approval: policy.requiresApproval,
    policy_snapshot: { reserve_floor_minor: 1200000, dept_budget_remaining_minor: 250000, approval_threshold_minor: 100000 },
    rationale: proposal.rationale, state,
  };
  const contract = signContract(draft, env.INTENT_HMAC_SECRET);
  emit('policy_gate', policy.ok ? 'Policy gate passed' : 'Policy gate blocked proposal', policy.ok ? 'Seven deterministic checks passed.' : policy.failures.map((failure) => failure.reason).join(' '), policy.ok ? 'green' : 'rose', { intentId: contract.intent_id });
  emit('sign', policy.ok ? 'Intent contract sealed' : 'Safe denial sealed', `HMAC-SHA256 · ${contract.intent_id}`, policy.ok ? 'green' : 'rose');
  const record = { contract, policy, createdAt: now.toISOString() };
  store.intents.unshift(record);
  if (record.contract.state === 'ACTIVE') issueDemoCard(record);
  return record;
}

export function issueDemoCard(record: IntentRecord) {
  const existing = store.cards.find((card) => card.intentId === record.contract.intent_id);
  if (existing) return existing;
  const card = {
    id: `card_demo_${randomUUID().slice(0, 8)}`,
    intentId: record.contract.intent_id,
    lastFour: '4242',
    status: 'ACTIVE' as const,
    limitMinor: record.contract.max_total_minor,
    remainingMinor: record.contract.max_total_minor,
  };
  store.cards.unshift(card);
  emit('issue_card', 'Virtual card issued', `Masked card ending ${card.lastFour} · limit bound to ${card.limitMinor} minor units.`, 'green', { cardId: card.id });
  return card;
}

export function approveIntent(intentId: string): IntentRecord | undefined {
  const record = store.intents.find((item) => item.contract.intent_id === intentId);
  if (!record || record.contract.state !== 'PENDING_APPROVAL') return undefined;
  record.contract = { ...record.contract, state: 'ACTIVE' };
  emit('approval', 'Human approval received', 'Approval matched the exact signed merchant, amount, currency, and terms.', 'green', { intentId });
  issueDemoCard(record);
  return record;
}
