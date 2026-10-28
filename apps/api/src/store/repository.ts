import { randomUUID } from 'node:crypto';
import type { IntentRecord, CardRecord, TransactionRecord, AuditRecord } from './memory.js';
import { store as memoryStore } from './memory.js';
import { env } from '../config/env.js';

export interface DataRepository {
  readonly type: 'memory' | 'mongodb';
  getIntents(): Promise<IntentRecord[]>;
  getIntent(id: string): Promise<IntentRecord | undefined>;
  saveIntent(record: IntentRecord): Promise<void>;
  getCards(): Promise<CardRecord[]>;
  getCard(id: string): Promise<CardRecord | undefined>;
  saveCard(card: CardRecord): Promise<void>;
  getTransactions(): Promise<TransactionRecord[]>;
  saveTransaction(tx: TransactionRecord): Promise<void>;
  getAudit(): Promise<AuditRecord[]>;
  saveAudit(entry: Omit<AuditRecord, 'id' | 'createdAt'>): Promise<AuditRecord>;
  reset(): Promise<void>;
}

export class MemoryRepository implements DataRepository {
  readonly type = 'memory' as const;

  async getIntents(): Promise<IntentRecord[]> {
    return [...memoryStore.intents];
  }

  async getIntent(id: string): Promise<IntentRecord | undefined> {
    return memoryStore.intents.find((i) => i.contract.intent_id === id);
  }

  async saveIntent(record: IntentRecord): Promise<void> {
    const idx = memoryStore.intents.findIndex((i) => i.contract.intent_id === record.contract.intent_id);
    if (idx >= 0) memoryStore.intents[idx] = record;
    else memoryStore.intents.unshift(record);
  }

  async getCards(): Promise<CardRecord[]> {
    return [...memoryStore.cards];
  }

  async getCard(id: string): Promise<CardRecord | undefined> {
    return memoryStore.cards.find((c) => c.id === id || c.airwallexCardId === id);
  }

  async saveCard(card: CardRecord): Promise<void> {
    const idx = memoryStore.cards.findIndex((c) => c.id === card.id);
    if (idx >= 0) memoryStore.cards[idx] = card;
    else memoryStore.cards.unshift(card);
  }

  async getTransactions(): Promise<TransactionRecord[]> {
    return [...memoryStore.transactions];
  }

  async saveTransaction(tx: TransactionRecord): Promise<void> {
    const idx = memoryStore.transactions.findIndex((t) => t.id === tx.id);
    if (idx >= 0) memoryStore.transactions[idx] = tx;
    else memoryStore.transactions.unshift(tx);
  }

  async getAudit(): Promise<AuditRecord[]> {
    return [...memoryStore.audit];
  }

  async saveAudit(entry: Omit<AuditRecord, 'id' | 'createdAt'>): Promise<AuditRecord> {
    return memoryStore.addAudit(entry);
  }

  async reset(): Promise<void> {
    memoryStore.reset();
  }
}

export class MongoRepository implements DataRepository {
  readonly type = 'mongodb' as const;
  private client: unknown = undefined;

  constructor(private readonly uri: string) {}

  private async getDb() {
    if (!this.client) {
      const { MongoClient } = await import('mongodb');
      const mc = new MongoClient(this.uri, { serverSelectionTimeoutMS: 1500 });
      await mc.connect();
      this.client = mc;
    }
    return (this.client as { db: () => unknown }).db();
  }

  async getIntents(): Promise<IntentRecord[]> {
    try {
      const db = (await this.getDb()) as { collection: (name: string) => { find: () => { toArray: () => Promise<IntentRecord[]> } } };
      return await db.collection('intents').find().toArray();
    } catch {
      return memoryStore.intents;
    }
  }

  async getIntent(id: string): Promise<IntentRecord | undefined> {
    try {
      const db = (await this.getDb()) as { collection: (name: string) => { findOne: (query: { 'contract.intent_id': string }) => Promise<IntentRecord | null> } };
      const found = await db.collection('intents').findOne({ 'contract.intent_id': id });
      return found ?? undefined;
    } catch {
      return memoryStore.intents.find((i) => i.contract.intent_id === id);
    }
  }

