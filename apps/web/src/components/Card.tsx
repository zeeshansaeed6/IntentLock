import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

export interface CardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  glow?: 'violet' | 'cyan' | 'green' | 'rose' | 'none';
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  glow = 'none',
  className = '',
  ...props
}) => {
  const glowClass = glow !== 'none' ? `glow-${glow}` : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`glass-card ${glowClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </motion.div>
  );
};
