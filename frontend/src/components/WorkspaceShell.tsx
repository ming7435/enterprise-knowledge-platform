import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Bot,
  Database,
  FileText,
  Home,
  LogOut,
  Network,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wrench,
  Workflow
} from 'lucide-react';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';

import { api } from '../api';
import type {
  AdvancedNotification,
  AdvancedOverview,
  AuditLogRecord,
  ChatAskResponse,
  DeploymentStatus,
  DocumentRecord,
  KnowledgeGraph,
  KnowledgeBaseStatus,
  KnowledgeChunk,
  ToolStatus,
  User,
  Workspace,
  WorkspaceMember,
  WorkspaceRole
} from '../types';

interface ChatMessageView {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: KnowledgeChunk[];
  modelName?: string;
}

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
  | 'advanced'
  | 'members'
  | 'audit';

const baseNav: Array<{ key: PageKey; label: string; icon: typeof Home }> = [
  { key: 'dashboard', label: '首页', icon: Home },
  { key: 'documents', label: '文档', icon: FileText },
  { key: 'knowledge', label: '知识库', icon: Workflow },
  { key: 'chat', label: '问答', icon: Bot },
  { key: 'settings', label: '设置', icon: Settings },
  { key: 'advanced', label: '高级', icon: BarChart3 }
];

const enterpriseNav: Array<{ key: PageKey; label: string; icon: typeof Home }> = [
  { key: 'members', label: '成员', icon: Users },
  { key: 'audit', label: '审计日志', icon: ShieldCheck }
];

