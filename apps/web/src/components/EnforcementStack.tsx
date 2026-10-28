import React from 'react';
import { motion } from 'framer-motion';
import { Shield, CreditCard, CheckCircle2, XCircle, ArrowDown } from 'lucide-react';

export interface EnforcementStackProps {
  lastTransaction?: {
    merchant: string;
    amountMinor: number;
    currency: string;
    outcome: 'ALLOWED' | 'BLOCKED';
    reason?: string;
  } | null;
}

export const EnforcementStack: React.FC<EnforcementStackProps> = ({ lastTransaction }) => {
  const isBlocked = lastTransaction?.outcome === 'BLOCKED';
  const reason = lastTransaction?.reason || '';

  // Determine which layer stopped the transaction
  let stoppedAtLayer: number | null = null;
  if (isBlocked) {
    if (reason.includes('SIGNATURE') || reason.includes('MERCHANT_NOT_ALLOWED') || reason.includes('CONTRACT_') || reason.includes('TIME_WINDOW')) {
      stoppedAtLayer = 1;
    } else if (reason.includes('CARD_') || reason.includes('MAX_TRANSACTIONS')) {
      stoppedAtLayer = 2;
    } else {
      stoppedAtLayer = 3;
    }
  }

  const layers = [
    {
      level: 1,
      title: 'Layer 1: Cryptographic Intent Contract',
      subtitle: 'HMAC-SHA256 seal · Bound merchant · Time window',
      icon: <Shield size={18} />,
      status: stoppedAtLayer === 1 ? 'blocked' : lastTransaction ? 'passed' : 'idle',
      details: stoppedAtLayer === 1 ? `STOPPED: ${reason}` : 'Cryptographic integrity & merchant verified',
    },
    {
      level: 2,
      title: 'Layer 2: Virtual Card Controls',
      subtitle: 'Active status · Max transactions · Department budget',
      icon: <CreditCard size={18} />,
      status: stoppedAtLayer === 2 ? 'blocked' : stoppedAtLayer === 1 ? 'skipped' : lastTransaction ? 'passed' : 'idle',
      details: stoppedAtLayer === 2 ? `STOPPED: ${reason}` : 'Card status & transaction count verified',
    },
    {
      level: 3,
      title: 'Layer 3: Runtime Authorization Engine',
      subtitle: 'MCC category · Currency · Per-tx cap · Remaining balance',
      icon: <CheckCircle2 size={18} />,
      status: stoppedAtLayer === 3 ? 'blocked' : (stoppedAtLayer === 1 || stoppedAtLayer === 2) ? 'skipped' : lastTransaction ? 'passed' : 'idle',
      details: stoppedAtLayer === 3 ? `STOPPED: ${reason}` : lastTransaction ? 'Authorization approved & cleared' : 'Real-time telemetry & velocity checks',
    },
  ];

  return (
    <div className="panel" style={{ padding: 22, minHeight: 330 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <span className="panel-kicker">3-LAYER ARCHITECTURE</span>
          <h2 style={{ margin: '4px 0 0', fontSize: 16 }}>Enforcement Stack</h2>
        </div>
        {lastTransaction && (
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 9, color: '#64748b', display: 'block' }}>Recent Trace</span>
            <span
              style={{
                fontSize: 11,
                fontFamily: 'JetBrains Mono',
                fontWeight: 600,
                color: isBlocked ? '#fda4af' : '#6ee7b7',
              }}
            >
              {lastTransaction.merchant} · {lastTransaction.outcome}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {layers.map((layer, idx) => {
          let borderColor = 'rgba(147,160,191,0.12)';
          let bgColor = 'rgba(16,27,52,0.6)';
          let statusColor = '#94a3b8';

          if (layer.status === 'passed') {
            borderColor = 'rgba(52,211,153,0.3)';
            bgColor = 'rgba(52,211,153,0.06)';
            statusColor = '#34d399';
          } else if (layer.status === 'blocked') {
            borderColor = 'rgba(244,63,94,0.45)';
            bgColor = 'rgba(244,63,94,0.1)';
            statusColor = '#f43f5e';
          } else if (layer.status === 'skipped') {
            bgColor = 'rgba(13,21,39,0.3)';
            statusColor = '#64748b';
          }

          return (
            <React.Fragment key={layer.level}>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.08 }}
                style={{
                  border: `1px solid ${borderColor}`,
                  background: bgColor,
                  borderRadius: 10,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  transition: 'all 0.3s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: layer.status === 'blocked'
                        ? 'rgba(244,63,94,0.15)'
                        : layer.status === 'passed'
                        ? 'rgba(52,211,153,0.15)'
                        : 'rgba(99,102,241,0.15)',
                      color: statusColor,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    {layer.status === 'blocked' ? <XCircle size={18} /> : layer.icon}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>
                      {layer.title}
                    </h4>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{layer.subtitle}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10,
                      fontWeight: 600,
                      fontFamily: 'JetBrains Mono',
                      color: statusColor,
                    }}
                  >
                    {layer.details}
                  </span>
                </div>
              </motion.div>

              {idx < layers.length - 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '-4px 0' }}>
                  <ArrowDown size={14} color="rgba(147,160,191,0.25)" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
