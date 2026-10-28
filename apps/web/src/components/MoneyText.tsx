import React from 'react';
import { formatMoney } from '../lib/formatters';

export interface MoneyTextProps {
  amountMinor: number;
  currency?: string;
  tone?: 'default' | 'green' | 'rose' | 'amber' | 'cyan';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const MoneyText: React.FC<MoneyTextProps> = ({
  amountMinor,
  currency = 'USD',
  tone = 'default',
  size = 'md',
  className = '',
}) => {
  const formatted = formatMoney(amountMinor, currency);

  let toneClass = '';
  if (tone === 'green') toneClass = 'green-text';
  if (tone === 'rose') toneClass = 'rose-text';
  if (tone === 'amber') toneClass = 'amber-text';
  if (tone === 'cyan') toneClass = 'cyan-text';

  let sizeStyle: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };
  if (size === 'sm') sizeStyle.fontSize = '11px';
  if (size === 'md') sizeStyle.fontSize = '14px';
  if (size === 'lg') sizeStyle.fontSize = '20px';
  if (size === 'xl') sizeStyle.fontSize = '28px';

  return (
    <strong
      style={sizeStyle}
      className={`font-mono ${toneClass} ${className}`.trim()}
    >
      {formatted}
    </strong>
  );
};
