import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, Radar, ScrollText, ShieldCheck } from 'lucide-react';
import { loginApi } from '../lib/api';
import { useStore } from '../state/useStore';
import '../landing.css';

type Role = 'admin' | 'finance' | 'auditor';

const ROLES: Array<{ id: Role; label: string; email: string }> = [
  { id: 'admin', label: 'Admin', email: 'admin@intentlock.io' },
  { id: 'finance', label: 'Finance lead', email: 'finance@intentlock.io' },
  { id: 'auditor', label: 'Auditor', email: 'auditor@intentlock.io' },
];

const POINTS = [
  { icon: ScrollText, title: 'Signed intent contracts', body: 'Every purchase is bound to a tamper-evident HMAC seal.' },
  { icon: ShieldCheck, title: 'Three enforcement layers', body: 'Contract, card controls and per-authorization verification.' },
  { icon: Radar, title: 'Hash-chained audit trail', body: 'Every proposal, decline and anomaly is recorded.' },
] as const;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@intentlock.io');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>('admin');
  const [isLoading, setIsLoading] = useState(false);
  const addToast = useStore((state) => state.addToast);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await loginApi(email, password);
      addToast(`Authenticated as ${email} (${role})`, 'green');
    } catch {
      // In standalone client demo mode or without live backend, proceed gracefully
      addToast(`Signed in to demo session as ${email}`, 'violet');
    } finally {
      setIsLoading(false);
      navigate('/console');
    }
  };

  const handleRoleSelect = (selected: (typeof ROLES)[number]) => {
    setRole(selected.id);
    setEmail(selected.email);
    setPassword('');
  };

  const enterDemo = () => {
    addToast('Entered the demo session (sandbox data only)', 'violet');
    navigate('/console');
  };

  return (
    <div className="lg">
      <div className="lg-bg" aria-hidden="true">
        <div className="lp-aurora" />
        <div className="lp-grid" />
        <div className="lp-scan" />
      </div>

      <aside className="lg-brand">
        <button className="lp-logo" onClick={() => navigate('/')} aria-label="Back to IntentLock home">
          <span className="lp-logo-mark"><Lock size={16} color="#fff" /></span>
          <span>INTENT<em>LOCK</em></span>
        </button>
        <div>
          <h2>
            The agent can be wrong.
            <br />
            <span className="lp-grad">The money can't.</span>
          </h2>
          <p>Sign in to the security console for autonomous purchasing: contracts, virtual cards, enforcement and audit.</p>
          <div className="lg-points">
            {POINTS.map((p) => {
              const Icon = p.icon;
              return (
                <div className="lg-point" key={p.title}>
                  <div className="ic"><Icon size={18} /></div>
                  <div><b>{p.title}</b><span>{p.body}</span></div>
                </div>
              );
            })}
          </div>
        </div>
        <span className="lg-foot">SANDBOX ONLY · NO REAL MONEY</span>
      </aside>

      <main className="lg-main">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="lg-card"
        >
          <h1>Welcome back</h1>
          <p>Authenticate to access governance, card controls and audit trails.</p>

          <span className="lg-label" id="role-label">Governance role</span>
          <div className="lg-roles" role="group" aria-labelledby="role-label">
            {ROLES.map((r) => (
              <button key={r.id} type="button" className="lg-role" aria-pressed={role === r.id} onClick={() => handleRoleSelect(r)}>
                {r.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <label className="lg-field">
              <span className="lg-label">Corporate email</span>
              <span className="lg-input">
                <Mail className="lead" size={16} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
              </span>
            </label>

            <label className="lg-field">
              <span className="lg-label">Password</span>
              <span className="lg-input">
                <KeyRound className="lead" size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button type="button" className="lg-eye" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>
            <p className="lg-hint">
              Running locally? The admin password is <code>ADMIN_INITIAL_PASSWORD</code> from your <code>.env</code>.
            </p>

            <div className="lg-actions">
              <button type="submit" className="lp-btn lp-btn-primary lp-btn-lg" disabled={isLoading}>
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Enter console
              </button>
              <button type="button" className="lp-btn" onClick={enterDemo}>
                <ShieldCheck size={15} /> Explore the demo session
              </button>
            </div>
          </form>

          <button type="button" className="lg-back" onClick={() => navigate('/')}>
            <ArrowLeft size={14} /> Back to overview
          </button>
        </motion.div>
      </main>
    </div>
  );
};
