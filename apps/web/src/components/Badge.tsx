import React from 'react';

export interface BadgeProps {
  children?: React.ReactNode;
  tone?: 'green' | 'rose' | 'amber' | 'violet' | 'cyan' | 'slate';
  isSandbox?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  tone = 'slate',
  isSandbox = false,
  className = '',
}) => {
  if (isSandbox) {
    return <span className={`sandbox-badge ${className}`}>Sandbox</span>;
  }

  const toneClass = `badge-${tone}`;
  return (
    <span className={`badge ${toneClass} ${className}`.trim()}>
      {children}
    </span>
  );
};
