import React from 'react';

export interface SkeletonProps {
  type?: 'line' | 'block' | 'card';
  count?: number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  type = 'line',
  count = 1,
  className = '',
}) => {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className={`skeleton-${type} ${className}`.trim()}
        />
      ))}
    </>
  );
};
