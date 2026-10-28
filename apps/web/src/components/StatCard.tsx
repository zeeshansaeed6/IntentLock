import React from 'react';
import { motion } from 'framer-motion';

export interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  detail: string;
  tone?: 'green' | 'violet' | 'cyan' | 'rose';
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  detail,
  tone = 'cyan',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="stat-card"
    >
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </motion.div>
  );
};
