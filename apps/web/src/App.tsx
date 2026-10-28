import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BrainCircuit,
  CreditCard,
  BarChart3,
  FileCheck2,
  ShieldCheck,
  RotateCcw,
  Scale,
  Menu,
  X,
  ChevronRight,
  Shield,
  Activity,
} from 'lucide-react';
import { useStore } from './state/useStore';
import { useSSE } from './lib/useSSE';
import { ToastContainer } from './components/Toast';
import { JudgeBar } from './components/JudgeBar';
import { ApprovalInbox } from './components/ApprovalInbox';
import { Button } from './components/Button';
import { LandingPage } from './pages/Landing';
import { LoginPage } from './pages/Login';
import { CommandCenterPage } from './pages/CommandCenter';
import { IntentsPage } from './pages/Intents';
import { CardsPage } from './pages/Cards';
import { TransactionsPage } from './pages/Transactions';
import { AuditPage } from './pages/Audit';
import { RedTeamLabPage } from './pages/RedTeamLab';

const NAV_ITEMS = [
  { label: 'Command Center', path: '/console', icon: LayoutDashboard },
  { label: 'Intents', path: '/intents', icon: BrainCircuit },
  { label: 'Cards', path: '/cards', icon: CreditCard },
  { label: 'Transactions', path: '/transactions', icon: BarChart3 },
  { label: 'Audit Trail', path: '/audit', icon: FileCheck2 },
  { label: 'Red-Team Lab', path: '/redteam', icon: ShieldCheck },
];

const ConsoleLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const health = useStore((state) => state.health);
  const judge = useStore((state) => state.judge);
  const setJudge = useStore((state) => state.setJudge);
  const resetDemo = useStore((state) => state.resetDemo);
  const intents = useStore((state) => state.intents);

  const pendingCount = intents.filter((i) => i.contract.state === 'PENDING_APPROVAL').length;
  const currentNav = NAV_ITEMS.find((item) => item.path === location.pathname) ?? NAV_ITEMS[0];

  return (
    <div className="console-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div
            className="logo compact cursor-pointer"
            onClick={() => navigate('/')}
            style={{ cursor: 'pointer' }}
          >
            <div className="logo-mark">
              <span />
              <span />
              <span />
            </div>
            <span>
              INTENT<span className="logo-accent">LOCK</span>
            </span>
          </div>
          <button className="mobile-close" onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-avatar">AL</div>
          <div>
            <strong>Acme AI Labs</strong>
            <span>Airwallex Commercial Issuing</span>
          </div>
          <Shield size={14} color="#6ee7b7" />
        </div>

        <div className="nav-section-label">GOVERNANCE & CONTROLS</div>

        <nav>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                className={`side-nav ${isActive ? 'active' : ''}`}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {item.path === '/intents' && pendingCount > 0 && (
                  <span className="nav-count">{pendingCount} pending</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />

        <div className="security-status">
          <div className="security-icon">
            <ShieldCheck size={18} />
          </div>
          <div>
            <strong>HMAC Intent Binding</strong>
            <span>Active & Sealed</span>
          </div>
          <span className="status-dot" />
        </div>

        <button className="back-home" onClick={() => navigate('/')}>
          <ChevronRight size={14} className="rotate-180" />
          <span>Exit to Overview</span>
        </button>
      </aside>

      {/* Main Container */}
      <div className="console-main">
        {/* Topbar */}
        <header className="console-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="mobile-menu" onClick={() => setMobileOpen(true)}>
              <Menu size={18} />
            </button>
            <div className="breadcrumb">
              <span>Console</span>
              <ChevronRight size={12} />
              <strong>{currentNav.label}</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="health">
              <span className={`status-dot ${health?.airwallex === 'sandbox' ? '' : 'offline'}`} />
              <span>
                Airwallex: {health?.airwallex === 'sandbox' ? 'Sandbox Connected' : 'Mock Gateway'}
              </span>
            </div>

            <button
              className="judge-button"
              onClick={() => setJudge({ isActive: !judge.isActive })}
            >
              <Scale size={13} />
              <span>Judge Mode</span>
            </button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => resetDemo()}
              icon={<RotateCcw size={12} />}
            >
              Reset Demo
            </Button>

            <div className="profile" title="Admin User">
              AD
            </div>
          </div>
        </header>

        {/* Optional JudgeBar overlay */}
        {judge.isActive && <JudgeBar />}

        {/* Page Content */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {children}
        </div>

        {/* Footer */}
        <footer className="console-footer">
          <span>
            <Activity size={12} color="#6ee7b7" />
            Airwallex Agentic Banking Hackathon · Track 2 (Intent-Bound Purchase Agent)
          </span>
          <span className="mono-label">SANDBOX ENVIRONMENT · ZERO REAL FUNDS</span>
        </footer>
      </div>
    </div>
  );
};

export default function App() {
  const loadAll = useStore((state) => state.loadAll);
  const addToast = useStore((state) => state.addToast);

  // Initialize store on mount
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Listen for real-time SSE events
  useSSE((event) => {
    loadAll();
    if (event.type === 'anomaly') {
      addToast(`ANOMALY: ${event.message}`, 'rose');
    } else if (event.type === 'approval') {
      addToast(`APPROVAL: ${event.message}`, 'green');
    } else if (event.type === 'execute') {
      addToast(`EXECUTED: ${event.message}`, 'green');
    }
  });

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/console"
          element={
            <ConsoleLayout>
              <CommandCenterPage />
            </ConsoleLayout>
          }
        />
        <Route
          path="/intents"
          element={
            <ConsoleLayout>
              <IntentsPage />
            </ConsoleLayout>
          }
        />
        <Route
          path="/cards"
          element={
            <ConsoleLayout>
              <CardsPage />
            </ConsoleLayout>
          }
        />
        <Route
          path="/transactions"
          element={
            <ConsoleLayout>
              <TransactionsPage />
            </ConsoleLayout>
          }
        />
        <Route
          path="/audit"
          element={
            <ConsoleLayout>
              <AuditPage />
            </ConsoleLayout>
          }
        />
        <Route
          path="/redteam"
          element={
            <ConsoleLayout>
              <RedTeamLabPage />
            </ConsoleLayout>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global Modals & Notifications */}
      <ApprovalInbox />
      <ToastContainer />
    </HashRouter>
  );
}
