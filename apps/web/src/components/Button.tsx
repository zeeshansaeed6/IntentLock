import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-semibold transition-all duration-200 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500/50';

  let variantStyle = 'primary-button';
  if (variant === 'secondary') variantStyle = 'secondary-button';
  if (variant === 'danger') variantStyle = 'danger-button';
  if (variant === 'ghost') variantStyle = 'ghost-button';

  let sizeStyle = '';
  if (size === 'sm') sizeStyle = 'small';
  if (size === 'lg') sizeStyle = 'large';

  return (
    <button
      className={`${variantStyle} ${sizeStyle} ${className}`.trim()}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={size === 'sm' ? 14 : 16} />
      ) : icon ? (
        <span className="button-icon">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
};
