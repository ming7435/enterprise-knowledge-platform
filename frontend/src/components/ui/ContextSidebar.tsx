import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

const MOBILE_SIDEBAR_QUERY = '(max-width: 760px)';

function useMobileSidebar() {
  const getMatches = () =>
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(MOBILE_SIDEBAR_QUERY).matches;
  const [isMobile, setIsMobile] = useState(getMatches);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia(MOBILE_SIDEBAR_QUERY);
    const handleChange = () => setIsMobile(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}

export interface ContextSidebarItem {
  key: string;
  label: string;
  count?: number;
}

export interface ContextSidebarProps {
  title: string;
  items: ContextSidebarItem[];
  activeKey: string;
  open: boolean;
  onSelect: (key: string) => void;
  onClose: () => void;
}

export function ContextSidebar({ title, items, activeKey, open, onSelect, onClose }: ContextSidebarProps) {
  const isMobile = useMobileSidebar();
  const hiddenOnMobile = isMobile && !open;

  return (
    <aside
      className={`ui-context-sidebar ${open ? 'open' : ''}`}
      aria-label={title}
      aria-hidden={hiddenOnMobile ? true : undefined}
    >
      {hiddenOnMobile ? null : (
        <>
          <div className="ui-context-sidebar-header">
            <h2 title={title}>{title}</h2>
            <IconButton className="ui-context-sidebar-close" icon={X} label="关闭侧栏" size="sm" onClick={onClose} />
          </div>
          <nav className="ui-context-sidebar-list">
            {items.map((item) => {
              const active = item.key === activeKey;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`ui-context-sidebar-item ${active ? 'active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    onSelect(item.key);
                    onClose();
                  }}
                >
                  <span>{item.label}</span>
                  {typeof item.count === 'number' ? <span className="ui-context-sidebar-count">{item.count}</span> : null}
                </button>
              );
            })}
          </nav>
        </>
      )}
    </aside>
  );
}
