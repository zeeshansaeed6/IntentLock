import { create } from 'zustand';
import {
  fetchAudit,
  fetchCards,
  fetchCompany,
  fetchHealth,
  fetchIntents,
  fetchTransactions,
  resetDemoApi,
  type AuditItem,
  type CardItem,
  type CompanyConfig,
  type HealthStatus,
  type IntentItem,
  type TransactionItem,
} from '../lib/api';

export type Toast = {
  id: string;
  message: string;
  tone: 'green' | 'rose' | 'amber' | 'violet';
};

export type JudgeState = {
  isActive: boolean;
  step: number;
  totalSteps: number;
  scenarioName: string;
  narration: string;
};

interface AppState {
  health: HealthStatus | null;
  company: CompanyConfig | null;
  intents: IntentItem[];
  cards: CardItem[];
  transactions: TransactionItem[];
  audits: AuditItem[];
  toasts: Toast[];
  pendingApproval: IntentItem | null;
  judge: JudgeState;
  isLoading: boolean;

  // Actions
  loadAll: () => Promise<void>;
  addToast: (message: string, tone?: 'green' | 'rose' | 'amber' | 'violet') => void;
  removeToast: (id: string) => void;
  setPendingApproval: (intent: IntentItem | null) => void;
  setJudge: (judge: Partial<JudgeState>) => void;
  resetDemo: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  health: null,
  company: null,
  intents: [],
  cards: [],
  transactions: [],
  audits: [],
  toasts: [],
  pendingApproval: null,
  judge: {
    isActive: false,
    step: 0,
    totalSteps: 7,
    scenarioName: 'idle',
    narration: 'Judge Mode ready to evaluate runtime enforcement.',
  },
  isLoading: false,

  loadAll: async () => {
    try {
      const [health, company, intents, cards, transactions, audits] = await Promise.all([
        fetchHealth().catch(() => null),
        fetchCompany().catch(() => null),
        fetchIntents().catch(() => []),
        fetchCards().catch(() => []),
        fetchTransactions().catch(() => []),
        fetchAudit().catch(() => []),
      ]);
      set({
        health,
        company,
        intents,
        cards,
        transactions,
        audits,
        // Check for any pending approval
        pendingApproval: intents.find((i) => i.contract.state === 'PENDING_APPROVAL') ?? null,
      });
    } catch (e) {
      console.error('Failed to load store state', e);
    }
  },

  addToast: (message: string, tone: 'green' | 'rose' | 'amber' | 'violet' = 'green') => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, tone }],
    }));
    setTimeout(() => {
      get().removeToast(id);
    }, 4500);
  },

  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  setPendingApproval: (intent: IntentItem | null) => {
    set({ pendingApproval: intent });
  },

  setJudge: (judgeUpdate: Partial<JudgeState>) => {
    set((state) => ({
      judge: { ...state.judge, ...judgeUpdate },
    }));
  },

  resetDemo: async () => {
    set({ isLoading: true });
    try {
      await resetDemoApi();
      await get().loadAll();
      get().addToast('Demo state reset to initial seed', 'amber');
    } catch {
      get().addToast('Failed to reset demo state', 'rose');
    } finally {
      set({ isLoading: false });
    }
  },
}));
