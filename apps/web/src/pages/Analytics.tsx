import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Banknote, Download, FileCheck2, ShieldCheck, TrendingDown, Wallet } from 'lucide-react';
import { useStore } from '../state/useStore';
import { formatMoney } from '../lib/formatters';
import { RunwayChart } from '../components/RunwayChart';
import { StatCard } from '../components/StatCard';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/Button';

const panel: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 };

export const AnalyticsPage: React.FC = () => {
  const company = useStore((s) => s.company);
  const intents = useStore((s) => s.intents);
  const cards = useStore((s) => s.cards);
  const transactions = useStore((s) => s.transactions);
  const addToast = useStore((s) => s.addToast);

  const stats = useMemo(() => {
    const cleared = transactions.filter((t) => t.outcome === 'ALLOWED');
    const blocked = transactions.filter((t) => t.outcome === 'BLOCKED');
    const reasons = new Map<string, number>();
    for (const t of blocked) {
      const key = (t.reason || t.rawFailureReason || 'DECLINED').replace(/_/g, ' ');
      reasons.set(key, (reasons.get(key) ?? 0) + 1);
    }
    const decisions = { monthly: 0, annual: 0, defer: 0 };
    for (const i of intents) decisions[i.contract.decision] += 1;
    return {
      clearedMinor: cleared.reduce((sum, t) => sum + t.amountMinor, 0),
      protectedMinor: blocked.reduce((sum, t) => sum + t.amountMinor, 0),
      reasonRows: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
      decisions,
      activeContracts: intents.filter((i) => i.contract.state === 'ACTIVE').length,
    };
  }, [intents, transactions]);

  const headroom = company ? company.currentBalanceMinor - company.reserveFloorMinor : 0;

  const exportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      company,
      contracts: intents.map((i) => ({ intent_id: i.contract.intent_id, state: i.contract.state, decision: i.contract.decision, merchant: i.contract.merchant.name, max_total_minor: i.contract.max_total_minor, currency: i.contract.currency })),
      cards: cards.map((c) => ({ id: c.id, status: c.status, limitMinor: c.limitMinor, remainingMinor: c.remainingMinor })),
      transactions: transactions.map((t) => ({ id: t.id, merchant: t.merchant, amountMinor: t.amountMinor, currency: t.currency, outcome: t.outcome, reason: t.reason })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `intentlock-treasury-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Treasury report downloaded', 'green');
  };

  return (
    <div className="workspace-content">
      <div className="workspace-heading">
        <div>
          <span className="section-kicker">TREASURY</span>
          <h1>Treasury Analytics</h1>
          <p>Live cash position, reserve-floor headroom and enforcement outcomes, computed from your contracts, cards and transactions.</p>
        </div>
        <div className="workspace-actions">
          <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={exportReport}>Export report</Button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', marginBottom: 18 }}>
        <StatCard icon={<Wallet size={18} />} label="Cash on hand" value={company ? formatMoney(company.currentBalanceMinor) : '—'} detail={company ? `Reserve floor ${formatMoney(company.reserveFloorMinor)}` : 'Loading…'} tone="cyan" />
        <StatCard icon={<ShieldCheck size={18} />} label="Floor headroom" value={company ? formatMoney(headroom) : '—'} detail="Balance above the reserve floor" tone={headroom < 0 ? 'rose' : 'green'} />
        <StatCard icon={<Banknote size={18} />} label="Cleared spend" value={formatMoney(stats.clearedMinor)} detail="Authorizations that passed all layers" tone="violet" />
        <StatCard icon={<TrendingDown size={18} />} label="Spend protected" value={formatMoney(stats.protectedMinor)} detail="Declined authorization value" tone="amber" />
        <StatCard icon={<FileCheck2 size={18} />} label="Active contracts" value={stats.activeContracts} detail={`All ${intents.length} decisions: ${stats.decisions.monthly} monthly · ${stats.decisions.annual} annual · ${stats.decisions.defer} deferred`} tone="cyan" />
      </div>

      <div style={{ marginBottom: 16 }}>
        <RunwayChart company={company} />
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <section style={panel} aria-label="Declines by reason">
          <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Declines by reason</h3>
          {stats.reasonRows.length === 0 ? (
            <EmptyState icon={<ShieldCheck size={22} />} title="No declines yet" detail="Run Judge Mode or a Red-Team attack to see enforcement outcomes." />
          ) : (
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.reasonRows} layout="vertical" margin={{ left: 20, right: 12 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} stroke="#64748b" fontSize={11} />
                  <YAxis type="category" dataKey="reason" width={170} stroke="#94a3b8" fontSize={10} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section style={panel} aria-label="Card utilization">
          <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Card limit utilization</h3>
          {cards.length === 0 ? (
            <EmptyState icon={<Wallet size={22} />} title="No cards issued" detail="Cards appear here once a contract is active." />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {cards.map((c) => {
                const used = Math.max(0, c.limitMinor - c.remainingMinor);
                const pct = c.limitMinor > 0 ? Math.min(100, Math.round((used / c.limitMinor) * 100)) : 0;
                return (
                  <div key={c.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>•••• {c.lastFour} · {c.status}</span>
                      <span style={{ color: '#94a3b8' }}>{formatMoney(used)} of {formatMoney(c.limitMinor)}</span>
                    </div>
                    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#6366f1,#22d3ee)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
