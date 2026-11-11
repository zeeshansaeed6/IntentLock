import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { useStore } from '../state/useStore';
import { reconcileTransactions } from '../lib/api';
import { formatMoney, formatTime, formatDate } from '../lib/formatters';
import { StatusPill } from '../components/StatusPill';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/Button';

export const TransactionsPage: React.FC = () => {
  const transactions = useStore((state) => state.transactions);
  const loadAll = useStore((state) => state.loadAll);
  const addToast = useStore((state) => state.addToast);

  const [isReconciling, setIsReconciling] = useState(false);
  const [outcome, setOutcome] = useState<'ALL' | 'ALLOWED' | 'BLOCKED'>('ALL');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter(
      (tx) => (outcome === 'ALL' || tx.outcome === outcome) && (!q || `${tx.merchant} ${tx.mcc} ${tx.reason ?? ''} ${tx.rawFailureReason ?? ''}`.toLowerCase().includes(q)),
    );
  }, [transactions, outcome, query]);
  const allowedCount = transactions.filter((t) => t.outcome === 'ALLOWED').length;

  const handleReconcile = async () => {
    setIsReconciling(true);
    try {
      const res = await reconcileTransactions();
      addToast(
        `Reconciliation complete · Polled ${res.reconciledCount} new remote transactions`,
        'green'
      );
      await loadAll();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Reconciliation failed', 'rose');
    } finally {
      setIsReconciling(false);
    }
  };

  return (
    <div className="workspace-content">
      <div className="workspace-heading">
        <div>
          <span className="section-kicker">REAL-TIME CLEARING LEDGER</span>
          <h1>Card Authorizations</h1>
          <p>Every transaction evaluated deterministically against the signed intent contract and Airwallex simulation engine.</p>
        </div>
        <div className="workspace-actions">
          <Button
            variant="secondary"
            size="sm"
            loading={isReconciling}
            onClick={handleReconcile}
            icon={<RefreshCw size={13} />}
          >
            Reconcile Airwallex
          </Button>
        </div>
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight size={24} />}
          title="No authorizations recorded"
          detail="Run Judge Mode or submit an intent transaction to generate live simulation events."
        />
      ) : (
        <>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <input
            aria-label="Search transactions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search merchant, MCC, reason…"
            style={{ flex: '1 1 220px', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'inherit', font: 'inherit', fontSize: 13, outline: 0 }}
          />
          <div role="group" aria-label="Filter by outcome" style={{ display: 'flex', gap: 6 }}>
            {(['ALL', 'ALLOWED', 'BLOCKED'] as const).map((o) => (
              <button key={o} aria-pressed={outcome === o} onClick={() => setOutcome(o)}
                style={{ padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
                  background: outcome === o ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${outcome === o ? 'rgba(129,140,248,0.6)' : 'rgba(255,255,255,0.08)'}`, color: outcome === o ? '#c7d2fe' : '#94a3b8' }}>
                {o === 'ALL' ? `All (${transactions.length})` : o === 'ALLOWED' ? `Cleared (${allowedCount})` : `Blocked (${transactions.length - allowedCount})`}
              </button>
            ))}
          </div>
        </div>
        {visible.length === 0 ? (
          <EmptyState icon={<ArrowLeftRight size={24} />} title="No matching transactions" detail="Adjust the outcome filter or search term." />
        ) : (
        <div className="table-panel">
          <div className="table-head">
            <span>MERCHANT & DETAILS</span>
            <span>BOUND AMOUNT</span>
            <span>CLEARING RESULT</span>
            <span>TIMESTAMP</span>
          </div>

          {visible.map((tx) => {
            const isAllowed = tx.outcome === 'ALLOWED';
            return (
              <div className="table-row" key={tx.id}>
                <span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong>{tx.merchant}</strong>
                    {tx.isSimulated ? <Badge tone="amber">SIMULATED FALLBACK</Badge> : tx.isSandbox && <Badge isSandbox />}
                  </div>
                  <small style={{ color: '#64748b', fontSize: 10 }}>
                    MCC: {tx.mcc || 'N/A'} · {tx.currency}
                    {tx.airwallexTransactionId && ` · Tx: ${tx.airwallexTransactionId.slice(0, 16)}…`}
                    {tx.rawFailureReason && ` · Reason: ${tx.rawFailureReason}`}
                  </small>
                </span>

                <strong style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: '#f1f5f9' }}>
                  {formatMoney(tx.amountMinor, tx.currency)}
                </strong>

                <div>
                  <StatusPill status={isAllowed ? 'CLEARED' : (tx.rawFailureReason || tx.reason || 'DECLINED')} />
                </div>

                <small style={{ color: '#64748b', fontFamily: 'JetBrains Mono', fontSize: 10 }}>
                  {formatTime(tx.createdAt)}
                </small>
              </div>
            );
          })}
        </div>
        )}
        </>
      )}
    </div>
  );
};
