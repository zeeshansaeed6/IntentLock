import React, { useState } from 'react';
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
        <div className="table-panel">
          <div className="table-head">
            <span>MERCHANT & DETAILS</span>
            <span>BOUND AMOUNT</span>
            <span>CLEARING RESULT</span>
            <span>TIMESTAMP</span>
          </div>

          {transactions.map((tx) => {
            const isAllowed = tx.outcome === 'ALLOWED';
            return (
              <div className="table-row" key={tx.id}>
                <span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong>{tx.merchant}</strong>
                    {tx.isSandbox && <Badge isSandbox />}
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
    </div>
  );
};
