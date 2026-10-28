import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, CreditCard, ShieldCheck, DollarSign, Activity, TrendingUp } from 'lucide-react';
import { useStore } from '../state/useStore';
import { submitIntent } from '../lib/api';
import { formatMoney } from '../lib/formatters';
import { StatCard } from '../components/StatCard';
import { RunwayChart } from '../components/RunwayChart';
import { EnforcementStack } from '../components/EnforcementStack';
import { Timeline, type TimelineStep } from '../components/Timeline';

const QUICK_PROMPTS = [
  '40 GPU hours, budget $90',
  'Buy a team plan for our design tool, 10 seats, keep it cost-efficient.',
  'Render cluster instances, cap $450 for model training',
];

export const CommandCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const [requestText, setRequestText] = useState('Buy a team plan for our design tool, 10 seats, keep it cost-efficient.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const intents = useStore((state) => state.intents);
  const cards = useStore((state) => state.cards);
  const transactions = useStore((state) => state.transactions);
  const audits = useStore((state) => state.audits);
  const company = useStore((state) => state.company);
  const loadAll = useStore((state) => state.loadAll);
  const addToast = useStore((state) => state.addToast);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestText.trim()) return;

    setIsSubmitting(true);
    try {
      const record = await submitIntent(requestText.trim());
      addToast(
        record.contract.state === 'PENDING_APPROVAL'
          ? `Intent proposed · Awaiting human approval for ${record.contract.merchant.name}`
          : `Intent approved & card issued for ${record.contract.merchant.name}`,
        record.contract.state === 'PENDING_APPROVAL' ? 'amber' : 'green'
      );
      await loadAll();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Intent failed', 'rose');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCardsCount = cards.filter((c) => c.status === 'ACTIVE').length;
  const boundTotalMinor = intents.reduce((acc, i) => acc + i.contract.max_total_minor, 0);
  const deptBudgetRemainingMinor = company?.departmentBudgetRemainingMinor ?? 1000000;
  const blockedAttempts = transactions.filter((t) => t.outcome === 'BLOCKED').length;

  const recentTransactions = transactions.slice(0, 1)[0] ?? null;

  // Timeline steps from audits
  const timelineSteps: TimelineStep[] = audits.slice(0, 4).map((a) => ({
    id: a.id,
    title: a.type.replace(/_/g, ' ').toUpperCase(),
    detail: a.message,
    tone: a.tone === 'rose' ? 'rose' : a.tone === 'green' ? 'green' : 'violet',
    badge: a.metadata?.intentId ? 'SEALED' : undefined,
  }));

  return (
    <div className="dashboard-content">
      {/* Intent Input Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="hero-intent-card"
      >
        <div className="intent-card-glow" />
        <div className="intent-label" style={{ justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="spark-icon dashboard-icon-badge"><Sparkles size={14} /></span>
            <span>AUTONOMOUS PURCHASE AGENT · NATURAL LANGUAGE INTENT</span>
          </div>
          <span className="premium-badge">CAPITALIO THEMED</span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="intent-input">
            <input
              type="text"
              value={requestText}
              onChange={(e) => setRequestText(e.target.value)}
              placeholder="Describe your purchase request (e.g. 40 GPU hours, budget $90)..."
              disabled={isSubmitting}
            />
          </div>

          <div className="intent-footer">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="example-chip"
                  onClick={() => setRequestText(prompt)}
                >
                  <Sparkles size={10} />
                  <span>{prompt}</span>
                </button>
              ))}
            </div>

            <button
              type="submit"
              className="send-button"
              disabled={isSubmitting}
              title="Submit Intent"
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </motion.div>

      {/* 4 Stat Cards */}
      <div className="stat-grid">
        <StatCard
          icon={<CreditCard size={16} />}
          label="Active Virtual Cards"
          value={activeCardsCount}
          detail="Airwallex sandbox cards issued"
          tone="cyan"
        />
        <StatCard
          icon={<DollarSign size={16} />}
          label="Bound Intent Cap"
          value={formatMoney(boundTotalMinor)}
          detail="Strict cryptographic limits"
          tone="violet"
        />
        <StatCard
          icon={<Activity size={16} />}
          label="Remaining Dept Budget"
          value={formatMoney(deptBudgetRemainingMinor)}
          detail="Q4 engineering allocation"
          tone="green"
        />
        <StatCard
          icon={<ShieldCheck size={16} />}
          label="Enforcement Blocks"
          value={blockedAttempts}
          detail="Policy declines & anomalies stopped"
          tone="rose"
        />
      </div>

      {/* Capitalio Treasury Intelligence Banner */}
      <div
        className="panel group cursor-pointer transition-all duration-200 hover:border-white/20"
        style={{
          background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.12), rgba(0, 218, 146, 0.08))',
          borderColor: 'rgba(99, 102, 241, 0.28)',
          minHeight: 'auto',
          marginBottom: 18,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 20px',
        }}
        onClick={() => navigate('/analytics')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="dashboard-icon-badge" style={{ width: 36, height: 36, borderRadius: 8, display: 'grid', placeItems: 'center', color: '#00DA92' }}>
            <TrendingUp size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: 13, color: '#fff' }}>Capitalio Treasury Intelligence & Asset Allocation</strong>
              <span className="premium-badge">NEW</span>
            </div>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              Deep portfolio metrics, historical returns, S&P 500 benchmarks & AI smart rebalancing insights
            </span>
          </div>
        </div>

        <button
          type="button"
          className="ghost-button"
          style={{ color: '#00DA92', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, background: 'rgba(0,218,146,0.08)', padding: '6px 12px', borderRadius: 6 }}
        >
          <span>Open Dashboard</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Main Grid: Runway Chart + Enforcement Stack */}
      <div className="dashboard-grid">
        <RunwayChart company={company} />
        <EnforcementStack lastTransaction={recentTransactions} />
      </div>

      {/* Recent Reasoning Trail */}
      {timelineSteps.length > 0 && (
        <div className="panel" style={{ marginTop: 18, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <span className="panel-kicker">EXECUTION AUDIT LOG</span>
              <h2 style={{ margin: '4px 0 0', fontSize: 16 }}>Autonomous Agent Telemetry</h2>
            </div>
            <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'JetBrains Mono' }}>
              HMAC Cryptographically Verified
            </span>
          </div>
          <Timeline steps={timelineSteps} />
        </div>
      )}
    </div>
  );
};
