import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Unlock, Copy, Check, ShieldCheck, Zap } from 'lucide-react';
import { formatMoney } from '../lib/formatters';
import { StatusPill } from './StatusPill';
import { Badge } from './Badge';

export interface CardVisualProps {
  id: string;
  airwallexCardId?: string;
  lastFour: string;
  limitMinor: number;
  remainingMinor: number;
  status: 'ACTIVE' | 'FROZEN' | 'CANCELLED';
  isSandbox?: boolean;
  expiresAt?: string;
  onToggleFreeze: (cardId: string, currentStatus: string) => Promise<void>;
}

export const CardVisual: React.FC<CardVisualProps> = ({
  id,
  airwallexCardId,
  lastFour,
  limitMinor,
  remainingMinor,
  status,
  isSandbox = false,
  expiresAt,
  onToggleFreeze,
}) => {
  const [copied, setCopied] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const spentMinor = Math.max(0, limitMinor - remainingMinor);
  const spentPercent = limitMinor > 0 ? Math.min(100, Math.round((spentMinor / limitMinor) * 100)) : 0;
  const remainingPercent = 100 - spentPercent;

  // Limit ring calculations (radius 28, perimeter 2 * pi * 28 ~ 175.93)
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (remainingPercent / 100) * circumference;

  const handleCopy = () => {
    const textToCopy = airwallexCardId || id;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFreezeClick = async () => {
    setIsUpdating(true);
    try {
      await onToggleFreeze(id, status);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`virtual-card-container ${status === 'FROZEN' ? 'is-frozen' : ''}`}
      style={{
        position: 'relative',
        borderRadius: 16,
        padding: 22,
        background: status === 'FROZEN'
          ? 'linear-gradient(135deg, #1e1b2e 0%, #0d1222 100%)'
          : 'linear-gradient(135deg, #131d47 0%, #0a3350 50%, #071e2e 100%)',
        border: '1px solid rgba(125, 211, 252, 0.22)',
        boxShadow: status === 'FROZEN'
          ? '0 18px 45px rgba(0,0,0,0.4), inset 0 1px rgba(255,255,255,0.06)'
          : '0 20px 50px rgba(7, 30, 46, 0.5), inset 0 1px rgba(255,255,255,0.15)',
        color: '#e2f4ff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 220,
      }}
    >
      {/* Top row: Brand & Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 2px 8px rgba(6,182,212,0.3)',
            }}
          >
            <ShieldCheck size={16} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, letterSpacing: -0.5, fontSize: 13, textTransform: 'uppercase' }}>
            Intent<span style={{ color: '#67e8f9' }}>Lock</span>
          </span>
          {isSandbox && <Badge isSandbox />}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusPill status={status} />
        </div>
      </div>

      {/* Center row: Masked PAN & Limit ring */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 16px' }}>
        <div>
          <div style={{ fontSize: 10, color: '#7ea5c7', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
            Virtual Commercial Card
          </div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 19, letterSpacing: 2, fontWeight: 600 }}>
            •••• •••• •••• {lastFour}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 10, color: '#90b4d4' }}>
            <span>ID: {airwallexCardId ? airwallexCardId.slice(0, 18) + '…' : id.slice(0, 16)}</span>
            <button
              onClick={handleCopy}
              style={{ background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer', padding: 0 }}
              title="Copy Card ID"
            >
              {copied ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
            </button>
          </div>
        </div>

        {/* Limit radial ring */}
        <div style={{ position: 'relative', width: 64, height: 64, display: 'grid', placeItems: 'center' }}>
          <svg width={64} height={64} style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx={32}
              cy={32}
              r={radius}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={4.5}
              fill="transparent"
            />
            <circle
              cx={32}
              cy={32}
              r={radius}
              stroke={status === 'FROZEN' ? '#f43f5e' : '#22d3ee'}
              strokeWidth={4.5}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', textAlign: 'center' }}>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700 }}>
              {remainingPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Bottom row: Spending balance, countdown & Freeze action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
        <div>
          <div style={{ fontSize: 9, color: '#7ea5c7', letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Available / Bound Limit
          </div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, marginTop: 2 }}>
            <span style={{ color: status === 'FROZEN' ? '#fda4af' : '#67e8f9' }}>{formatMoney(remainingMinor)}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', margin: '0 4px' }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>{formatMoney(limitMinor)}</span>
          </div>
        </div>

        <button
          onClick={handleFreezeClick}
          disabled={isUpdating}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 7,
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer',
            border: status === 'ACTIVE' ? '1px solid rgba(244,63,94,0.3)' : '1px solid rgba(52,211,153,0.3)',
            background: status === 'ACTIVE' ? 'rgba(244,63,94,0.12)' : 'rgba(52,211,153,0.12)',
            color: status === 'ACTIVE' ? '#fda4af' : '#6ee7b7',
            transition: 'all 0.2s',
          }}
        >
          {status === 'ACTIVE' ? <Lock size={12} /> : <Unlock size={12} />}
          <span>{isUpdating ? 'Updating…' : status === 'ACTIVE' ? 'Freeze Card' : 'Unfreeze'}</span>
        </button>
      </div>
    </motion.div>
  );
};
