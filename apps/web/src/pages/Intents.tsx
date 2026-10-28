import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Plus } from 'lucide-react';
import { useStore } from '../state/useStore';
import { approveIntentApi } from '../lib/api';
import { ContractViewer } from '../components/ContractViewer';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/Button';
import { useNavigate } from 'react-router-dom';

export const IntentsPage: React.FC = () => {
  const navigate = useNavigate();
  const intents = useStore((state) => state.intents);
  const loadAll = useStore((state) => state.loadAll);
  const addToast = useStore((state) => state.addToast);

  const handleApprove = async (intentId: string, signature: string) => {
    try {
      await approveIntentApi(intentId, signature);
      addToast('Contract approved and sandbox virtual card issued', 'green');
      await loadAll();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Approval failed', 'rose');
    }
  };

  return (
    <div className="workspace-content">
      <div className="workspace-heading">
        <div>
          <span className="section-kicker">GOVERNANCE & POLICY</span>
          <h1>Cryptographic Purchase Intents</h1>
          <p>Deterministic contracts signed with HMAC-SHA256, binding autonomous purchasing to immutable limits.</p>
        </div>
        <div className="workspace-actions">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/console')}
            icon={<Plus size={14} />}
          >
            New Intent
          </Button>
        </div>
      </div>

      {intents.length === 0 ? (
        <EmptyState
          icon={<FileText size={24} />}
          title="No intent contracts yet"
          detail="Submit a purchase request from the Command Center to generate a cryptographic intent contract."
          actionLabel="Create Intent"
          onAction={() => navigate('/console')}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {intents.map((item) => (
            <motion.div
              key={item.contract.intent_id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <ContractViewer
                contract={item.contract}
                onApprove={handleApprove}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
