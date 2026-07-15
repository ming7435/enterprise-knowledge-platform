import type { ReactNode } from 'react';
import { AlertCircle, FileQuestion, LoaderCircle, ShieldAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from './Button';

export interface AsyncStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
}

interface BaseAsyncStateProps {
  title: string;
  description?: string;
  action?: AsyncStateAction;
  compact?: boolean;
  children?: ReactNode;
}

export interface EmptyStateProps extends BaseAsyncStateProps {
  icon?: LucideIcon;
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = FileQuestion,
  compact = false,
  children,
}: EmptyStateProps) {
  return (
    <div className={`ui-async-state empty ${compact ? 'compact' : ''}`}>
      <div className="ui-async-state-content">
        <span className="ui-async-state-icon"><Icon size={21} aria-hidden="true" /></span>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
        {children}
        {action ? <Button variant="primary" size="sm" icon={action.icon} onClick={action.onClick}>{action.label}</Button> : null}
      </div>
    </div>
  );
}

export interface ErrorStateProps extends BaseAsyncStateProps {
  retryLabel?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = '加载失败',
  description,
  action,
  retryLabel = '重新加载',
  onRetry,
  compact = false,
}: ErrorStateProps) {
  const resolvedAction = action ?? (onRetry ? { label: retryLabel, onClick: onRetry } : undefined);
  return (
    <div className={`ui-async-state error ${compact ? 'compact' : ''}`} role="alert">
      <div className="ui-async-state-content">
        <span className="ui-async-state-icon"><AlertCircle size={21} aria-hidden="true" /></span>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
        {resolvedAction ? <Button size="sm" icon={resolvedAction.icon} onClick={resolvedAction.onClick}>{resolvedAction.label}</Button> : null}
      </div>
    </div>
  );
}

export interface LoadingStateProps {
  label?: string;
  compact?: boolean;
}

export function LoadingState({ label = '正在加载', compact = false }: LoadingStateProps) {
  return (
    <div className={`ui-async-state loading ${compact ? 'compact' : ''}`} role="status" aria-live="polite">
      <div className="ui-async-state-content">
        <span className="ui-async-state-icon"><LoaderCircle className="ui-button-spinner" size={21} aria-hidden="true" /></span>
        <h3>{label}</h3>
        {!compact ? (
          <div className="ui-loading-bars" aria-hidden="true">
            <span className="ui-loading-bar" />
            <span className="ui-loading-bar" />
            <span className="ui-loading-bar" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface PermissionDeniedProps {
  title?: string;
  description?: string;
  action?: AsyncStateAction;
  compact?: boolean;
}

export function PermissionDenied({
  title = '暂无访问权限',
  description = '当前账号没有执行此操作所需的权限，请联系工作区管理员。',
  action,
  compact = false,
}: PermissionDeniedProps) {
  return (
    <div className={`ui-async-state permission ${compact ? 'compact' : ''}`} role="status">
      <div className="ui-async-state-content">
        <span className="ui-async-state-icon"><ShieldAlert size={21} aria-hidden="true" /></span>
        <h3>{title}</h3>
        <p>{description}</p>
        {action ? <Button size="sm" icon={action.icon} onClick={action.onClick}>{action.label}</Button> : null}
      </div>
    </div>
  );
}
