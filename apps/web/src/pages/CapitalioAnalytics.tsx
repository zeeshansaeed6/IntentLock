import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  DashboardNavigationProvider,
  useDashboardNavigation,
} from '../components/dashboards/capitalio-dashboard/components/capitalio/navigation';
import { DashboardPage } from '../components/dashboards/capitalio-dashboard/components/capitalio/dashboard-page';
import { AnalyticsPage } from '../components/dashboards/capitalio-dashboard/components/capitalio/analytics-page';
import {
  dashboardPeriods,
  type PeriodValue,
} from '../components/dashboards/capitalio-dashboard/data';
import {
  TopbarCalendarIcon,
  TopbarChevronIcon,
  TopbarExportIcon,
} from '../components/dashboards/capitalio-dashboard/components/capitalio/icons';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { LayoutDashboard, TrendingUp, ShieldCheck } from 'lucide-react';
import { useStore } from '../state/useStore';

function CapitalioAnalyticsInner() {
  const { period, setPeriod } = useDashboardNavigation();
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview');
  const addToast = useStore((state) => state.addToast);

  const selectedPeriod =
    dashboardPeriods.find((p) => p.value === period) ?? dashboardPeriods[0];

  const handleExport = () => {
    addToast('Exporting Treasury Intelligence Report (CSV/JSON)...', 'green');
  };

  return (
    <div className="capitalio-dashboard dark min-h-full p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="premium-badge">AIRWALLEX COMMERCIAL ISSUING</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck size={11} />
              TREASURY SAFEGUARD ACTIVE
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 4, marginBottom: 4 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.8px', color: '#ffffff' }}>
              Treasury & Portfolio Intelligence
            </h1>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#94a3b8',
                padding: '3px 10px',
                borderRadius: 6,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              Powered by Capitalio Engine
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time asset allocation, risk-adjusted returns, and autonomous liquidity insights.
          </p>
        </div>

        {/* View Toggle + Period Filter + Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tab Selector */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(21, 21, 23, 0.8)',
              padding: 3,
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                border: 0,
                transition: 'all 0.15s ease',
                background: activeTab === 'overview' ? 'var(--primary, #6366f1)' : 'transparent',
                color: activeTab === 'overview' ? '#ffffff' : '#94a3b8',
                boxShadow: activeTab === 'overview' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              }}
            >
              <LayoutDashboard size={13} />
              <span>Overview</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                border: 0,
                transition: 'all 0.15s ease',
                background: activeTab === 'analytics' ? 'var(--primary, #6366f1)' : 'transparent',
                color: activeTab === 'analytics' ? '#ffffff' : '#94a3b8',
                boxShadow: activeTab === 'analytics' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              }}
            >
              <TrendingUp size={13} />
              <span>Deep Analytics</span>
            </button>
          </div>

          {/* Period Selector */}
          <div className="flex items-center">
            <div className="hidden sm:flex h-9 items-center gap-2 rounded-l-md border border-r-0 border-border bg-background px-3 text-xs text-muted-foreground">
              <TopbarCalendarIcon className="size-3.5" />
              <span>Period</span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 rounded-md sm:rounded-l-none bg-card text-xs font-medium text-foreground hover:bg-muted"
                >
                  <span>{selectedPeriod.label}</span>
                  <TopbarChevronIcon className="size-2.5 rotate-180 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {dashboardPeriods.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setPeriod(option.value as PeriodValue)}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Export Button */}
          <Button
            size="sm"
            onClick={handleExport}
            className="h-9 gap-1.5 text-xs bg-muted/80 hover:bg-muted text-foreground border border-border/80"
          >
            <span>Export</span>
            <TopbarExportIcon className="size-3 rotate-180" />
          </Button>
        </div>
      </div>

      {/* Render Selected View */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'overview' ? <DashboardPage /> : <AnalyticsPage />}
      </motion.div>
    </div>
  );
}

export function CapitalioAnalyticsPage() {
  return (
    <DashboardNavigationProvider>
      <CapitalioAnalyticsInner />
    </DashboardNavigationProvider>
  );
}
