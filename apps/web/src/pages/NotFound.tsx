import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#070b14' }}>
      <EmptyState icon={<Compass size={24} />} title="Page not found" detail="That route doesn't exist. Head back to the console." actionLabel="Open Console" onAction={() => navigate('/console')} />
    </div>
  );
};
