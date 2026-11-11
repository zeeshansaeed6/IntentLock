import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Keyboard, X } from 'lucide-react';
import { useStore } from '../state/useStore';

const GO_TARGETS: Record<string, { path: string; label: string }> = {
  c: { path: '/console', label: 'Command Center' },
  a: { path: '/analytics', label: 'Treasury & Analytics' },
  i: { path: '/intents', label: 'Intents' },
  k: { path: '/cards', label: 'Cards' },
  t: { path: '/transactions', label: 'Transactions' },
  u: { path: '/audit', label: 'Audit Trail' },
  r: { path: '/redteam', label: 'Red-Team Lab' },
  s: { path: '/settings', label: 'Settings' },
};

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

/** Global keyboard shortcuts: `g` then a letter navigates, `/` focuses the intent box, `?` opens help. */
export const Shortcuts: React.FC = () => {
  const navigate = useNavigate();
  const open = useStore((s) => s.shortcutsOpen);
  const setOpen = useStore((s) => s.setShortcutsOpen);

  useEffect(() => {
    let armedUntil = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') return setOpen(false);
      if (isTyping(e.target)) return;
      if (e.key === '?') return setOpen(true);
      if (e.key === '/') {
        e.preventDefault();
        navigate('/console');
        setTimeout(() => document.getElementById('intent-input')?.focus(), 80);
        return;
      }
      if (e.key === 'g') {
        armedUntil = Date.now() + 1200;
        return;
      }
      const target = GO_TARGETS[e.key];
      if (target && Date.now() < armedUntil) {
        armedUntil = 0;
        navigate(target.path);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, setOpen]);

  if (!open) return null;
  const rows: Array<[string, string]> = [
    ['/', 'Focus the intent box'],
    ['?', 'Show this help'],
    ...Object.entries(GO_TARGETS).map(([k, v]) => [`g ${k}`, `Go to ${v.label}`] as [string, string]),
  ];
  return (
    <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={() => setOpen(false)}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(7,11,20,0.7)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(420px,100%)', background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 16, padding: 24, color: '#f8fafc' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Keyboard size={18} color="#818cf8" />
          <h3 style={{ margin: 0, fontSize: 16, flex: 1 }}>Keyboard shortcuts</h3>
          <button aria-label="Close" onClick={() => setOpen(false)} style={{ background: 'none', color: '#94a3b8' }}><X size={16} /></button>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {rows.map(([keys, label]) => (
            <div key={keys} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#cbd5e1' }}>{label}</span>
              <kbd style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>{keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
