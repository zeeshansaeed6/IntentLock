import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, Lock, Sparkles, Terminal, Activity, Layers, Scale } from 'lucide-react';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="landing-nav page-width">
        <div className="logo">
          <div className="logo-mark">
            <span />
            <span />
            <span />
          </div>
          <span>
            INTENT<span className="logo-accent">LOCK</span>
          </span>
        </div>

        <div className="nav-meta">
          <span className="status-dot" />
          <span>Airwallex Agentic Banking Hackathon · Track 2</span>
          <button className="login-link" onClick={() => navigate('/login')}>
            Sign In
          </button>
        </div>
      </header>

      <main className="page-width">
        <section className="hero">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="eyebrow"
          >
            <span className="eyebrow-line" />
            <span>AUTONOMOUS PURCHASING · AIRWALLEX ISSUING</span>
            <span className="eyebrow-line" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            Bound Every Purchase to a{' '}
            <span className="gradient-text">Cryptographic Intent</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="hero-copy"
          >
            The LLM proposes; deterministic policy & Airwallex virtual card controls dispose.
            Every transaction is cryptographically locked to the signed merchant, MCC, currency, and financial runway.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="hero-actions"
          >
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/console')}
              icon={<ArrowRight size={18} />}
            >
              Open Command Center
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate('/redteam')}
              icon={<ShieldCheck size={18} />}
            >
              Test Red-Team Lab
            </Button>
          </motion.div>

          <div className="hero-proof">
            <div className="proof-item">
              <ShieldCheck size={14} />
              <span>HMAC-SHA256 Bound Contracts</span>
            </div>
            <div className="proof-item">
              <Activity size={14} />
              <span>Real Airwallex Sandbox Issuing</span>
            </div>
            <div className="proof-item">
              <Layers size={14} />
              <span>3-Layer Enforcement Stack</span>
            </div>
            <div className="proof-item">
              <Scale size={14} />
              <span>12-Week Treasury Cash Runway</span>
            </div>
          </div>
        </section>

        {/* 3-Layer Visual Preview */}
        <section className="layer-visual">
          <div className="visual-caption">
            <span className="live-pulse" />
            <span>REAL-TIME ENFORCEMENT PIPELINE</span>
          </div>

          <div className="layer-grid">
            <div className="layer-card violet">
              <div className="layer-top">
                <div className="layer-icon"><Sparkles /></div>
                <span>LAYER 01</span>
              </div>
              <h3>Typed Proposal</h3>
              <p>Model returns Zod-validated proposal from natural-language intent request.</p>
              <div className="layer-scan">
                <span /> UNTRUSTED DATA WRAPPED
              </div>
            </div>

            <div className="flow-arrow">→</div>

            <div className="layer-card cyan">
              <div className="layer-top">
                <div className="layer-icon"><Scale /></div>
                <span>LAYER 02</span>
              </div>
              <h3>Policy & Treasury Engine</h3>
              <p>Deterministic checks, department budget caps & 12-week runway preservation.</p>
              <div className="layer-scan">
                <span /> HMAC SEAL GENERATED
              </div>
            </div>

            <div className="flow-arrow">→</div>

            <div className="layer-card green">
              <div className="layer-top">
                <div className="layer-icon"><Lock /></div>
                <span>LAYER 03</span>
              </div>
              <h3>Airwallex Card Controls</h3>
              <p>Sandbox virtual card issued with strict merchant, MCC, currency & single-use caps.</p>
              <div className="layer-scan">
                <span /> HARDWARE-LEVEL ENFORCEMENT
              </div>
            </div>
          </div>

          <div className="hero-bottom">
            <div className="bottom-label">
              <span className="grid-mark" />
              <span>AIRWALLEX SANDBOX ISSUING & SIMULATION ENGINE</span>
            </div>
            <span className="mono-label">TRACK 2 · INTENT-BOUND PURCHASE AGENT</span>
          </div>
        </section>
      </main>
    </div>
  );
};
