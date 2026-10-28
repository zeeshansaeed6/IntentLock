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
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            Treasury & Portfolio Intelligence
            <span className="text-xs font-normal text-muted-foreground px-2 py-1 rounded bg-muted">
              Powered by Capitalio Engine
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time asset allocation, risk-adjusted returns, and autonomous liquidity insights.
          </p>
        </div>

        {/* View Toggle + Period Filter + Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tab Selector */}
          <div className="flex items-center rounded-lg border border-border bg-card/60 p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              <LayoutDashboard size={13} />
              <span>Overview</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-muted-foreground hover:text-white'
              }`}
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
