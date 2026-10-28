import React from 'react';
import { ShieldCheck, ChevronRight, Fingerprint } from 'lucide-react';
import { useStore } from '../state/useStore';
import { formatDate, formatTime, truncateHash } from '../lib/formatters';
import { EmptyState } from '../components/EmptyState';

export const AuditPage: React.FC = () => {
  const audits = useStore((state) => state.audits);

  return (
    <div className="workspace-content">
      <div className="workspace-heading">
        <div>
          <span className="section-kicker">COMPLIANCE & INTEGRITY</span>
          <h1>Cryptographic Audit Trail</h1>
          <p>Every autonomous action, deterministic policy check, and Airwallex lifecycle event recorded with SHA256 integrity.</p>
        </div>
      </div>

      {audits.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={24} />}
          title="Audit log is empty"
          detail="Agent proposals and card operations will automatically populate the immutable audit log."
        />
      ) : (
        <div className="table-panel audit-table">
          {audits.map((audit) => {
            let dotTone = 'violet';
            if (audit.tone === 'green') dotTone = 'green';
            if (audit.tone === 'rose') dotTone = 'rose';
            if (audit.tone === 'amber') dotTone = 'amber';

            return (
              <div className="audit-row" key={audit.id}>
                <div className={`audit-dot ${dotTone}`} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <strong>{audit.message}</strong>
                    <span
                      style={{
                        fontSize: 9,
                        fontFamily: 'JetBrains Mono',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'rgba(255,255,255,0.05)',
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                      }}
                    >
                      {audit.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <small style={{ color: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono', marginTop: 3 }}>
                    {formatDate(audit.createdAt)} · {formatTime(audit.createdAt)}
                    {audit.metadata?.intentId && (
                      <span style={{ marginLeft: 8, color: '#818cf8' }}>
                        <Fingerprint size={10} style={{ display: 'inline', verticalAlign: '-1px' }} /> {truncateHash(String(audit.metadata.intentId), 8, 6)}
                      </span>
                    )}
                  </small>
                </div>
                <ChevronRight size={15} color="#475569" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
