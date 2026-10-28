import React from 'react';

export interface StatusPillProps {
  status: string;
  className?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, className = '' }) => {
  const normalized = status.toLowerCase();
  return (
    <span className={`status-pill ${normalized} ${className}`.trim()}>
      {status}
    </span>
  );
};
