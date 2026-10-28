import React from 'react';
import { CreditCard, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../state/useStore';
import { toggleFreezeCard } from '../lib/api';
import { CardVisual } from '../components/CardVisual';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/Button';

export const CardsPage: React.FC = () => {
  const navigate = useNavigate();
  const cards = useStore((state) => state.cards);
  const loadAll = useStore((state) => state.loadAll);
  const addToast = useStore((state) => state.addToast);

  const handleToggleFreeze = async (cardId: string, currentStatus: string) => {
    try {
      const updated = await toggleFreezeCard(cardId, currentStatus);
      addToast(
        `Card ${updated.lastFour} is now ${updated.status}`,
        updated.status === 'ACTIVE' ? 'green' : 'amber'
      );
      await loadAll();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to update card status', 'rose');
    }
  };

  return (
    <div className="workspace-content">
      <div className="workspace-heading">
        <div>
          <span className="section-kicker">AIRWALLEX ISSUING</span>
          <h1>Virtual Commercial Cards</h1>
          <p>Real-time sandbox virtual cards provisioned exclusively upon cryptographic contract activation.</p>
        </div>
        <div className="workspace-actions">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/console')}
            icon={<Plus size={14} />}
          >
            Issue New Card
          </Button>
        </div>
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon={<CreditCard size={24} />}
          title="No cards issued yet"
          detail="Submit and activate a purchase intent to automatically issue a sandbox card."
          actionLabel="Go to Command Center"
          onAction={() => navigate('/console')}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {cards.map((card) => (
            <CardVisual
              key={card.id}
              id={card.id}
              airwallexCardId={card.airwallexCardId}
              lastFour={card.lastFour}
              limitMinor={card.limitMinor}
              remainingMinor={card.remainingMinor}
              status={card.status}
              isSandbox={card.isSandbox}
              onToggleFreeze={handleToggleFreeze}
            />
          ))}
        </div>
      )}
    </div>
  );
};
