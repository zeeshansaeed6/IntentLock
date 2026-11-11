import React from 'react';
import { Keyboard, RotateCcw, Server, ShieldCheck } from 'lucide-react';
import { useStore } from '../state/useStore';
import { formatMoney } from '../lib/formatters';
import { Button } from '../components/Button';

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 13 }}>
    <span style={{ color: '#94a3b8' }}>{label}</span>
    <strong style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, textAlign: 'right' }}>{value}</strong>
  </div>
);

const Panel: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <section style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
    <h3 style={{ margin: '0 0 8px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>{icon}{title}</h3>
    {children}
  </section>
);

export const SettingsPage: React.FC = () => {
  const health = useStore((s) => s.health);
  const company = useStore((s) => s.company);
  const resetDemo = useStore((s) => s.resetDemo);
  const setShortcutsOpen = useStore((s) => s.setShortcutsOpen);

  return (
    <div className="workspace-content">
      <div className="workspace-heading">
        <div>
          <span className="section-kicker">WORKSPACE</span>
          <h1>Settings & System Status</h1>
          <p>Runtime mode, policy snapshot and demo controls. Secrets are never shown here.</p>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <Panel icon={<Server size={16} color="#818cf8" />} title="Runtime">
          <Row label="API" value={health ? 'Online' : 'Unreachable'} />
          <Row label="Agent mode" value={health?.mode ?? '—'} />
          <Row label="Airwallex" value={health?.airwallex === 'sandbox' ? 'Sandbox connected' : 'Mock gateway'} />
          {health?.fundedBalance && <Row label="Funded balance" value={formatMoney(health.fundedBalance.availableMinor, health.fundedBalance.currency)} />}
        </Panel>
        <Panel icon={<ShieldCheck size={16} color="#34d399" />} title="Policy snapshot">
          <Row label="Company" value={company?.companyName ?? '—'} />
          <Row label="Reserve floor" value={company ? formatMoney(company.reserveFloorMinor) : '—'} />
          <Row label="Dept. budget remaining" value={company ? formatMoney(company.departmentBudgetRemainingMinor) : '—'} />
          <Row label="Approval threshold" value={company ? formatMoney(company.approvalThresholdMinor) : '—'} />
        </Panel>
        <Panel icon={<RotateCcw size={16} color="#fbbf24" />} title="Demo controls">
          <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 12px' }}>Clear contracts, cards, transactions and audit log back to the initial seed.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button variant="secondary" size="sm" icon={<RotateCcw size={12} />} onClick={() => resetDemo()}>Reset demo</Button>
            <Button variant="ghost" size="sm" icon={<Keyboard size={12} />} onClick={() => setShortcutsOpen(true)}>Keyboard shortcuts</Button>
          </div>
        </Panel>
      </div>
    </div>
  );
};
