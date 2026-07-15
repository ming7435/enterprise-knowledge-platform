import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: LucideIcon;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const icon = loading ? (
    <LoaderCircle className="ui-button-spinner" size={16} aria-hidden="true" />
  ) : Icon ? (
    <Icon size={16} aria-hidden="true" />
  ) : null;

  return (
    <button
      type={type}
      className={`ui-button ${variant} ${size} ${className}`.trim()}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {icon}
      <span>{loading ? '处理中' : children}</span>
    </button>
  );
}