const memberRoleOptions: Array<{ value: WorkspaceRole; label: string }> = [
  { value: 'admin', label: '管理员' },
  { value: 'member', label: '成员' },
  { value: 'viewer', label: '只读' }
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
  const [knowledgeChunks, setKnowledgeChunks] = useState<KnowledgeChunk[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [advancedOverview, setAdvancedOverview] = useState<AdvancedOverview | null>(null);
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraph | null>(null);
  const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([]);
  const [advancedNotifications, setAdvancedNotifications] = useState<AdvancedNotification[]>([]);
  const [deploymentStatuses, setDeploymentStatuses] = useState<DeploymentStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeChunk[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberDepartment, setMemberDepartment] = useState('');
  const [memberRole, setMemberRole] = useState<WorkspaceRole>('member');
  const [moduleLoading, setModuleLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [memberSaving, setMemberSaving] = useState(false);
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageView[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);
  const [moduleError, setModuleError] = useState<string | null>(null);

  const navItems =
    workspace.type === 'enterprise' ? [...baseNav, ...enterpriseNav] : baseNav;
  const currentNav = navItems.find((item) => item.key === activePage) ?? navItems[0];
  const workspaceLabel = workspace.type === 'enterprise' ? '企业工作区' : '个人工作区';
  const latestDocuments = useMemo(() => documents.slice(0, 3), [documents]);
  const canManageMembers = workspace.role === 'owner' || workspace.role === 'admin';

  useEffect(() => {
    setDocuments([]);
    setKnowledgeBase(null);
    setKnowledgeChunks([]);
    setMembers([]);
    setAuditLogs([]);
    setAdvancedOverview(null);
    setKnowledgeGraph(null);
    setToolStatuses([]);
    setAdvancedNotifications([]);
    setDeploymentStatuses([]);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedFile(null);
    setMemberEmail('');
    setMemberDepartment('');
    setMemberRole('member');
    setChatQuestion('');
    setChatSessionId(null);
    setChatMessages([]);
    setChatLoading(false);
    setDeletingDocumentId(null);
    setMemberActionId(null);
    setModuleError(null);
    setActivePage('dashboard');
  }, [workspace.id]);

  useEffect(() => {
    if (activePage === 'documents' || activePage === 'knowledge' || activePage === 'dashboard') {
      void loadWorkspaceModules();
    }
  }, [activePage, workspace.id]);

  useEffect(() => {
    if (activePage === 'members') {
      void loadMembers();
    }
    if (activePage === 'audit') {
      void loadAuditLogs();
    }
  }, [activePage, workspace.id]);

  useEffect(() => {
    if (activePage === 'advanced') {
      void loadAdvancedDashboard();
    }
  }, [activePage, workspace.id]);

  async function loadWorkspaceModules() {
    try {
      setModuleLoading(true);
      setModuleError(null);
      const [nextDocuments, nextKnowledgeBase, nextChunks] = await Promise.all([
        api.documents(token, workspace.id),
        api.knowledgeBase(token, workspace.id),
        api.knowledgeChunks(token, workspace.id, 8)
      ]);
      setDocuments(nextDocuments);
      setKnowledgeBase(nextKnowledgeBase);
      setKnowledgeChunks(nextChunks);
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

  async function handleDeleteDocument(document: DocumentRecord) {
    const confirmed = window.confirm(`确认删除“${document.filename}”吗？对应知识片段也会同步移除。`);
    if (!confirmed) return;
    try {
      setDeletingDocumentId(document.id);
      setModuleError(null);
      await api.deleteDocument(token, workspace.id, document.id);
      setSearchResults([]);
      await loadWorkspaceModules();
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '文档删除失败');
    } finally {
      setDeletingDocumentId(null);
    }
  }

  async function handleSearch() {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    try {
      setSearching(true);
      setModuleError(null);
      const results = await api.searchKnowledge(token, workspace.id, query);
      setSearchResults(results);
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '知识库检索失败');
    } finally {
      setSearching(false);
    }
  }

  function handleClearSearch() {
    setSearchQuery('');
    setSearchResults([]);
  }

  async function loadMembers() {
    try {
      setModuleLoading(true);
      setModuleError(null);
      const nextMembers = await api.workspaceMembers(token, workspace.id);
      setMembers(nextMembers);
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '成员数据加载失败');
    } finally {
      setModuleLoading(false);
    }
  }

  async function loadAuditLogs() {
    try {
      setModuleLoading(true);
      setModuleError(null);
      const nextLogs = await api.auditLogs(token, workspace.id);
      setAuditLogs(nextLogs);
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '审计日志加载失败');
    } finally {
      setModuleLoading(false);
    }
  }

  async function loadAdvancedDashboard() {
    try {
      setModuleLoading(true);
      setModuleError(null);
      const [overview, graph, tools, notifications, deployment] = await Promise.all([
        api.advancedOverview(token, workspace.id),
        api.knowledgeGraph(token, workspace.id),
        api.toolCenter(token, workspace.id),
        api.advancedNotifications(token, workspace.id),
        api.deploymentStatus(token, workspace.id)
      ]);
      setAdvancedOverview(overview);
      setKnowledgeGraph(graph);
      setToolStatuses(tools);
      setAdvancedNotifications(notifications);
      setDeploymentStatuses(deployment);
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '高级驾驶舱加载失败');
    } finally {
      setModuleLoading(false);
    }
  }

  async function handleAddMember() {
    const email = memberEmail.trim();
    if (!email) return;
    try {
      setMemberSaving(true);
      setModuleError(null);
      await api.addWorkspaceMember(
        token,
        workspace.id,
        email,
        memberRole,
        memberDepartment
      );
      setMemberEmail('');
      setMemberDepartment('');
      setMemberRole('member');
      await loadMembers();
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '成员添加失败');
    } finally {
      setMemberSaving(false);
    }
  }

  async function handleUpdateMemberRole(member: WorkspaceMember, role: WorkspaceRole) {
    try {
      setMemberActionId(member.id);
      setModuleError(null);
      await api.updateWorkspaceMember(
        token,
        workspace.id,
        member.id,
        role,
        member.department
      );
      await loadMembers();
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '角色更新失败');
    } finally {
      setMemberActionId(null);
    }
  }

  async function handleRemoveMember(member: WorkspaceMember) {
    const confirmed = window.confirm(`确认移除“${member.username}”吗？`);
    if (!confirmed) return;
    try {
      setMemberActionId(member.id);
      setModuleError(null);
      await api.removeWorkspaceMember(token, workspace.id, member.id);
      await loadMembers();
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '成员移除失败');
    } finally {
      setMemberActionId(null);
    }
  }

  async function handleAskChat() {
    const question = chatQuestion.trim();
    if (!question) return;
    const userMessage: ChatMessageView = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question
    };
    try {
      setChatLoading(true);
      setModuleError(null);
      setChatQuestion('');
      setChatMessages((messages) => [...messages, userMessage]);
      const response: ChatAskResponse = await api.askChat(
        token,
        workspace.id,
        question,
        chatSessionId
      );
      setChatSessionId(response.session.id);
      setChatMessages((messages) => [
        ...messages,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.answer,
          sources: response.sources,
          modelName: response.model_name
        }
      ]);
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '问答失败');
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <img className="brand-logo" src="/qizhiyun-logo.png" alt="企知云" />
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
            deletingDocumentId={deletingDocumentId}
            error={moduleError}
            onFileChange={handleFileChange}
            onUpload={handleUpload}
            onDelete={handleDeleteDocument}
            onRefresh={loadWorkspaceModules}
          />
        ) : activePage === 'knowledge' ? (
          <KnowledgePanel
            currentNavLabel={currentNav.label}
            knowledgeBase={knowledgeBase}
            documents={documents}
            chunks={knowledgeChunks}
            searchQuery={searchQuery}
            searchResults={searchResults}
            loading={moduleLoading}
            searching={searching}
            error={moduleError}
            onSearchQueryChange={setSearchQuery}
            onSearch={handleSearch}
            onClearSearch={handleClearSearch}
            onRefresh={loadWorkspaceModules}
          />
        ) : activePage === 'chat' ? (
          <ChatPanel
            currentNavLabel={currentNav.label}
            messages={chatMessages}
            question={chatQuestion}
            loading={chatLoading}
            error={moduleError}
            onQuestionChange={setChatQuestion}
            onAsk={handleAskChat}
          />
        ) : activePage === 'members' ? (
          <MembersPanel
            currentNavLabel={currentNav.label}
            members={members}
            currentUserId={user.id}
            canManage={canManageMembers}
            canGrantAdmin={workspace.role === 'owner'}
            loading={moduleLoading}
            saving={memberSaving}
            actionMemberId={memberActionId}
            error={moduleError}
            email={memberEmail}
            department={memberDepartment}
            role={memberRole}
            onEmailChange={setMemberEmail}
            onDepartmentChange={setMemberDepartment}
            onRoleChange={setMemberRole}
            onAddMember={handleAddMember}
            onUpdateRole={handleUpdateMemberRole}
            onRemoveMember={handleRemoveMember}
            onRefresh={loadMembers}
          />
        ) : activePage === 'audit' ? (
          <AuditPanel
            currentNavLabel={currentNav.label}
            logs={auditLogs}
            loading={moduleLoading}
            error={moduleError}
            onRefresh={loadAuditLogs}
          />
        ) : activePage === 'advanced' ? (
          <AdvancedPanel
            currentNavLabel={currentNav.label}
            overview={advancedOverview}
            graph={knowledgeGraph}
            tools={toolStatuses}
            notifications={advancedNotifications}
            deployment={deploymentStatuses}
            loading={moduleLoading}
            error={moduleError}
            onRefresh={loadAdvancedDashboard}
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
  deletingDocumentId,
  error,
  onFileChange,
  onUpload,
  onDelete,
  onRefresh
}: {
  documents: DocumentRecord[];
  currentNavLabel: string;
  loading: boolean;
  uploading: boolean;
  selectedFile: File | null;
  deletingDocumentId: string | null;
  error: string | null;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onDelete: (document: DocumentRecord) => void;
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
          <span>片段</span>
          <span>上传时间</span>
          <span>操作</span>
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
              <span>{document.chunk_count}</span>
              <span>{formatDate(document.created_at)}</span>
              <button
                className="icon-button danger"
                type="button"
                title="删除文档"
                aria-label={`删除 ${document.filename}`}
                disabled={deletingDocumentId === document.id}
                onClick={() => onDelete(document)}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
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
  chunks,
  searchQuery,
  searchResults,
  loading,
  searching,
  error,
  onSearchQueryChange,
  onSearch,
  onClearSearch,
  onRefresh
}: {
  currentNavLabel: string;
  knowledgeBase: KnowledgeBaseStatus | null;
  documents: DocumentRecord[];
  chunks: KnowledgeChunk[];
  searchQuery: string;
  searchResults: KnowledgeChunk[];
  loading: boolean;
  searching: boolean;
  error: string | null;
  onSearchQueryChange: (value: string) => void;
  onSearch: () => void;
  onClearSearch: () => void;
  onRefresh: () => void;
}) {
  const hasSearchQuery = searchQuery.trim().length > 0;
  const visibleChunks = hasSearchQuery ? searchResults : chunks;

  return (
    <section className="content-panel module-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{currentNavLabel}</p>
          <h2>知识库状态</h2>
          <p>文档上传后自动解析为知识片段，当前版本提供工作区内关键词检索预览。</p>
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

      <form
        className="knowledge-search"
        onSubmit={(event) => {
          event.preventDefault();
          void onSearch();
        }}
      >
        <div className="input-row">
          <Search size={18} aria-hidden="true" />
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="输入关键词检索当前工作区知识片段"
          />
        </div>
        <button className="primary-action compact-action" type="submit" disabled={searching}>
          <Search size={18} aria-hidden="true" />
          {searching ? '检索中' : '检索'}
        </button>
        {hasSearchQuery && (
          <button className="ghost-button" type="button" onClick={onClearSearch}>
            清空
          </button>
        )}
      </form>

      <KnowledgeChunkList
        title={hasSearchQuery ? '检索结果' : '最近知识片段'}
        chunks={visibleChunks}
        showScore={hasSearchQuery}
        emptyText={hasSearchQuery ? '当前关键词没有命中片段。' : '上传并解析文档后这里会显示知识片段。'}
      />

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

function KnowledgeChunkList({
  title,
  chunks,
  showScore,
  emptyText
}: {
  title: string;
  chunks: KnowledgeChunk[];
  showScore: boolean;
  emptyText: string;
}) {
  return (
    <div className="chunk-list">
      <div className="chunk-list-head">
        <h3>{title}</h3>
        <span>{chunks.length} 条</span>
      </div>
      {chunks.length === 0 ? (
        <div className="empty-row">{emptyText}</div>
      ) : (
        chunks.map((chunk) => (
          <article className="chunk-item" key={chunk.id}>
            <div>
              <strong>{chunk.filename}</strong>
              <span>片段 #{chunk.chunk_index + 1}</span>
              {showScore && <span>相关度 {chunk.score.toFixed(2)}</span>}
            </div>
            <p>{chunk.content}</p>
          </article>
        ))
      )}
    </div>
  );
}

function ChatPanel({
  currentNavLabel,
  messages,
  question,
  loading,
  error,
  onQuestionChange,
  onAsk
}: {
  currentNavLabel: string;
  messages: ChatMessageView[];
  question: string;
  loading: boolean;
  error: string | null;
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
}) {
  return (
    <section className="content-panel module-panel chat-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{currentNavLabel}</p>
          <h2>RAG 智能问答</h2>
          <p>基于当前工作区知识片段回答问题，并返回引用来源。</p>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="chat-thread" aria-live="polite">
        {messages.length === 0 ? (
          <div className="empty-row">上传并解析文档后，可以在这里提问。</div>
        ) : (
          messages.map((message) => (
            <article className={`chat-message ${message.role}`} key={message.id}>
              <div className="chat-bubble">
                <strong>{message.role === 'user' ? '你' : '知识助手'}</strong>
                {message.modelName && <span>{message.modelName}</span>}
                <p>{message.content}</p>
              </div>
              {message.sources && message.sources.length > 0 && (
                <div className="chat-sources">
                  <span>来源</span>
                  {message.sources.map((source) => (
                    <article key={source.id}>
                      <strong>{source.filename}</strong>
                      <small>片段 #{source.chunk_index + 1} · 相关度 {source.score.toFixed(2)}</small>
                      <p>{source.content}</p>
                    </article>
                  ))}
                </div>
              )}
            </article>
          ))
        )}
      </div>

      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void onAsk();
        }}
      >
        <textarea
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          placeholder="输入要向当前工作区知识库提问的问题"
        />
        <button className="primary-action compact-action" type="submit" disabled={loading || !question.trim()}>
          <Bot size={18} aria-hidden="true" />
          {loading ? '生成中' : '提问'}
        </button>
      </form>
    </section>
  );
}

