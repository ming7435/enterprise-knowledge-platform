import {
  ArrowLeftRight,
  Bot,
  Building2,
  Database,
  FileText,
  Home,
  LogOut,
  RefreshCw,
  Settings,
  ShieldCheck,
  Upload,
  Users,
  Workflow
} from 'lucide-react';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';

import { api } from '../api';
import type { DocumentRecord, KnowledgeBaseStatus, User, Workspace } from '../types';

interface WorkspaceShellProps {
  token: string;
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
  token,
  user,
  workspace,
  onBackToWorkspaces,
  onLogout
}: WorkspaceShellProps) {
  const [activePage, setActivePage] = useState<PageKey>('dashboard');
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseStatus | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);

  const navItems =
    workspace.type === 'enterprise' ? [...baseNav, ...enterpriseNav] : baseNav;
  const currentNav = navItems.find((item) => item.key === activePage) ?? navItems[0];
  const workspaceLabel = workspace.type === 'enterprise' ? '企业工作区' : '个人工作区';
  const latestDocuments = useMemo(() => documents.slice(0, 3), [documents]);

  useEffect(() => {
    setDocuments([]);
    setKnowledgeBase(null);
    setSelectedFile(null);
    setModuleError(null);
    setActivePage('dashboard');
  }, [workspace.id]);

  useEffect(() => {
    if (activePage === 'documents' || activePage === 'knowledge' || activePage === 'dashboard') {
      void loadWorkspaceModules();
    }
  }, [activePage, workspace.id]);

  async function loadWorkspaceModules() {
    try {
      setModuleLoading(true);
      setModuleError(null);
      const [nextDocuments, nextKnowledgeBase] = await Promise.all([
        api.documents(token, workspace.id),
        api.knowledgeBase(token, workspace.id)
      ]);
      setDocuments(nextDocuments);
      setKnowledgeBase(nextKnowledgeBase);
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '模块数据加载失败');
    } finally {
      setModuleLoading(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    try {
      setUploading(true);
      setModuleError(null);
      await api.uploadDocument(token, workspace.id, selectedFile);
      setSelectedFile(null);
      await loadWorkspaceModules();
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '文档上传失败');
    } finally {
      setUploading(false);
    }
  }

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

        {activePage === 'documents' ? (
          <DocumentsPanel
            documents={documents}
            currentNavLabel={currentNav.label}
            loading={moduleLoading}
            uploading={uploading}
            selectedFile={selectedFile}
            error={moduleError}
            onFileChange={handleFileChange}
            onUpload={handleUpload}
            onRefresh={loadWorkspaceModules}
          />
        ) : activePage === 'knowledge' ? (
          <KnowledgePanel
            currentNavLabel={currentNav.label}
            knowledgeBase={knowledgeBase}
            documents={documents}
            loading={moduleLoading}
            error={moduleError}
            onRefresh={loadWorkspaceModules}
          />
        ) : (
          <DefaultPanel
            activePage={activePage}
            workspace={workspace}
            currentNavLabel={currentNav.label}
            knowledgeBase={knowledgeBase}
            latestDocuments={latestDocuments}
          />
        )}
      </section>
    </main>
  );
}

