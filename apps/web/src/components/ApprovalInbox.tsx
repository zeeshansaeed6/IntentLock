import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, XCircle, ShieldCheck, Fingerprint, ExternalLink } from 'lucide-react';
import { useStore } from '../state/useStore';
import { approveIntentApi } from '../lib/api';
import { formatMoney, truncateHash } from '../lib/formatters';
import { Button } from './Button';

export const ApprovalInbox: React.FC = () => {
  const pendingApproval = useStore((state) => state.pendingApproval);
  const setPendingApproval = useStore((state) => state.setPendingApproval);
  const loadAll = useStore((state) => state.loadAll);
  const addToast = useStore((state) => state.addToast);

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!pendingApproval) return null;

  const { contract } = pendingApproval;

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await approveIntentApi(contract.intent_id, contract.signature);
      addToast(`Contract approved · Virtual card issued for ${contract.merchant.name}`, 'green');
      setPendingApproval(null);
      await loadAll();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Approval failed', 'rose');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = () => {
    setPendingApproval(null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(7,11,20,0.75)',
        backdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        style={{
          width: 'min(540px, 100%)',
          background: 'rgba(15,23,42,0.95)',
          border: '1px solid rgba(129,140,248,0.3)',
          borderRadius: 16,
          padding: 28,
          boxShadow: '0 25px 60px rgba(0,0,0,0.5), inset 0 1px rgba(255,255,255,0.1)',
          color: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <AlertCircle size={22} color="#fff" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              Human Approval Required
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>
              Autonomous purchase proposal exceeds the ${formatMoney(contract.policy_snapshot.approval_threshold_minor)} policy threshold.
            </p>
          </div>
        </div>

        {/* Contract snapshot summary */}
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: 16,
            marginBottom: 20,
            display: 'grid',
            gap: 12,
            fontSize: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8 }}>
            <span style={{ color: '#64748b' }}>Merchant:</span>
            <strong style={{ color: '#e2e8f0' }}>{contract.merchant.name}</strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8 }}>
            <span style={{ color: '#64748b' }}>User Request:</span>
            <span style={{ color: '#cbd5e1', textAlign: 'right', maxWidth: 280 }}>
              {contract.user_request}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8 }}>
            <span style={{ color: '#64748b' }}>Authorized Cap:</span>
            <strong style={{ color: '#38bdf8', fontFamily: 'JetBrains Mono', fontSize: 14 }}>
              {formatMoney(contract.max_total_minor, contract.currency)}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8 }}>
            <span style={{ color: '#64748b' }}>Treasury Decision:</span>
            <span style={{ color: '#a78bfa', fontWeight: 600, textTransform: 'capitalize' }}>
              {contract.decision} Billing
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Fingerprint size={13} /> Contract Seal:
            </span>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#818cf8' }}>
              {truncateHash(contract.signature, 12, 10)}
            </span>
          </div>
        </div>

        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 24, lineHeight: 1.5 }}>
          By approving, you authorize IntentLock to issue a real Airwallex Virtual Commercial Card strictly bound to this merchant, currency, and maximum cap.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button variant="ghost" size="md" onClick={handleDismiss} disabled={isSubmitting}>
            Review Later
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={isSubmitting}
            onClick={handleApprove}
            icon={<CheckCircle size={16} />}
          >
            Approve & Issue Sandbox Card
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