function MembersPanel({
  currentNavLabel,
  members,
  currentUserId,
  canManage,
  canGrantAdmin,
  loading,
  saving,
  actionMemberId,
  error,
  email,
  department,
  role,
  onEmailChange,
  onDepartmentChange,
  onRoleChange,
  onAddMember,
  onUpdateRole,
  onRemoveMember,
  onRefresh
}: {
  currentNavLabel: string;
  members: WorkspaceMember[];
  currentUserId: string;
  canManage: boolean;
  canGrantAdmin: boolean;
  loading: boolean;
  saving: boolean;
  actionMemberId: string | null;
  error: string | null;
  email: string;
  department: string;
  role: WorkspaceRole;
  onEmailChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onRoleChange: (value: WorkspaceRole) => void;
  onAddMember: () => void;
  onUpdateRole: (member: WorkspaceMember, role: WorkspaceRole) => void;
  onRemoveMember: (member: WorkspaceMember) => void;
  onRefresh: () => void;
}) {
  const availableRoleOptions = canGrantAdmin
    ? memberRoleOptions
    : memberRoleOptions.filter((option) => option.value !== 'admin');

  return (
    <section className="content-panel module-panel collaboration-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{currentNavLabel}</p>
          <h2>企业成员</h2>
          <p>查看企业工作区成员，管理角色和协作权限。</p>
        </div>
        <button className="ghost-button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={18} aria-hidden="true" />
          刷新
        </button>
      </div>

      {canManage && (
        <form
          className="member-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onAddMember();
          }}
        >
          <label>
            邮箱
            <input
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="成员已注册邮箱"
            />
          </label>
          <label>
            角色
            <select
              value={role}
              onChange={(event) => onRoleChange(event.target.value as WorkspaceRole)}
            >
              {availableRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            部门
            <input
              value={department}
              onChange={(event) => onDepartmentChange(event.target.value)}
              placeholder="可选"
            />
          </label>
          <button className="primary-action compact-action" type="submit" disabled={saving || !email.trim()}>
            <UserPlus size={18} aria-hidden="true" />
            {saving ? '添加中' : '添加成员'}
          </button>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="member-table">
        <div className="member-row member-head">
          <span>成员</span>
          <span>角色</span>
          <span>部门</span>
          <span>加入时间</span>
          <span>操作</span>
        </div>
        {members.length === 0 ? (
          <div className="empty-row">当前企业工作区还没有成员。</div>
        ) : (
          members.map((member) => {
            const isOwner = member.role === 'owner';
            const isCurrentUser = member.user_id === currentUserId;
            const canEditRow =
              canManage && !isOwner && !isCurrentUser && (canGrantAdmin || member.role !== 'admin');
            return (
              <div className="member-row" key={member.id}>
                <span>
                  <strong>{member.username}</strong>
                  <small>{member.email}</small>
                </span>
                <span>
                  {canEditRow ? (
                    <select
                      value={member.role}
                      disabled={actionMemberId === member.id}
                      onChange={(event) =>
                        onUpdateRole(member, event.target.value as WorkspaceRole)
                      }
                    >
                      {availableRoleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <StatusBadge value={member.role} />
                  )}
                </span>
                <span>{member.department || '未设置'}</span>
                <span>{formatDate(member.joined_at)}</span>
                <span>
                  <button
                    className="icon-button danger"
                    type="button"
                    title="移除成员"
                    aria-label={`移除 ${member.username}`}
                    disabled={!canEditRow || actionMemberId === member.id}
                    onClick={() => onRemoveMember(member)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function AuditPanel({
  currentNavLabel,
  logs,
  loading,
  error,
  onRefresh
}: {
  currentNavLabel: string;
  logs: AuditLogRecord[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <section className="content-panel module-panel collaboration-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{currentNavLabel}</p>
          <h2>审计日志</h2>
          <p>查看当前企业工作区最近的成员、文档、知识库和问答操作。</p>
        </div>
        <button className="ghost-button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={18} aria-hidden="true" />
          刷新
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="audit-list">
        {logs.length === 0 ? (
          <div className="empty-row">当前企业工作区还没有审计记录。</div>
        ) : (
          logs.map((log) => (
            <article className="audit-item" key={log.id}>
              <div>
                <strong>{actionText(log.action)}</strong>
                <span>{formatDate(log.created_at)}</span>
              </div>
              <p>
                操作者：{log.user_id || '系统'} · 目标：{log.target_type || '无'} /{' '}
                {log.target_id || '无'}
              </p>
              <code>{formatAuditDetail(log.detail)}</code>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function AdvancedPanel({
  currentNavLabel,
  overview,
  graph,
  tools,
  notifications,
  deployment,
  loading,
  error,
  onRefresh
}: {
  currentNavLabel: string;
  overview: AdvancedOverview | null;
  graph: KnowledgeGraph | null;
  tools: ToolStatus[];
  notifications: AdvancedNotification[];
  deployment: DeploymentStatus[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const graphNodes = graph?.nodes ?? [];
  const graphEdges = graph?.edges ?? [];
  const conceptCount = graphNodes.filter((node) => node.type === 'concept').length;

  return (
    <section className="content-panel module-panel advanced-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{currentNavLabel}</p>
          <h2>V5 高级驾驶舱</h2>
          <p>集中查看知识资产、图谱预览、工具接入、通知动态和私有化部署状态。</p>
        </div>
        <button className="ghost-button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={18} aria-hidden="true" />
          刷新
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="knowledge-grid advanced-metrics">
        <MetricCard
          label="文档数量"
          value={String(overview?.document_count ?? 0)}
          icon={FileText}
        />
        <MetricCard
          label="知识片段"
          value={String(overview?.chunk_count ?? 0)}
          icon={Workflow}
        />
        <MetricCard
          label="成员数量"
          value={String(overview?.member_count ?? 0)}
          icon={Users}
        />
        <MetricCard
          label="审计事件"
          value={String(overview?.audit_log_count ?? 0)}
          icon={ShieldCheck}
        />
      </div>

      <div className="advanced-grid">
        <section className="advanced-section graph-section">
          <div className="section-title">
            <Network size={20} aria-hidden="true" />
            <div>
              <h3>知识图谱预览</h3>
              <span>
                {graphNodes.length} 个节点 / {graphEdges.length} 条关系 / {conceptCount} 个概念
              </span>
            </div>
          </div>
          <div className="graph-board" aria-label="知识图谱节点">
            {graphNodes.slice(0, 12).map((node) => (
              <span className={`graph-node ${node.type}`} key={node.id}>
                {node.label}
              </span>
            ))}
            {graphNodes.length === 0 && <div className="empty-row">暂无图谱节点。</div>}
          </div>
          <div className="graph-relations">
            {graphEdges.slice(0, 6).map((edge) => (
              <article key={edge.id}>
                <strong>{edge.label}</strong>
                <span>{edge.source.replace(/^[^:]+:/, '')} → {edge.target.replace(/^[^:]+:/, '')}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="advanced-section">
          <div className="section-title">
            <Wrench size={20} aria-hidden="true" />
            <div>
              <h3>工具中心</h3>
              <span>Milvus、Neo4j、Rerank、MinIO、n8n 等接入状态</span>
            </div>
          </div>
          <div className="tool-grid">
            {tools.map((tool) => (
              <article className="tool-card" key={tool.key}>
                <div>
                  <strong>{tool.label}</strong>
                  <StatusBadge value={tool.status} />
                </div>
                <p>{tool.description}</p>
                {tool.endpoint && <code>{tool.endpoint}</code>}
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="advanced-grid secondary">
        <section className="advanced-section">
          <div className="section-title">
            <Bell size={20} aria-hidden="true" />
            <div>
              <h3>通知中心</h3>
              <span>最近工作区动态</span>
            </div>
          </div>
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="empty-row">暂无通知动态。</div>
            ) : (
              notifications.slice(0, 8).map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                  <p>{item.message}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="advanced-section">
          <div className="section-title">
            <Server size={20} aria-hidden="true" />
            <div>
              <h3>部署状态</h3>
              <span>只展示运行状态，不展示账号、密码和密钥</span>
            </div>
          </div>
          <div className="deployment-list">
            {deployment.map((item) => (
              <article key={item.key}>
                <div>
                  <strong>{item.label}</strong>
                  <StatusBadge value={item.status} />
                </div>
                <code>{item.value}</code>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="advanced-health">
        <StatusBadge value={overview?.vector_status ?? 'pending'} />
        <StatusBadge value={overview?.graph_status ?? 'pending'} />
        <StatusBadge value={overview?.rerank_status ?? 'pending'} />
        <span>
          最近活动：
          {overview?.latest_activity_at ? formatDate(overview.latest_activity_at) : '暂无'}
        </span>
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
      owner: '所有者',
      admin: '管理员',
      member: '成员',
      viewer: '只读',
      empty: '空',
      documents_uploaded: '已上传文档',
      ready: '可检索',
      configured: '已配置',
      missing: '待配置',
      'milvus-configured': 'Milvus 已配置',
      'faiss-ready': 'FAISS 就绪',
      'milvus-ready': 'Milvus 就绪',
      'neo4j-ready': 'Neo4j 就绪',
      'sqlite-ready': 'SQLite 就绪',
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

function actionText(action: string) {
  const map: Record<string, string> = {
    'auth.registered': '账号注册',
    'auth.login': '密码登录',
    'auth.email_code_login': '验证码登录',
    'auth.password_reset': '重置密码',
    'workspace.created': '创建工作区',
    'workspace.deleted': '删除工作区',
    'member.added': '添加成员',
    'member.role_updated': '修改成员角色',
    'member.removed': '移除成员',
    'document.created': '创建文档记录',
    'document.uploaded': '上传文档',
    'document.deleted': '删除文档',
    'chat.asked': '发起问答'
  };
  return map[action] ?? action;
}

function formatAuditDetail(detail: Record<string, unknown>) {
  const text = JSON.stringify(detail);
  return text === '{}' ? '无详情' : text;
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
    advanced: 'V5 高级驾驶舱',
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
    advanced: 'V5 汇总知识资产、知识图谱、工具中心、通知中心和部署状态。',
    members: 'V4 将实现邀请成员、移除成员、角色权限和文档权限。',
    audit: '记录登录、文档、知识库、问答、工具、设置和权限操作。'
  };
  if (type === 'personal' && (page === 'members' || page === 'audit')) {
    return '个人工作区不展示企业协作入口。';
  }
  return shared[page];
}
