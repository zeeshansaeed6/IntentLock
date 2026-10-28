import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Sparkles, X } from 'lucide-react';
import { useStore, type Toast as ToastType } from '../state/useStore';

export const ToastContainer: React.FC = () => {
  const toasts = useStore((state) => state.toasts);
  const removeToast = useStore((state) => state.removeToast);

  return (
    <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
      <AnimatePresence>
        {toasts.map((toast: ToastType) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{ pointerEvents: 'auto' }}
            className={`toast toast-${toast.tone}`}
          >
            {toast.tone === 'green' && <CheckCircle2 size={16} />}
            {toast.tone === 'rose' && <XCircle size={16} />}
            {toast.tone === 'amber' && <AlertTriangle size={16} />}
            {toast.tone === 'violet' && <Sparkles size={16} />}
            <span style={{ fontSize: 12, fontWeight: 500 }}>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{ background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer', padding: 2, display: 'grid', placeItems: 'center', opacity: 0.7 }}
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