function DocumentsPanel({
  documents,
  currentNavLabel,
  loading,
  uploading,
  selectedFile,
  error,
  onFileChange,
  onUpload,
  onRefresh
}: {
  documents: DocumentRecord[];
  currentNavLabel: string;
  loading: boolean;
  uploading: boolean;
  selectedFile: File | null;
  error: string | null;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onRefresh: () => void;
}) {
  return (
    <section className="content-panel module-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{currentNavLabel}</p>
          <h2>文档管理</h2>
          <p>文档上传后会进入当前工作区，后续版本继续解析、切片和向量化。</p>
        </div>
        <button className="ghost-button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={18} aria-hidden="true" />
          刷新
        </button>
      </div>

      <div className="upload-card">
        <div className="upload-copy">
          <Upload size={24} aria-hidden="true" />
          <div>
            <strong>{selectedFile ? selectedFile.name : '选择要上传的文档'}</strong>
            <span>{selectedFile ? formatFileSize(selectedFile.size) : '支持常见办公文档和文本文件'}</span>
          </div>
        </div>
        <div className="upload-actions">
          <label className="file-picker">
            选择文件
            <input
              type="file"
              onChange={onFileChange}
              accept=".txt,.md,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv"
            />
          </label>
          <button
            className="primary-action compact-action"
            type="button"
            disabled={!selectedFile || uploading}
            onClick={onUpload}
          >
            <Upload size={18} aria-hidden="true" />
            {uploading ? '上传中' : '上传'}
          </button>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="document-table">
        <div className="table-head">
          <span>文件名</span>
          <span>类型</span>
          <span>解析</span>
          <span>入库</span>
          <span>上传时间</span>
        </div>
        {documents.length === 0 ? (
          <div className="empty-row">当前工作区还没有文档。</div>
        ) : (
          documents.map((document) => (
            <div className="table-row" key={document.id}>
              <span className="file-name">{document.filename}</span>
              <span>{document.file_type}</span>
              <StatusBadge value={document.parse_status} kind="parse" />
              <StatusBadge value={document.index_status} kind="index" />
              <span>{formatDate(document.created_at)}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function KnowledgePanel({
  currentNavLabel,
  knowledgeBase,
  documents,
  loading,
  error,
  onRefresh
}: {
  currentNavLabel: string;
  knowledgeBase: KnowledgeBaseStatus | null;
  documents: DocumentRecord[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <section className="content-panel module-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{currentNavLabel}</p>
          <h2>知识库状态</h2>
          <p>V2.1 展示文档级状态，解析、切片和 Milvus 入库会在后续阶段接入。</p>
        </div>
        <button className="ghost-button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={18} aria-hidden="true" />
          刷新
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="knowledge-grid">
        <MetricCard
          label="知识库状态"
          value={statusText(knowledgeBase?.status ?? 'empty')}
          icon={Database}
        />
        <MetricCard
          label="文档数量"
          value={String(knowledgeBase?.document_count ?? documents.length)}
          icon={FileText}
        />
        <MetricCard
          label="知识片段"
          value={String(knowledgeBase?.chunk_count ?? 0)}
          icon={Workflow}
        />
      </div>

      <div className="document-table compact-table">
        <div className="table-head">
          <span>最近文档</span>
          <span>解析</span>
          <span>入库</span>
        </div>
        {documents.length === 0 ? (
          <div className="empty-row">上传文档后这里会显示知识库来源。</div>
        ) : (
          documents.slice(0, 5).map((document) => (
            <div className="table-row compact-row" key={document.id}>
              <span className="file-name">{document.filename}</span>
              <StatusBadge value={document.parse_status} kind="parse" />
              <StatusBadge value={document.index_status} kind="index" />
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function DefaultPanel({
  activePage,
  workspace,
  currentNavLabel,
  knowledgeBase,
  latestDocuments
}: {
  activePage: PageKey;
  workspace: Workspace;
  currentNavLabel: string;
  knowledgeBase: KnowledgeBaseStatus | null;
  latestDocuments: DocumentRecord[];
}) {
  return (
    <section className="content-panel">
      <p className="eyebrow">{currentNavLabel}</p>
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
          <span>文档数量</span>
          <strong>{knowledgeBase?.document_count ?? latestDocuments.length}</strong>
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string;
  icon: typeof Home;
}) {
  return (
    <div className="knowledge-card">
      <Icon size={22} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

type StatusBadgeKind = 'default' | 'parse' | 'index';

function StatusBadge({ value, kind = 'default' }: { value: string; kind?: StatusBadgeKind }) {
  return <span className={`status-badge ${value}`}>{statusText(value, kind)}</span>;
}

function statusText(value: string, kind: StatusBadgeKind = 'default') {
  const maps: Record<StatusBadgeKind, Record<string, string>> = {
    default: {
      empty: '空',
      documents_uploaded: '已上传文档',
      uploaded: '已上传',
      pending: '待处理',
      parsing: '解析中',
      parsed: '已解析',
      indexing: '入库中',
      indexed: '已入库',
      failed: '失败'
    },
    parse: {
      uploaded: '已上传',
      pending: '待解析',
      parsing: '解析中',
      parsed: '已解析',
      failed: '解析失败'
    },
    index: {
      pending: '待入库',
      indexing: '入库中',
      indexed: '已入库',
      failed: '入库失败'
    }
  };
  return maps[kind][value] ?? maps.default[value] ?? value;
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
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
    documents: '上传、查看和管理当前工作区内的知识文档。',
    knowledge: '查看知识库状态、文档来源和后续入库进度。',
    chat: 'V3 接入普通对话、RAG 问答和来源追溯。',
    settings: '管理模型、向量库、Webhook、存储等工作区级配置。',
    members: 'V4 将实现邀请成员、移除成员、角色权限和文档权限。',
    audit: '记录登录、文档、知识库、问答、工具、设置和权限操作。'
  };
  if (type === 'personal' && (page === 'members' || page === 'audit')) {
    return '个人工作区不展示企业协作入口。';
  }
  return shared[page];
}