  async saveIntent(record: IntentRecord): Promise<void> {
    try {
      const db = (await this.getDb()) as { collection: (name: string) => { replaceOne: (query: unknown, doc: unknown, opts: unknown) => Promise<void> } };
      await db.collection('intents').replaceOne({ 'contract.intent_id': record.contract.intent_id }, record, { upsert: true });
    } catch {
      // Fallback in-memory
      const idx = memoryStore.intents.findIndex((i) => i.contract.intent_id === record.contract.intent_id);
      if (idx >= 0) memoryStore.intents[idx] = record;
      else memoryStore.intents.unshift(record);
    }
  }

  async getCards(): Promise<CardRecord[]> {
    try {
      const db = (await this.getDb()) as { collection: (name: string) => { find: () => { toArray: () => Promise<CardRecord[]> } } };
      return await db.collection('cards').find().toArray();
    } catch {
      return memoryStore.cards;
    }
  }

  async getCard(id: string): Promise<CardRecord | undefined> {
    try {
      const db = (await this.getDb()) as { collection: (name: string) => { findOne: (query: unknown) => Promise<CardRecord | null> } };
      const found = await db.collection('cards').findOne({ $or: [{ id }, { airwallexCardId: id }] });
      return found ?? undefined;
    } catch {
      return memoryStore.cards.find((c) => c.id === id || c.airwallexCardId === id);
    }
  }

  async saveCard(card: CardRecord): Promise<void> {
    try {
      const db = (await this.getDb()) as { collection: (name: string) => { replaceOne: (query: unknown, doc: unknown, opts: unknown) => Promise<void> } };
      await db.collection('cards').replaceOne({ id: card.id }, card, { upsert: true });
    } catch {
      const idx = memoryStore.cards.findIndex((c) => c.id === card.id);
      if (idx >= 0) memoryStore.cards[idx] = card;
      else memoryStore.cards.unshift(card);
    }
  }

  async getTransactions(): Promise<TransactionRecord[]> {
    try {
      const db = (await this.getDb()) as { collection: (name: string) => { find: () => { toArray: () => Promise<TransactionRecord[]> } } };
      return await db.collection('transactions').find().toArray();
    } catch {
      return memoryStore.transactions;
    }
  }

  async saveTransaction(tx: TransactionRecord): Promise<void> {
    try {
      const db = (await this.getDb()) as { collection: (name: string) => { replaceOne: (query: unknown, doc: unknown, opts: unknown) => Promise<void> } };
      await db.collection('transactions').replaceOne({ id: tx.id }, tx, { upsert: true });
    } catch {
      const idx = memoryStore.transactions.findIndex((t) => t.id === tx.id);
      if (idx >= 0) memoryStore.transactions[idx] = tx;
      else memoryStore.transactions.unshift(tx);
    }
  }

  async getAudit(): Promise<AuditRecord[]> {
    try {
      const db = (await this.getDb()) as { collection: (name: string) => { find: () => { sort: (s: unknown) => { toArray: () => Promise<AuditRecord[]> } } } };
      return await db.collection('audit').find().sort({ createdAt: -1 }).toArray();
    } catch {
      return memoryStore.audit;
    }
  }

  async saveAudit(entry: Omit<AuditRecord, 'id' | 'createdAt'>): Promise<AuditRecord> {
    const record: AuditRecord = { ...entry, id: randomUUID(), createdAt: new Date().toISOString() };
    try {
      const db = (await this.getDb()) as { collection: (name: string) => { insertOne: (doc: unknown) => Promise<void> } };
      await db.collection('audit').insertOne(record);
    } catch {
      memoryStore.addAudit(entry);
    }
    return record;
  }

  async reset(): Promise<void> {
    memoryStore.reset();
    try {
      const db = (await this.getDb()) as { dropDatabase: () => Promise<void> };
      await db.dropDatabase();
    } catch {
      // Ignored
    }
  }
}

export const memoryRepository = new MemoryRepository();

let activeRepo: DataRepository = memoryRepository;

export function getRepository(): DataRepository {
  return activeRepo;
}

export function setRepository(repo: DataRepository): void {
  activeRepo = repo;
}
