import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ShieldAlert, Fingerprint, Copy, Check, AlertOctagon, RotateCcw, CheckCircle } from 'lucide-react';
import type { IntentContract } from '@intentlock/shared';
import { formatMoney, truncateHash } from '../lib/formatters';
import { StatusPill } from './StatusPill';
import { Button } from './Button';

export interface ContractViewerProps {
  contract: IntentContract;
  onApprove?: (intentId: string, signature: string) => Promise<void>;
}

export const ContractViewer: React.FC<ContractViewerProps> = ({ contract, onApprove }) => {
  const [isTampered, setIsTampered] = useState(false);
  const [tamperedField, setTamperedField] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const handleCopySig = () => {
    navigator.clipboard.writeText(contract.signature);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTamperTest = () => {
    setIsTampered(true);
    setTamperedField('max_total_minor (Tampered: $500.00 → $50,000.00)');
  };

  const handleResetContract = () => {
    setIsTampered(false);
    setTamperedField(null);
  };

  const handleApprove = async () => {
    if (!onApprove) return;
    setIsApproving(true);
    try {
      await onApprove(contract.intent_id, contract.signature);
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div
      style={{
        borderRadius: 14,
        border: isTampered ? '1px solid rgba(244,63,94,0.5)' : '1px solid rgba(129,140,248,0.25)',
        background: isTampered
          ? 'radial-gradient(circle at top right, rgba(244,63,94,0.12), rgba(13,21,39,0.95))'
          : 'radial-gradient(circle at top right, rgba(99,102,241,0.12), rgba(13,21,39,0.95))',
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: isTampered
          ? '0 15px 40px rgba(244,63,94,0.18)'
          : '0 15px 40px rgba(10,15,30,0.4)',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Cryptographic Seal Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <motion.div
            animate={{
              rotate: isTampered ? [0, -10, 10, -10, 0] : [0, 360],
              scale: isTampered ? 1.05 : 1,
            }}
            transition={{
              rotate: isTampered ? { duration: 0.5 } : { duration: 25, repeat: Infinity, ease: 'linear' },
              scale: { duration: 0.2 },
            }}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: isTampered
                ? 'linear-gradient(135deg, #f43f5e, #be123c)'
                : 'linear-gradient(135deg, #6366f1, #06b6d4)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: isTampered
                ? '0 0 20px rgba(244,63,94,0.5)'
                : '0 0 20px rgba(99,102,241,0.4)',
            }}
          >
            {isTampered ? <ShieldAlert size={24} color="#fff" /> : <ShieldCheck size={24} color="#fff" />}
          </motion.div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
                Intent-Bound Purchase Contract
              </h3>
              <StatusPill status={isTampered ? 'TAMPER_DETECTED' : contract.state} />
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono', marginTop: 4 }}>
              {contract.intent_id}
            </div>
          </div>
        </div>

        {/* Seal verification pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            borderRadius: 20,
            background: isTampered ? 'rgba(244,63,94,0.15)' : 'rgba(52,211,153,0.12)',
            border: isTampered ? '1px solid rgba(244,63,94,0.3)' : '1px solid rgba(52,211,153,0.25)',
            color: isTampered ? '#fda4af' : '#6ee7b7',
            fontSize: 10,
            fontWeight: 600,
            fontFamily: 'JetBrains Mono',
          }}
        >
          <Fingerprint size={13} />
          <span>{isTampered ? 'SEAL BROKEN (INVALID)' : 'SEAL VERIFIED (HMAC-SHA256)'}</span>
        </div>
      </div>

      {/* Tamper Alert Banner */}
      <AnimatePresence>
        {isTampered && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: 'rgba(244,63,94,0.15)',
              border: '1px solid rgba(244,63,94,0.4)',
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#fecdd3',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertOctagon size={18} color="#f43f5e" />
              <div>
                <strong style={{ fontSize: 12 }}>Cryptographic Signature Mismatch</strong>
                <p style={{ margin: '2px 0 0', fontSize: 10, color: '#fda4af' }}>
                  Field {tamperedField} failed HMAC-SHA256 integrity verification. Authorization rejected.
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={handleResetContract} icon={<RotateCcw size={12} />}>
              Restore Contract
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contract Terms Matrix */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          padding: 14,
          background: 'rgba(15,23,42,0.6)',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.06)',
          fontSize: 11,
        }}
      >
        <div>
          <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Bound Merchant</span>
          <strong style={{ color: '#e2e8f0', fontSize: 13 }}>{contract.merchant.name}</strong>
          <small style={{ color: '#94a3b8', display: 'block' }}>
            Aliases: {contract.merchant.allowed_names.join(', ')}
          </small>
        </div>

        <div>
          <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Maximum Total Cap</span>
          <strong style={{ color: isTampered ? '#f43f5e' : '#38bdf8', fontSize: 14, fontFamily: 'JetBrains Mono' }}>
            {isTampered ? '$50,000.00' : formatMoney(contract.max_total_minor)}
          </strong>
          <small style={{ color: '#94a3b8', display: 'block' }}>
            Per-Tx: {formatMoney(contract.max_per_transaction_minor)} · {contract.max_transactions} max txn
          </small>
        </div>

        <div>
          <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Allowed MCCs</span>
          <strong style={{ color: '#e2e8f0', fontFamily: 'JetBrains Mono' }}>
            {contract.allowed_mcc.join(', ') || 'N/A'}
          </strong>
          <small style={{ color: '#94a3b8', display: 'block' }}>
            Currencies: {contract.allowed_currencies.join(', ')}
          </small>
        </div>

        <div>
          <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Treasury Decision</span>
          <strong style={{ color: '#a78bfa', textTransform: 'capitalize' }}>
            {contract.decision} Schedule
          </strong>
          <small style={{ color: '#94a3b8', display: 'block' }}>
            Review: {new Date(contract.reconsider_on).toLocaleDateString()}
          </small>
        </div>
      </div>

      {/* User Rationale & Policy Snapshot */}
      <div style={{ marginTop: 14, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
        <span style={{ color: '#64748b', fontWeight: 600 }}>Proposal Rationale: </span>
        {contract.rationale}
      </div>

      {/* Cryptographic Signature Footer & Actions */}
      <div
        style={{
          marginTop: 18,
          paddingTop: 14,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Fingerprint size={14} color="#818cf8" />
          <span style={{ fontSize: 10, color: '#64748b' }}>HMAC:</span>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: isTampered ? '#f43f5e' : '#a5b4fc' }}>
            {truncateHash(contract.signature, 16, 12)}
          </span>
          <button
            onClick={handleCopySig}
            style={{ background: 'transparent', border: 0, color: '#94a3b8', cursor: 'pointer', padding: 2 }}
            title="Copy Signature"
          >
            {copied ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!isTampered && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleTamperTest}
              icon={<AlertOctagon size={13} />}
            >
              Tamper Test
            </Button>
          )}

          {contract.state === 'PENDING_APPROVAL' && onApprove && (
            <Button
              variant="primary"
              size="sm"
              loading={isApproving}
              onClick={handleApprove}
              icon={<CheckCircle size={13} />}
            >
              Approve Contract
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
