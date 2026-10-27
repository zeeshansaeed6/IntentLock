import { randomUUID } from 'node:crypto';
import type { IntentContract } from '@intentlock/shared';

export type IntentRecord = {
  contract: IntentContract;
  policy: { ok: boolean; failures: { rule: string; reason: string }[]; requiresApproval: boolean };
  cardId?: string;
  createdAt: string;
};

export type CardRecord = { id: string; intentId: string; lastFour: string; status: 'ACTIVE' | 'FROZEN' | 'CLOSED'; limitMinor: number; remainingMinor: number };
export type TransactionRecord = { id: string; intentId: string; merchant: string; amountMinor: number; currency: string; mcc: string; outcome: 'ALLOWED' | 'BLOCKED'; reason?: string; createdAt: string };
export type AuditRecord = { id: string; type: string; message: string; tone: 'violet' | 'green' | 'rose' | 'amber'; createdAt: string; metadata?: Record<string, string> };

class MemoryStore {
  readonly intents: IntentRecord[] = [];
  readonly cards: CardRecord[] = [];
  readonly transactions: TransactionRecord[] = [];
  readonly audit: AuditRecord[] = [];

  addAudit(entry: Omit<AuditRecord, 'id' | 'createdAt'>): AuditRecord {
    const record = { ...entry, id: randomUUID(), createdAt: new Date().toISOString() };
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
