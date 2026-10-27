export type PolicyProposal = {
  template: 'saas' | 'cloud_gpu';
  merchantName: string;
  amountMinor: number;
  maxPerTransactionMinor: number;
  maxTotalMinor: number;
  allowedMcc: string[];
  currency: string;
  expiresAt: Date;
  now?: Date;
  reserveFloorMinor: number;
  deptBudgetRemainingMinor: number;
  approvalThresholdMinor: number;
  maxExpiryDays?: number;
  activeMerchants?: string[];
};

export type PolicyFailure = { rule: string; reason: string };
export type PolicyResult = { ok: boolean; failures: PolicyFailure[]; requiresApproval: boolean };

const templateMcc: Record<PolicyProposal['template'], string[]> = {
  saas: ['5734', '7372'],
  cloud_gpu: ['7372', '7379'],
};

export function evaluatePolicy(proposal: PolicyProposal): PolicyResult {
  const now = proposal.now ?? new Date();
  const failures: PolicyFailure[] = [];
  const fail = (rule: string, reason: string) => failures.push({ rule, reason });

  if (proposal.amountMinor > proposal.deptBudgetRemainingMinor) fail('department_budget', 'Amount exceeds the remaining department budget.');
  if (proposal.maxPerTransactionMinor > proposal.amountMinor) fail('per_request_ceiling', 'Per-transaction cap cannot exceed the approved purchase amount.');
  if (proposal.maxTotalMinor < proposal.maxPerTransactionMinor) fail('bounded_total', 'Total card limit must cover the per-transaction limit.');
  const allowed = templateMcc[proposal.template];
  if (proposal.allowedMcc.some((mcc) => !allowed.includes(mcc))) fail('mcc_allowlist', 'One or more merchant categories are not allowed for this template.');
  if (proposal.currency !== 'USD') fail('currency_allowlist', 'Only USD is enabled for this sandbox policy.');
  const maxExpiryMs = (proposal.maxExpiryDays ?? 31) * 24 * 60 * 60 * 1000;
  if (proposal.expiresAt.getTime() <= now.getTime() || proposal.expiresAt.getTime() - now.getTime() > maxExpiryMs) fail('expiry_maximum', 'Contract expiry must be in the future and within the policy window.');
  if (proposal.activeMerchants?.some((merchant) => merchant.toLowerCase() === proposal.merchantName.toLowerCase())) fail('duplicate_active_contract', 'An active contract already exists for this merchant.');

  return { ok: failures.length === 0, failures, requiresApproval: proposal.amountMinor > proposal.approvalThresholdMinor };
}

export function cardLimitMinor(intentBudgetMinor: number, policyRemainingMinor: number): number {
  if (!Number.isSafeInteger(intentBudgetMinor) || !Number.isSafeInteger(policyRemainingMinor)) throw new Error('Card limits must be integer minor units');
  return Math.min(intentBudgetMinor, policyRemainingMinor);
}
