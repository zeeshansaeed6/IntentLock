import React from 'react';
import { motion } from 'framer-motion';

export interface TimelineStep {
  id: string;
  title: string;
  detail: string;
  tone?: 'green' | 'rose' | 'amber' | 'violet' | 'slate';
  badge?: string;
}

export interface TimelineProps {
  steps: TimelineStep[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ steps, className = '' }) => {
  return (
    <div className={`step-list ${className}`.trim()}>
      {steps.map((step, idx) => (
        <motion.div
          key={step.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, delay: idx * 0.05 }}
          className="reason-step"
        >
          <div className={`step-node ${step.tone || 'violet'}`}>{idx + 1}</div>
          <div className="step-copy">
            <strong>{step.title}</strong>
            <span>{step.detail}</span>
          </div>
          {step.badge && (
            <span className="passed-badge">
              <span>●</span> {step.badge}
            </span>
          )}
        </motion.div>
      ))}
    </div>
  );
};
