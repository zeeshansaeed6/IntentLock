import React, { useMemo, useState } from 'react';
import { ShieldCheck, ChevronRight, Fingerprint, Download, Search } from 'lucide-react';
import { useStore } from '../state/useStore';
import { formatDate, formatTime, truncateHash } from '../lib/formatters';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/Button';

const TONES = ['all', 'green', 'rose', 'amber', 'violet'] as const;

export const AuditPage: React.FC = () => {
  const audits = useStore((state) => state.audits);
  const addToast = useStore((state) => state.addToast);
  const [query, setQuery] = useState('');
  const [tone, setTone] = useState<(typeof TONES)[number]>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return audits.filter((a) => (tone === 'all' || a.tone === tone) && (!q || `${a.message} ${a.type}`.toLowerCase().includes(q)));
  }, [audits, query, tone]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `intentlock-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast(`Exported ${filtered.length} audit events`, 'green');
  };

  return (
    <div className="workspace-content">
      <div className="workspace-heading">
        <div>
          <span className="section-kicker">COMPLIANCE & INTEGRITY</span>
          <h1>Cryptographic Audit Trail</h1>
          <p>Every autonomous action, deterministic policy check, and Airwallex lifecycle event recorded with SHA256 integrity.</p>
        </div>
        <div className="workspace-actions">
          <Button variant="secondary" size="sm" onClick={exportJson} disabled={filtered.length === 0} icon={<Download size={13} />}>
            Export JSON
          </Button>
        </div>
      </div>

      {audits.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', flex: '1 1 220px' }}>
            <Search size={14} color="#64748b" />
            <input
              aria-label="Search audit events"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events…"
              style={{ background: 'none', border: 0, outline: 0, color: 'inherit', width: '100%', font: 'inherit', fontSize: 13 }}
            />
          </label>
          <div role="group" aria-label="Filter by severity" style={{ display: 'flex', gap: 6 }}>
            {TONES.map((t) => (
              <button
                key={t}
                aria-pressed={tone === t}
                onClick={() => setTone(t)}
                style={{ padding: '6px 12px', borderRadius: 999, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600,
                  background: tone === t ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${tone === t ? 'rgba(129,140,248,0.6)' : 'rgba(255,255,255,0.08)'}`, color: tone === t ? '#c7d2fe' : '#94a3b8' }}
              >
                {t}
              </button>
            ))}
          </div>
          <small style={{ color: '#64748b' }}>{filtered.length} of {audits.length}</small>
        </div>
      )}

      {audits.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={24} />}
          title="Audit log is empty"
          detail="Agent proposals and card operations will automatically populate the immutable audit log."
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search size={24} />} title="No matching events" detail="Try a different search term or severity filter." />
      ) : (
        <div className="table-panel audit-table">
          {filtered.map((audit) => {
            const dotTone = ['green', 'rose', 'amber'].includes(audit.tone) ? audit.tone : 'violet';
            return (
              <div className="audit-row" key={audit.id}>
                <div className={`audit-dot ${dotTone}`} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <strong>{audit.message}</strong>
                    <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono', padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: '#94a3b8', textTransform: 'uppercase' }}>
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
