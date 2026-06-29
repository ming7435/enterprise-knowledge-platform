import {
  ArrowLeftRight,
  Bot,
  Building2,
  FileText,
  Home,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
  Workflow
} from 'lucide-react';
import { useState } from 'react';

import type { User, Workspace } from '../types';

interface WorkspaceShellProps {
  user: User;
  workspace: Workspace;
  onBackToWorkspaces: () => void;
  onLogout: () => void;
}

type PageKey =
  | 'dashboard'
  | 'documents'
  | 'knowledge'
  | 'chat'
  | 'settings'
  | 'members'
  | 'audit';

const baseNav: Array<{ key: PageKey; label: string; icon: typeof Home }> = [
  { key: 'dashboard', label: '首页', icon: Home },
  { key: 'documents', label: '文档', icon: FileText },
  { key: 'knowledge', label: '知识库', icon: Workflow },
  { key: 'chat', label: '问答', icon: Bot },
  { key: 'settings', label: '设置', icon: Settings }
];

const enterpriseNav: Array<{ key: PageKey; label: string; icon: typeof Home }> = [
  { key: 'members', label: '成员', icon: Users },
  { key: 'audit', label: '审计日志', icon: ShieldCheck }
];

export function WorkspaceShell({
  user,
  workspace,
  onBackToWorkspaces,
  onLogout
}: WorkspaceShellProps) {
  const [activePage, setActivePage] = useState<PageKey>('dashboard');
  const navItems =
    workspace.type === 'enterprise' ? [...baseNav, ...enterpriseNav] : baseNav;
  const currentNav = navItems.find((item) => item.key === activePage) ?? navItems[0];
  const workspaceLabel = workspace.type === 'enterprise' ? '企业工作区' : '个人工作区';

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <Building2 size={24} aria-hidden="true" />
          <div>
            <strong>企业知识平台</strong>
            <span>{workspace.type === 'enterprise' ? '企业空间' : '个人空间'}</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="工作区导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={item.key === activePage ? 'active' : ''}
                onClick={() => setActivePage(item.key)}
              >
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="workbench">
        <header className="workbench-header">
          <div>
            <p className="eyebrow">{workspaceLabel}</p>
            <h1>{workspace.name}</h1>
            <span>{user.email}</span>
          </div>
          <div className="header-actions">
            <button className="ghost-button" onClick={onBackToWorkspaces}>
              <ArrowLeftRight size={18} aria-hidden="true" />
              切换工作区
            </button>
            <button className="ghost-button" onClick={onLogout}>
              <LogOut size={18} aria-hidden="true" />
              退出登录
            </button>
          </div>
        </header>

        <section className="content-panel">
          <p className="eyebrow">{currentNav.label}</p>
          <h2>{pageTitle(activePage, workspace.type)}</h2>
          <p>{pageDescription(activePage, workspace.type)}</p>
          <div className="metric-grid">
            <div>
              <span>工作区 ID</span>
              <strong>{workspace.id}</strong>
            </div>
            <div>
              <span>角色</span>
              <strong>{workspace.role || 'member'}</strong>
            </div>
            <div>
              <span>隔离字段</span>
              <strong>workspace_id</strong>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function pageTitle(page: PageKey, type: Workspace['type']) {
  const map: Record<PageKey, string> = {
    dashboard: type === 'enterprise' ? '企业首页' : '个人首页',
    documents: type === 'enterprise' ? '企业文档' : '个人文档',
    knowledge: type === 'enterprise' ? '企业知识库' : '个人知识库',
    chat: type === 'enterprise' ? '企业智能问答' : '个人智能问答',
    settings: type === 'enterprise' ? '企业设置' : '个人设置',
    members: '企业用户权限',
    audit: '企业操作记录'
  };
  return map[page];
}

function pageDescription(page: PageKey, type: Workspace['type']) {
  const shared: Record<PageKey, string> = {
    dashboard: '展示文档数量、知识片段、向量库状态、最近问答和最近操作。',
    documents: 'V1 提供文档模块入口，V2 接入上传、解析、切片和入库流程。',
    knowledge: 'V1 保留知识库状态与配置入口，V2 接入 FAISS 或 Chroma。',
    chat: 'V1 保留会话入口，V3 接入普通对话、RAG 问答和来源追溯。',
    settings: '管理模型、向量库、Webhook、存储等工作区级配置。',
    members: 'V4 将实现邀请成员、移除成员、角色权限和文档权限。',
    audit: '记录登录、文档、知识库、问答、工具、设置和权限操作。'
  };
  if (type === 'personal' && (page === 'members' || page === 'audit')) {
    return '个人工作区不展示企业协作入口。';
  }
  return shared[page];
}
