import type { IntentContract } from '@intentlock/shared';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '';

export type IntentItem = {
  contract: IntentContract;
  policy: {
    ok: boolean;
    requiresApproval: boolean;
    failures: Array<{ code: string; reason: string }>;
  };
  createdAt: string;
};

export type CardItem = {
  id: string;
  intentId: string;
  airwallexCardId?: string;
  lastFour: string;
  limitMinor: number;
  remainingMinor: number;
  status: 'ACTIVE' | 'FROZEN' | 'CANCELLED';
  isSandbox?: boolean;
  createdAt: string;
};

export type TransactionItem = {
  id: string;
  intentId: string;
  cardId?: string;
  airwallexCardId?: string;
  airwallexTransactionId?: string;
  merchant: string;
  amountMinor: number;
  currency: string;
  mcc: string;
  outcome: 'ALLOWED' | 'BLOCKED';
  reason?: string;
  rawFailureReason?: string;
  isSandbox?: boolean;
  createdAt: string;
};

export type AuditItem = {
  id: string;
  type: string;
  message: string;
  tone: 'green' | 'rose' | 'amber' | 'slate';
  createdAt: string;
  metadata?: Record<string, string>;
};

export type HealthStatus = {
  status: 'ok';
  service: string;
  mode: string;
  airwallex: 'sandbox' | 'not_configured';
  fundedBalance?: {
    currency: string;
    availableMinor: number;
    totalMinor: number;
  };
};

export type CompanyConfig = {
  companyName: string;
  currentBalanceMinor: number;
  reserveFloorMinor: number;
  departmentBudgetRemainingMinor: number;
  approvalThresholdMinor: number;
  weeks: Array<{ week: number; inflowMinor: number; outflowMinor: number }>;
};

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function fetchCompany(): Promise<CompanyConfig> {
  const res = await fetch(`${API_BASE}/api/company`);
  if (!res.ok) throw new Error(`Fetch company failed: ${res.statusText}`);
  return res.json();
}

export async function fetchIntents(): Promise<IntentItem[]> {
  const res = await fetch(`${API_BASE}/api/intents`);
  if (!res.ok) throw new Error(`Fetch intents failed: ${res.statusText}`);
  return res.json();
}

export async function submitIntent(userRequest: string): Promise<IntentItem> {
  const res = await fetch(`${API_BASE}/api/intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_request: userRequest }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Intent submission failed');
  }
  return res.json();
}

export async function approveIntentApi(intentId: string, expectedSignature?: string): Promise<IntentItem> {
  const res = await fetch(`${API_BASE}/api/intents/${intentId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedSignature }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Approval failed');
  }
  return res.json();
}

export async function fetchCards(): Promise<CardItem[]> {
  const res = await fetch(`${API_BASE}/api/cards`);
  if (!res.ok) throw new Error(`Fetch cards failed: ${res.statusText}`);
  return res.json();
}

export async function toggleFreezeCard(cardId: string, currentStatus: string): Promise<CardItem> {
  const nextStatus = currentStatus === 'ACTIVE' ? 'FROZEN' : 'ACTIVE';
  const res = await fetch(`${API_BASE}/api/cards/${cardId}/freeze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: nextStatus }),
  });
  if (!res.ok) throw new Error(`Failed to update card status`);
  return res.json();
}

export async function fetchTransactions(): Promise<TransactionItem[]> {
  const res = await fetch(`${API_BASE}/api/transactions`);
  if (!res.ok) throw new Error(`Fetch transactions failed: ${res.statusText}`);
  return res.json();
}

export async function reconcileTransactions(): Promise<{ reconciledCount: number; transactionsCount: number }> {
  const res = await fetch(`${API_BASE}/api/reconcile`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Reconciliation failed`);
  return res.json();
}

export async function fetchAudit(): Promise<AuditItem[]> {
  const res = await fetch(`${API_BASE}/api/audit`);
  if (!res.ok) throw new Error(`Fetch audit failed: ${res.statusText}`);
  return res.json();
}

export async function triggerScenario(name: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/scenarios/${name}/run`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Scenario run failed`);
  return res.json();
}

export async function resetDemoApi(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/api/reset`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Demo reset failed`);
  return res.json();
}
