import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  status?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, eyebrow, status, actions, className = '' }: PageHeaderProps) {
  return (
    <header className={`ui-page-header ${className}`.trim()}>
      <div className="ui-page-header-copy">
        {eyebrow ? <span className="ui-page-header-eyebrow">{eyebrow}</span> : null}
        <div className="ui-page-header-title-row">
          <h1>{title}</h1>
          {status}
        </div>
        {description ? <p className="ui-page-header-description">{description}</p> : null}
      </div>
      {actions ? <div className="ui-page-header-actions">{actions}</div> : null}
    </header>
  );
}
