import React from 'react';
import { motion } from 'framer-motion';

export interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  detail: string;
  tone?: 'green' | 'violet' | 'cyan' | 'rose' | 'amber';
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
      whileHover={{ y: -2 }}
      className="stat-card group transition-all duration-200 hover:border-white/20"
      style={{
        background: 'linear-gradient(145deg, rgba(21, 21, 23, 0.9), rgba(16, 16, 19, 0.96))',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className={`stat-icon ${tone} dashboard-icon-badge`}>
          {icon}
        </div>
        <span style={{ fontSize: 9, fontFamily: 'DM Mono', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.8 }}>
          LIVE METER
        </span>
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </motion.div>
  );
};
