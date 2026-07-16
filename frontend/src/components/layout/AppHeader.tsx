import { ArrowLeftRight, LogOut, Menu, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import type { User, Workspace } from '../../types';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';

export interface AppHeaderProps {
  user: User;
  workspace: Workspace;
  activePage: string;
  items: Array<{ key: string; label: string; icon: LucideIcon }>;
  onNavigate: (key: string) => void;
  onSwitchWorkspace: () => void;
  onLogout: () => void;
}

export function AppHeader({
  user,
  workspace,
  activePage,
  items,
  onNavigate,
  onSwitchWorkspace,
  onLogout,
}: AppHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuId = useId();
  const mobileMenuToggleId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const workspaceTypeLabel = workspace.type === 'enterprise' ? '企业工作区' : '个人工作区';

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activePage, workspace.id]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setMobileMenuOpen(false);
      window.requestAnimationFrame(() => {
        document.getElementById(mobileMenuToggleId)?.focus({ preventScroll: true });
      });
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [mobileMenuOpen, mobileMenuToggleId]);

  function navigate(key: string) {
    onNavigate(key);
    setMobileMenuOpen(false);
  }

  return (
    <header ref={headerRef} className={`app-header ${mobileMenuOpen ? 'mobile-menu-open' : ''}`}>
      <div className="app-header-primary">
        <button className="app-header-brand" type="button" aria-label="返回工作台" onClick={() => navigate('dashboard')}>
          <img src="/qizhiyun-logo.png" alt="" aria-hidden="true" />
          <span className="app-header-brand-copy">
            <strong>企知云</strong>
            <small>企业知识平台</small>
          </span>
        </button>

        <div className="app-header-divider" aria-hidden="true" />
        <div className="app-header-workspace" title={workspace.name}>
          <span>{workspaceTypeLabel}</span>
          <strong>{workspace.name}</strong>
        </div>

        <nav className="app-header-nav" aria-label="工作区导航">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.key === activePage;
            return (
              <button
                key={item.key}
                type="button"
                className={active ? 'active' : ''}
                aria-current={active ? 'page' : undefined}
                onClick={() => navigate(item.key)}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="app-header-actions">
          <div className="app-header-user" title={user.email}>
            <span>{user.username.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{user.username}</strong>
              <small>{user.email}</small>
            </div>
          </div>
          <Button aria-label="切换工作区" variant="ghost" size="sm" icon={ArrowLeftRight} onClick={onSwitchWorkspace}>
            切换工作区
          </Button>
          <Button aria-label="退出登录" variant="ghost" size="sm" icon={LogOut} onClick={onLogout}>
            退出
          </Button>
        </div>

        <IconButton
          id={mobileMenuToggleId}
          icon={mobileMenuOpen ? X : Menu}
          label={mobileMenuOpen ? '关闭导航菜单' : '打开导航菜单'}
          variant="secondary"
          size="sm"
          className="app-header-menu-toggle"
          aria-expanded={mobileMenuOpen}
          aria-controls={mobileMenuId}
          onClick={() => setMobileMenuOpen((open) => !open)}
        />
      </div>

      <div id={mobileMenuId} className="app-header-mobile-menu" hidden={!mobileMenuOpen}>
        <nav aria-label="移动端工作区导航">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.key === activePage;
            return (
              <button
                key={item.key}
                type="button"
                className={active ? 'active' : ''}
                aria-current={active ? 'page' : undefined}
                onClick={() => navigate(item.key)}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="app-header-mobile-account">
          <div>
            <strong>{user.username}</strong>
            <small>{user.email}</small>
          </div>
          <Button aria-label="切换工作区" variant="secondary" size="sm" icon={ArrowLeftRight} onClick={onSwitchWorkspace}>
            切换工作区
          </Button>
          <Button aria-label="退出登录" variant="ghost" size="sm" icon={LogOut} onClick={onLogout}>
            退出登录
          </Button>
        </div>
      </div>
    </header>
  );
}
