import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, UserCheck, ArrowRight } from 'lucide-react';
import { Button } from '../components/Button';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@intentlock.io');
  const [role, setRole] = useState<'admin' | 'finance' | 'auditor'>('admin');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      navigate('/console');
    }, 400);
  };

  const handleRoleSelect = (selectedRole: 'admin' | 'finance' | 'auditor', defaultEmail: string) => {
    setRole(selectedRole);
    setEmail(defaultEmail);
  };

  return (
    <div className="login-page">
      <div className="login-glow" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="login-card"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <ShieldCheck size={18} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 16 }}>
            INTENT<span style={{ color: '#67e8f9' }}>LOCK</span>
          </span>
        </div>

        <h1>Fintech Security Console</h1>
        <p>Authenticate to access autonomous purchasing governance, card controls, and audit trails.</p>

        {/* Quick Role Switcher */}
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>
            Select Governance Role
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <button
              type="button"
              onClick={() => handleRoleSelect('admin', 'admin@intentlock.io')}
              style={{
                padding: '8px 4px',
                borderRadius: 8,
                border: role === 'admin' ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.08)',
                background: role === 'admin' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
                color: role === 'admin' ? '#c7d2fe' : '#94a3b8',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => handleRoleSelect('finance', 'finance@intentlock.io')}
              style={{
                padding: '8px 4px',
                borderRadius: 8,
                border: role === 'finance' ? '1px solid #22d3ee' : '1px solid rgba(255,255,255,0.08)',
                background: role === 'finance' ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.02)',
                color: role === 'finance' ? '#a5f3fc' : '#94a3b8',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Finance Lead
            </button>
            <button
              type="button"
              onClick={() => handleRoleSelect('auditor', 'auditor@intentlock.io')}
              style={{
                padding: '8px 4px',
                borderRadius: 8,
                border: role === 'auditor' ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.08)',
                background: role === 'auditor' ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.02)',
                color: role === 'auditor' ? '#a7f3d0' : '#94a3b8',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Auditor
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label>
            <span>Corporate Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label>
            <span>Password / Security Token</span>
            <input
              type="password"
              defaultValue="••••••••••••"
              required
            />
          </label>

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isLoading}
            className="login-submit"
            icon={<ArrowRight size={16} />}
          >
            Enter Console
          </Button>
        </form>

        <div className="login-foot">
          <ShieldCheck size={13} color="#6ee7b7" />
          <span>Role-Based SOC Access Control Active</span>
        </div>
      </motion.div>
    </div>
  );
};
