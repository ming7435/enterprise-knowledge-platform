import { useEffect, useRef } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

export interface ToastRegionProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const TOAST_ICONS: Record<ToastType, LucideIcon> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

function ToastCard({ toast, onDismiss }: ToastCardProps) {
  const Icon = TOAST_ICONS[toast.type];
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const duration = toast.duration ?? 4500;
    if (duration <= 0) return undefined;
    const timer = window.setTimeout(() => onDismissRef.current(toast.id), duration);
    return () => window.clearTimeout(timer);
  }, [toast.duration, toast.id]);

  return (
    <article className={`ui-toast ${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
      <Icon size={20} aria-hidden="true" />
      <div className="ui-toast-copy">
        <strong>{toast.title}</strong>
        {toast.description ? <span>{toast.description}</span> : null}
      </div>
      <button type="button" className="ui-toast-close" aria-label="关闭通知" onClick={() => onDismiss(toast.id)}>
        <X size={15} aria-hidden="true" />
      </button>
    </article>
  );
}

export function ToastRegion({ toasts, onDismiss }: ToastRegionProps) {
  if (toasts.length === 0) return null;
  return (
    <section className="ui-toast-region" aria-label="系统通知" aria-live="polite">
      {toasts.map((toast) => <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />)}
    </section>
  );
}
