import type { ButtonHTMLAttributes } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
}

export function IconButton({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  type = 'button',
  title,
  ...props
}: IconButtonProps) {
  const DisplayIcon = loading ? LoaderCircle : Icon;

  return (
    <button
      type={type}
      className={`ui-icon-button ${variant} ${size} ${className}`.trim()}
      aria-label={label}
      aria-busy={loading || undefined}
      disabled={loading || disabled}
      title={title ?? label}
      {...props}
    >
      <DisplayIcon className={loading ? 'ui-button-spinner' : undefined} size={size === 'sm' ? 15 : 17} aria-hidden="true" />
    </button>
  );
}
