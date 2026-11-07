import { createHash, randomUUID } from 'node:crypto';
import type { IntentContract } from '@intentlock/shared';

export type IntentRecord = {
  contract: IntentContract;
  policy: { ok: boolean; failures: { rule: string; reason: string }[]; requiresApproval: boolean };
  cardId?: string;
  owner_id?: string;
  createdAt: string;
};

export type CardRecord = {
  id: string;
  intentId: string;
  airwallexCardId?: string;
  lastFour: string;
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
  limitMinor: number;
  remainingMinor: number;
  owner_id?: string;
  isSandbox?: boolean;
  isSimulated?: boolean;
};

export type TransactionRecord = {
  id: string;
  intentId: string;
  cardId?: string;
  airwallexTransactionId?: string;
  airwallexCardId?: string;
  merchant: string;
  amountMinor: number;
  currency: string;
  mcc: string;
  outcome: 'ALLOWED' | 'BLOCKED';
  reason?: string;
  rawFailureReason?: string;
  owner_id?: string;
  isSandbox?: boolean;
  isSimulated?: boolean;
  createdAt: string;
};
export type AuditRecord = {
  id: string;
  type: string;
  message: string;
  tone: 'violet' | 'green' | 'rose' | 'amber';
  owner_id?: string;
  createdAt: string;
  prevHash: string;
  hash: string;
  metadata?: Record<string, string>;
};

export function hashAuditEntry(entry: Pick<AuditRecord, 'type' | 'message' | 'tone' | 'owner_id' | 'createdAt' | 'prevHash' | 'metadata'>): string {
  const normalized = {
    prevHash: entry.prevHash ?? '',
    type: entry.type,
    message: entry.message,
    tone: entry.tone,
    owner_id: entry.owner_id ?? null,
    createdAt: entry.createdAt,
    metadata: entry.metadata ?? {},
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export function verifyAuditLog(entries: AuditRecord[]): boolean {
  let previousHash = '';
  const ordered = [...entries].reverse();

  for (const entry of ordered) {
    if (entry.prevHash !== previousHash) return false;
    if (entry.hash !== hashAuditEntry({
      type: entry.type,
      message: entry.message,
      tone: entry.tone,
      owner_id: entry.owner_id,
      createdAt: entry.createdAt,
      prevHash: entry.prevHash,
      metadata: entry.metadata,
    })) return false;
    previousHash = entry.hash;
  }

  return true;
}

class MemoryStore {
  readonly intents: IntentRecord[] = [];
  readonly cards: CardRecord[] = [];
  readonly transactions: TransactionRecord[] = [];
  readonly audit: AuditRecord[] = [];

  addAudit(entry: Omit<AuditRecord, 'id' | 'createdAt' | 'prevHash' | 'hash'>): AuditRecord {
    const createdAt = new Date().toISOString();
    const prevHash = this.audit[0]?.hash ?? '';
    const record: AuditRecord = {
      ...entry,
      id: randomUUID(),
      createdAt,
      prevHash,
      hash: '',
    };
    record.hash = hashAuditEntry({
      type: record.type,
      message: record.message,
      tone: record.tone,
      owner_id: record.owner_id,
      createdAt: record.createdAt,
      prevHash: record.prevHash,
      metadata: record.metadata,
    });

    this.audit.unshift(record);
    return record;
  }

  reset(): void {
    this.intents.length = 0;
    this.cards.length = 0;
    this.transactions.length = 0;
    this.audit.length = 0;
  }
}

export const store = new MemoryStore();
