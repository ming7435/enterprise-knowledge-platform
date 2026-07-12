import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  ClipboardCopy,
  Database,
  FileSearch,
  FileText,
  Filter,
  History,
  Info,
  Layers3,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';

import { getActorName, getDisplayName, getMemberDisplayName, maskEmail, shortId } from '../display';
import {
  beijingDateKey as formatBeijingDateKey,
  dateValue as getApiDateValue,
  formatBeijingDateTime
} from '../time';
import { KnowledgeGraphExplorer } from './KnowledgeGraphExplorer';
import type {
  AdvancedNotification,
  AdvancedOverview,
  AuditLogRecord,
  DocumentContent,
  DocumentRecord,
  KnowledgeBaseStatus,
  KnowledgeChunk,
  KnowledgeGraph,
  KnowledgeGraphNode,
  User,
  Workspace,
  WorkspaceModelConnectionTestResult,
  WorkspaceMember,
  WorkspaceRole,
  WorkspaceSettingRecord
} from '../types';

export type EnterprisePageKey =
  | 'dashboard'
  | 'documents'
  | 'knowledge'
  | 'chat'
  | 'settings'
  | 'advanced'
  | 'members'
  | 'audit';

interface EnterpriseChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: KnowledgeChunk[];
  modelName?: string;
  useKnowledgeBase?: boolean;
  createdAt?: string;
}

interface EnterpriseWorkspacePanelProps {
  activePage: EnterprisePageKey;
  currentNavLabel: string;
  user: User;
  workspace: Workspace;
  documents: DocumentRecord[];
  knowledgeBase: KnowledgeBaseStatus | null;
  chunks: KnowledgeChunk[];
  members: WorkspaceMember[];
  auditLogs: AuditLogRecord[];
  advancedOverview: AdvancedOverview | null;
  knowledgeGraph: KnowledgeGraph | null;
  notifications: AdvancedNotification[];
  searchQuery: string;
  searchResults: KnowledgeChunk[];
  selectedFile: File | null;
  selectedFiles: File[];
  documentContents: Record<string, DocumentContent>;
  chatQuestion: string;
  chatMessages: EnterpriseChatMessage[];
  selectedKnowledgeDocumentIds: string[];
  selectedGraphDocumentIds: string[];
  useKnowledgeBaseForChat: boolean;
  activeChatModelName: string;
  workspaceSettings: WorkspaceSettingRecord[];
  memberEmail: string;
  memberDepartment: string;
  memberRole: WorkspaceRole;
  loading: boolean;
  uploading: boolean;
  searching: boolean;
  chatLoading: boolean;
  memberSaving: boolean;
  deletingDocumentId: string | null;
  deletingDocumentIds: string[];
  memberActionId: string | null;
  deletingAuditLogId: string | null;
  auditBulkDeleting: boolean;
  auditRetentionDeleting: boolean;
  settingSavingKey: string | null;
  settingTestingKey: string | null;
  error: string | null;
  notice: string | null;
  knowledgeDocumentFilter: string;
  canManageMembers: boolean;
  canGrantAdmin: boolean;
  onNavigate: (page: EnterprisePageKey) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onDeleteDocument: (document: DocumentRecord) => void;
  onDeleteDocuments: (documents: DocumentRecord[]) => void;
  onLoadDocumentContent: (document: DocumentRecord) => void | Promise<void>;
  onSaveWorkspaceSetting: (
    settingKey: string,
    settingValue: Record<string, unknown>
  ) => void | Promise<void>;
  onTestWorkspaceModelConnection: (
    settingKey: string,
    settingValue: Record<string, unknown>
  ) => Promise<WorkspaceModelConnectionTestResult | null>;
  onRefreshModules: () => void;
  onRefreshEnterpriseDashboard: () => void;
  onRefreshAdvanced: () => void;
  onRebuildGraph: () => void;
  onRefreshMembers: () => void;
  onRefreshAuditLogs: () => void;
  onDeleteAuditLog: (log: AuditLogRecord) => void;
  onDeleteAllAuditLogs: () => void;
  onDeleteAuditLogsByRetention: (retentionDays: number) => void;
  onSearchQueryChange: (value: string) => void;
  onKnowledgeDocumentFilterChange: (documentId: string) => void;
  onSearch: () => void;
  onClearSearch: () => void;
  onQuestionChange: (value: string) => void;
  onSelectedKnowledgeDocumentIdsChange: (documentIds: string[]) => void;
  onSelectedGraphDocumentIdsChange: (documentIds: string[]) => void;
  onSearchGraphNodes: (query: string, documentIds?: string[]) => Promise<KnowledgeGraphNode[]>;
  onLoadGraphNodeDetail: (nodeId: string) => Promise<KnowledgeGraphNode | null>;
  onLoadGraphNeighbors: (nodeId: string) => Promise<KnowledgeGraphNode[]>;
  onUseKnowledgeBaseForChatChange: (value: boolean) => void;
  onAsk: () => void;
  onPrepareQuestion: (question: string, documentIds?: string[]) => void;
  onDeleteChatTurn: (messageId: string) => void;
  onClearChatHistory: () => void;
  onEmailChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onRoleChange: (value: WorkspaceRole) => void;
  onAddMember: () => void;
  onUpdateRole: (member: WorkspaceMember, role: WorkspaceRole) => void;
  onUpdateDepartment: (member: WorkspaceMember, department: string) => void;
  onRemoveMember: (member: WorkspaceMember) => void;
}

interface EnterpriseProfile {
  role: WorkspaceRole;
  documentCount: number;
  parsedCount: number;
  indexedCount: number;
  failedCount: number;
  chunkCount: number;
  memberCount: number;
  auditCount: number;
  qaCount: number;
  latestUpdatedAt?: string | null;
  latestQuestionAt?: string | null;
  latestParsedAt?: string | null;
  knowledgeStatusText: string;
  knowledgeStatusRaw: string;
  canAsk: boolean;
  canUpload: boolean;
  canManageDocs: boolean;
  canManageMembers: boolean;
  failedOperationCount: number;
}

interface Metric {
  label: string;
  value: string;
  hint?: string;
  tone?: 'normal' | 'warning' | 'danger';
}

const roleOptions: Array<{ value: WorkspaceRole; label: string }> = [
  { value: 'admin', label: '管理员' },
  { value: 'member', label: '成员' },
  { value: 'viewer', label: '只读' }
];

export function EnterpriseWorkspacePanel({
  activePage,
  currentNavLabel,
  user,
  workspace,
  documents,
  knowledgeBase,
  chunks,
  members,
  auditLogs,
  advancedOverview,
  knowledgeGraph,
  notifications,
  searchQuery,
  searchResults,
  selectedFile,
  selectedFiles,
  documentContents,
  chatQuestion,
  chatMessages,
  selectedKnowledgeDocumentIds,
  selectedGraphDocumentIds,
  useKnowledgeBaseForChat,
  activeChatModelName,
  workspaceSettings,
  memberEmail,
  memberDepartment,
  memberRole,
  loading,
  uploading,
  searching,
  chatLoading,
  memberSaving,
  deletingDocumentId,
  deletingDocumentIds,
  memberActionId,
  deletingAuditLogId,
  auditBulkDeleting,
  auditRetentionDeleting,
  settingSavingKey,
  settingTestingKey,
  error,
  notice,
  knowledgeDocumentFilter,
  canManageMembers,
  canGrantAdmin,
  onNavigate,
  onFileChange,
  onUpload,
  onDeleteDocument,
  onDeleteDocuments,
  onLoadDocumentContent,
  onSaveWorkspaceSetting,
  onTestWorkspaceModelConnection,
  onRefreshModules,
  onRefreshEnterpriseDashboard,
  onRefreshAdvanced,
  onRebuildGraph,
  onRefreshMembers,
  onRefreshAuditLogs,
  onDeleteAuditLog,
  onDeleteAllAuditLogs,
  onDeleteAuditLogsByRetention,
  onSearchQueryChange,
  onKnowledgeDocumentFilterChange,
  onSearch,
  onClearSearch,
  onQuestionChange,
  onSelectedKnowledgeDocumentIdsChange,
  onSelectedGraphDocumentIdsChange,
  onSearchGraphNodes,
  onLoadGraphNodeDetail,
  onLoadGraphNeighbors,
  onUseKnowledgeBaseForChatChange,
  onAsk,
  onPrepareQuestion,
  onDeleteChatTurn,
  onClearChatHistory,
  onEmailChange,
  onDepartmentChange,
  onRoleChange,
  onAddMember,
  onUpdateRole,
  onUpdateDepartment,
  onRemoveMember
}: EnterpriseWorkspacePanelProps) {
  const profile = useMemo(
    () =>
      buildEnterpriseProfile(
        workspace,
        documents,
        knowledgeBase,
        chunks,
        members,
        auditLogs,
        chatMessages,
        notifications,
        canManageMembers
      ),
    [
      workspace,
      documents,
      knowledgeBase,
      chunks,
      members,
      auditLogs,
      chatMessages,
      notifications,
      canManageMembers
    ]
  );

  const shared = {
    currentNavLabel,
    user,
    workspace,
    documents,
    knowledgeBase,
    chunks,
    documentContents,
    members,
    auditLogs,
    chatMessages,
    selectedKnowledgeDocumentIds,
    selectedGraphDocumentIds,
    useKnowledgeBaseForChat,
    activeChatModelName,
    workspaceSettings,
    notifications,
    profile,
    error,
    notice,
    settingSavingKey,
    settingTestingKey,
    onNavigate,
    onPrepareQuestion,
    onLoadDocumentContent,
    onSaveWorkspaceSetting,
    onTestWorkspaceModelConnection,
    onSelectedKnowledgeDocumentIdsChange,
    onSelectedGraphDocumentIdsChange,
    onSearchGraphNodes,
    onLoadGraphNodeDetail,
    onLoadGraphNeighbors,
    onUseKnowledgeBaseForChatChange
  };

  if (activePage === 'documents') {
    return (
      <EnterpriseDocuments
        {...shared}
        selectedFile={selectedFile}
        selectedFiles={selectedFiles}
        uploading={uploading}
        loading={loading}
        deletingDocumentId={deletingDocumentId}
        deletingDocumentIds={deletingDocumentIds}
        onFileChange={onFileChange}
        onUpload={onUpload}
        onDeleteDocument={onDeleteDocument}
        onDeleteDocuments={onDeleteDocuments}
        onRefresh={onRefreshModules}
        onKnowledgeDocumentFilterChange={onKnowledgeDocumentFilterChange}
      />
    );
  }

  if (activePage === 'knowledge') {
    return (
      <EnterpriseKnowledgeBase
        {...shared}
        searchQuery={searchQuery}
        searchResults={searchResults}
        searching={searching}
        loading={loading}
        documentFilter={knowledgeDocumentFilter}
        onSearchQueryChange={onSearchQueryChange}
        onDocumentFilterChange={onKnowledgeDocumentFilterChange}
        onSearch={onSearch}
        onClearSearch={onClearSearch}
        onRefresh={onRefreshModules}
      />
    );
  }

  if (activePage === 'chat') {
    return (
      <EnterpriseRagChat
        {...shared}
        question={chatQuestion}
        loading={chatLoading}
        onQuestionChange={onQuestionChange}
        onAsk={onAsk}
        onDeleteChatTurn={onDeleteChatTurn}
        onClearChatHistory={onClearChatHistory}
      />
    );
  }

  if (activePage === 'settings') {
    return <EnterpriseSettings {...shared} />;
  }

  if (activePage === 'advanced') {
    return (
      <EnterpriseAdvancedDashboard
        {...shared}
        overview={advancedOverview}
        graph={knowledgeGraph}
        loading={loading}
        onRefresh={onRefreshAdvanced}
        onRebuildGraph={onRebuildGraph}
        onSearchQueryChange={onSearchQueryChange}
        onKnowledgeDocumentFilterChange={onKnowledgeDocumentFilterChange}
      />
    );
  }

  if (activePage === 'members') {
    return (
      <EnterpriseMembers
        {...shared}
        loading={loading}
        saving={memberSaving}
        actionMemberId={memberActionId}
        email={memberEmail}
        department={memberDepartment}
        role={memberRole}
        canGrantAdmin={canGrantAdmin}
        onEmailChange={onEmailChange}
        onDepartmentChange={onDepartmentChange}
        onRoleChange={onRoleChange}
        onAddMember={onAddMember}
        onUpdateRole={onUpdateRole}
        onUpdateDepartment={onUpdateDepartment}
        onRemoveMember={onRemoveMember}
        onRefresh={onRefreshMembers}
      />
    );
  }

  if (activePage === 'audit') {
    return (
      <EnterpriseAuditLogs
        {...shared}
        loading={loading}
        deletingAuditLogId={deletingAuditLogId}
        auditBulkDeleting={auditBulkDeleting}
        auditRetentionDeleting={auditRetentionDeleting}
        onRefresh={onRefreshAuditLogs}
        onDeleteAuditLog={onDeleteAuditLog}
        onDeleteAllAuditLogs={onDeleteAllAuditLogs}
        onDeleteAuditLogsByRetention={onDeleteAuditLogsByRetention}
      />
    );
  }

  return (
    <EnterpriseHome
      {...shared}
      overview={advancedOverview}
      loading={loading}
      onRefresh={onRefreshEnterpriseDashboard}
      onKnowledgeDocumentFilterChange={onKnowledgeDocumentFilterChange}
    />
  );
}

interface EnterpriseSharedProps {
  currentNavLabel: string;
  user: User;
  workspace: Workspace;
  documents: DocumentRecord[];
  knowledgeBase: KnowledgeBaseStatus | null;
  chunks: KnowledgeChunk[];
  documentContents: Record<string, DocumentContent>;
  members: WorkspaceMember[];
  auditLogs: AuditLogRecord[];
  chatMessages: EnterpriseChatMessage[];
  selectedKnowledgeDocumentIds: string[];
  selectedGraphDocumentIds: string[];
  useKnowledgeBaseForChat: boolean;
  activeChatModelName: string;
  workspaceSettings: WorkspaceSettingRecord[];
  notifications: AdvancedNotification[];
  profile: EnterpriseProfile;
  error: string | null;
  notice: string | null;
  settingSavingKey: string | null;
  settingTestingKey: string | null;
  onNavigate: (page: EnterprisePageKey) => void;
  onPrepareQuestion: (question: string, documentIds?: string[]) => void;
  onLoadDocumentContent: (document: DocumentRecord) => void | Promise<void>;
  onSaveWorkspaceSetting: (
    settingKey: string,
    settingValue: Record<string, unknown>
  ) => void | Promise<void>;
  onTestWorkspaceModelConnection: (
    settingKey: string,
    settingValue: Record<string, unknown>
  ) => Promise<WorkspaceModelConnectionTestResult | null>;
  onSelectedKnowledgeDocumentIdsChange: (documentIds: string[]) => void;
  onSelectedGraphDocumentIdsChange: (documentIds: string[]) => void;
  onSearchGraphNodes: (query: string, documentIds?: string[]) => Promise<KnowledgeGraphNode[]>;
  onLoadGraphNodeDetail: (nodeId: string) => Promise<KnowledgeGraphNode | null>;
  onLoadGraphNeighbors: (nodeId: string) => Promise<KnowledgeGraphNode[]>;
  onUseKnowledgeBaseForChatChange: (value: boolean) => void;
}

function EnterpriseHome({
  currentNavLabel,
  user,
  workspace,
  documents,
  chunks,
  members,
  auditLogs,
  chatMessages,
  notifications,
  profile,
  overview,
  error,
  notice,
  loading,
  onNavigate,
  onPrepareQuestion,
  onRefresh,
  onKnowledgeDocumentFilterChange
}: EnterpriseSharedProps & {
  overview: AdvancedOverview | null;
  loading: boolean;
  onRefresh: () => void;
  onKnowledgeDocumentFilterChange: (documentId: string) => void;
}) {
  const operations = buildEnterpriseOperations(documents, auditLogs, chatMessages, notifications, user, members)
    .slice(0, 8);
  const reminders = buildEnterpriseReminders(profile, members, operations);
  const recentQuestions = buildQuestionHistory(chatMessages, user).slice(0, 5);
  const currentUserName = getDisplayName(user);

  return (
    <section className="enterprise-page personal-page">
      <PageHeading
        eyebrow={currentNavLabel}
        title="企业知识管理工作台"
        description="集中查看企业文档、知识库、问答、成员和审计动态。"
        actionLabel={loading ? '刷新中' : '刷新'}
        actionIcon={RefreshCw}
        onAction={onRefresh}
      />
      <EnterpriseIsolationNotice />
      <Feedback error={error} notice={notice} />

      <div className="enterprise-hero personal-hero">
        <div>
          <p className="eyebrow">企业首页</p>
          <h2>{workspace.name}</h2>
          <p>当前用户：{currentUserName}</p>
          <p>
            当前空间：企业工作区 · 当前角色：{roleText(profile.role)} · 企业数据仅当前企业工作区可见，
            不与个人工作区同步。
          </p>
        </div>
        <ShieldCheck size={46} aria-hidden="true" />
      </div>

      <MetricGrid
        metrics={[
          { label: '企业文档数量', value: String(profile.documentCount) },
          { label: '企业知识片段', value: String(profile.chunkCount) },
          { label: '企业知识库状态', value: profile.knowledgeStatusText },
          { label: '成员数量', value: String(overview?.member_count ?? profile.memberCount) },
          { label: '累计问答次数', value: String(profile.qaCount) },
          { label: '审计事件数量', value: String(overview?.audit_log_count ?? profile.auditCount) },
          { label: '最近更新时间', value: formatDate(profile.latestUpdatedAt) }
        ]}
      />

      <div className="enterprise-actions quick-actions six">
        <ActionButton icon={Upload} label="上传企业文档" onClick={() => onNavigate('documents')} />
        <ActionButton icon={Database} label="查看企业知识库" onClick={() => onNavigate('knowledge')} />
        <ActionButton icon={Bot} label="开始企业问答" onClick={() => onNavigate('chat')} />
        <ActionButton icon={Users} label="管理成员" onClick={() => onNavigate('members')} />
        <ActionButton icon={ShieldCheck} label="查看审计日志" onClick={() => onNavigate('audit')} />
        <ActionButton icon={BarChart3} label="查看高级驾驶舱" onClick={() => onNavigate('advanced')} />
      </div>

      <div className="enterprise-dashboard-grid personal-dashboard-grid">
        <section className="enterprise-card personal-card">
          <SectionTitle title="企业知识状态" subtitle="当前企业知识库可用性" />
          <DefinitionList
            items={[
              ['是否可检索', profile.canAsk ? '可检索' : '暂不可用'],
              ['已入库文档数', String(profile.indexedCount)],
              ['知识片段数', String(profile.chunkCount)],
              ['最近解析时间', formatDate(profile.latestParsedAt)],
              ['最近问答时间', formatDate(profile.latestQuestionAt)],
              ['待处理文档', String(profile.documentCount - profile.indexedCount)]
            ]}
          />
        </section>

        <section className="enterprise-card personal-card">
          <SectionTitle title="企业待处理提醒" subtitle="需要企业管理员或成员关注的事项" />
          {reminders.length === 0 ? (
            <EmptyState text="当前企业工作区暂无待处理提醒。" />
          ) : (
            <div className="reminder-list">
              {reminders.map((item) => (
                <article key={item.title}>
                  <AlertTriangle size={18} aria-hidden="true" />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </div>
                  <button type="button" onClick={() => onNavigate(item.page)}>
                    {item.action}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="enterprise-card personal-card wide">
          <SectionTitle title="最近企业文档" subtitle="最近上传或更新的企业知识资产" />
          {documents.length === 0 ? (
            <EmptyState
              icon={FileText}
              text="当前企业工作区还没有上传文档，上传企业文档后可以构建企业知识库并进行企业问答。"
              actionLabel="上传企业文档"
              onAction={() => onNavigate('documents')}
            />
          ) : (
            <div className="compact-scroll">
              <div className="personal-table">
                <div className="personal-table-head enterprise-document-home-row">
                  <span>文档名</span>
                  <span>类型</span>
                  <span>解析状态</span>
                  <span>入库状态</span>
                  <span>片段数</span>
                  <span>上传人</span>
                  <span>上传时间</span>
                  <span>操作</span>
                </div>
                {documents.slice(0, 5).map((document) => (
                  <div className="personal-table-row enterprise-document-home-row" key={document.id}>
                    <strong>{document.filename}</strong>
                    <span>{document.file_type || '未知'}</span>
                    <StatusBadge value={document.parse_status} kind="parse" />
                    <StatusBadge value={document.index_status} kind="index" />
                    <span>{document.chunk_count ?? 0}</span>
                    <span>{enterpriseUploaderName(document, user, members)}</span>
                    <span>{formatDate(document.created_at)}</span>
                    <div className="inline-actions">
                      <button type="button" onClick={() => onNavigate('documents')}>详情</button>
                      <button
                        type="button"
                        onClick={() => {
                          onKnowledgeDocumentFilterChange(document.id);
                          onNavigate('knowledge');
                        }}
                      >
                        查看片段
                      </button>
                      <button
                        type="button"
                        onClick={() => onPrepareQuestion(`请基于企业文档《${document.filename}》回答问题。`, [document.id])}
                      >
                        去问答
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="enterprise-card personal-card">
          <SectionTitle title="最近企业问答" subtitle="当前会话中的企业 RAG 问答" />
          {recentQuestions.length === 0 ? (
            <EmptyState text="当前企业工作区还没有问答记录。" actionLabel="开始企业问答" onAction={() => onNavigate('chat')} />
          ) : (
            <div className="personal-list">
              {recentQuestions.map((item) => (
                <article key={item.id}>
                  <strong>{item.question}</strong>
                  <span>提问人：{item.asker}</span>
                  <small>{formatDate(item.createdAt)}</small>
                  <div className="inline-actions">
                    <button type="button" onClick={() => onNavigate('chat')}>查看</button>
                    <button type="button" onClick={() => onPrepareQuestion(item.question)}>继续问答</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

      </div>
    </section>
  );
}

function EnterpriseDocuments({
  currentNavLabel,
  user,
  workspace,
  documents,
  chunks,
  members,
  profile,
  selectedFile,
  selectedFiles,
  uploading,
  loading,
  deletingDocumentId,
  deletingDocumentIds,
  error,
  notice,
  onNavigate,
  onPrepareQuestion,
  onFileChange,
  onUpload,
  onDeleteDocument,
  onDeleteDocuments,
  onRefresh,
  onKnowledgeDocumentFilterChange
}: EnterpriseSharedProps & {
  selectedFile: File | null;
  selectedFiles: File[];
  uploading: boolean;
  loading: boolean;
  deletingDocumentId: string | null;
  deletingDocumentIds: string[];
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onDeleteDocument: (document: DocumentRecord) => void;
  onDeleteDocuments: (documents: DocumentRecord[]) => void;
  onRefresh: () => void;
  onKnowledgeDocumentFilterChange: (documentId: string) => void;
}) {
  const [nameFilter, setNameFilter] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState('');
  const [parseFilter, setParseFilter] = useState('all');
  const [indexFilter, setIndexFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [detailDocument, setDetailDocument] = useState<DocumentRecord | null>(null);

  const documentTypes = unique(documents.map((item) => item.file_type || '未知'));
  const visibleDocuments = documents.filter((document) => {
    const matchesName = document.filename.toLowerCase().includes(nameFilter.trim().toLowerCase());
    const matchesUploader = enterpriseUploaderName(document, user, members)
      .toLowerCase()
      .includes(uploaderFilter.trim().toLowerCase());
    const matchesParse = parseFilter === 'all' || document.parse_status === parseFilter;
    const matchesIndex = indexFilter === 'all' || document.index_status === indexFilter;
    const matchesType = typeFilter === 'all' || document.file_type === typeFilter;
    return matchesName && matchesUploader && matchesParse && matchesIndex && matchesType;
  });
  const selectedDocuments = documents.filter((document) => selectedDocumentIds.includes(document.id));

  function resetFilters() {
    setNameFilter('');
    setUploaderFilter('');
    setParseFilter('all');
    setIndexFilter('all');
    setTypeFilter('all');
    setSelectedDocumentIds([]);
  }

  function toggleDocument(documentId: string) {
    setSelectedDocumentIds((ids) =>
      ids.includes(documentId) ? ids.filter((id) => id !== documentId) : [...ids, documentId]
    );
  }

  return (
    <section className="enterprise-page personal-page">
      <PageHeading
        eyebrow={currentNavLabel}
        title="企业文档管理"
        description="上传企业文档，系统会解析文本、生成知识片段，并加入当前企业知识库。文档仅在当前企业工作区内可见。"
        actionLabel={loading ? '刷新中' : '刷新'}
        actionIcon={RefreshCw}
        onAction={onRefresh}
      />
      <EnterpriseIsolationNotice />
      <Feedback error={error} notice={notice} />

      <div className="personal-upload-panel">
        <div>
          <Upload size={24} aria-hidden="true" />
          <div>
            <strong>
              {selectedFiles.length > 0
                ? `已选择 ${selectedFiles.length} 个文件`
                : selectedFile?.name || '选择要上传的企业文档'}
            </strong>
            <span>
              {selectedFiles.length > 0
                ? selectedFiles.map((file) => `${file.name}（${formatFileSize(file.size)}）`).join('、')
                : '支持常见办公文档、文本文件和资产文件，上传后进入当前企业工作区。'}
            </span>
            <span>后续进行解析、切片、向量化和入库，上传操作会进入审计日志。</span>
          </div>
        </div>
        <div className="inline-actions wrap">
          <label className={`file-picker ${!profile.canUpload ? 'disabled' : ''}`}>
            选择文件
            <input
              type="file"
              onChange={onFileChange}
              disabled={!profile.canUpload}
              multiple
              accept=".pdf,.docx,.txt,.md,.xlsx,.csv,.pptx,.jpg,.jpeg,.png,.mp3,.mp4,.zip"
            />
          </label>
          <button
            className="primary-action compact-action"
            type="button"
            disabled={selectedFiles.length === 0 || uploading || !profile.canUpload}
            onClick={onUpload}
          >
            <Upload size={18} aria-hidden="true" />
            {uploading ? '上传中' : '上传企业文档'}
          </button>
        </div>
      </div>
      {!profile.canUpload && (
        <div className="personal-callout warning">
          <span>当前角色无权限执行上传操作。</span>
        </div>
      )}

      <MetricGrid
        metrics={[
          { label: '文档总数', value: String(profile.documentCount) },
          { label: '已解析数量', value: String(profile.parsedCount) },
          { label: '已入库数量', value: String(profile.indexedCount) },
          { label: '知识片段数量', value: String(profile.chunkCount) },
          { label: '失败数量', value: String(profile.failedCount), tone: profile.failedCount ? 'danger' : 'normal' },
          { label: '最近上传时间', value: formatDate(profile.latestUpdatedAt) }
        ]}
      />

      <div className="enterprise-filter-bar filter-bar wide">
        <input
          className="standalone-input"
          value={nameFilter}
          onChange={(event) => setNameFilter(event.target.value)}
          placeholder="按文件名搜索"
        />
        <input
          className="standalone-input"
          value={uploaderFilter}
          onChange={(event) => setUploaderFilter(event.target.value)}
          placeholder="按上传人筛选"
        />
        <select value={parseFilter} onChange={(event) => setParseFilter(event.target.value)}>
          <option value="all">全部解析状态</option>
          <option value="pending">待解析</option>
          <option value="parsing">解析中</option>
          <option value="parsed">已解析</option>
          <option value="failed">失败</option>
        </select>
        <select value={indexFilter} onChange={(event) => setIndexFilter(event.target.value)}>
          <option value="all">全部入库状态</option>
          <option value="pending">待入库</option>
          <option value="indexing">入库中</option>
          <option value="indexed">已入库</option>
          <option value="failed">失败</option>
        </select>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          <option value="all">全部类型</option>
          {documentTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <button className="ghost-button" type="button" onClick={resetFilters}>重置筛选</button>
        <button
          className="compact-operation-delete"
          type="button"
          disabled={selectedDocuments.length === 0 || deletingDocumentIds.length > 0 || !profile.canManageDocs}
          onClick={() => {
            onDeleteDocuments(selectedDocuments);
            setSelectedDocumentIds([]);
          }}
        >
          批量删除
        </button>
      </div>

      <section className="enterprise-card personal-card">
        <SectionTitle title="企业文档列表" subtitle={`${visibleDocuments.length} 个文档`} />
        {documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            text="当前企业工作区还没有上传文档，上传企业文档后可以构建企业知识库并进行企业问答。"
            actionLabel="上传企业文档"
          />
        ) : visibleDocuments.length === 0 ? (
          <EmptyState text="没有找到相关内容，请尝试更换关键词。" />
        ) : (
          <div className="compact-scroll">
            <div className="personal-table">
              <div className="personal-table-head enterprise-document-row">
                <span>选择</span>
                <span>文件名</span>
                <span>类型</span>
                <span>大小</span>
                <span>上传人</span>
                <span>解析状态</span>
                <span>入库状态</span>
                <span>片段</span>
                <span>上传时间</span>
                <span>操作</span>
              </div>
              {visibleDocuments.map((document) => {
                const docChunks = chunks.filter((chunk) => chunk.document_id === document.id);
                return (
                  <div className="personal-table-row enterprise-document-row" key={document.id}>
                    <input
                      type="checkbox"
                      checked={selectedDocumentIds.includes(document.id)}
                      disabled={!profile.canManageDocs}
                      onChange={() => toggleDocument(document.id)}
                      aria-label={`选择 ${document.filename}`}
                    />
                    <button className="text-link" type="button" onClick={() => setDetailDocument(document)}>
                      {document.filename}
                    </button>
                    <span>{document.file_type || '未知'}</span>
                    <span>暂无</span>
                    <span>{enterpriseUploaderName(document, user, members)}</span>
                    <StatusBadge value={document.parse_status} kind="parse" />
                    <StatusBadge value={document.index_status} kind="index" />
                    <span>{document.chunk_count ?? docChunks.length}</span>
                    <span>{formatDate(document.created_at)}</span>
                    <div className="inline-actions wrap">
                      <button type="button" onClick={() => setDetailDocument(document)}>详情</button>
                      <button
                        type="button"
                        onClick={() => {
                          onKnowledgeDocumentFilterChange(document.id);
                          onNavigate('knowledge');
                        }}
                      >
                        查看片段
                      </button>
                      <button
                        type="button"
                          onClick={() => onPrepareQuestion(`请基于企业文档《${document.filename}》回答问题。`, [document.id])}
                      >
                        去问答
                      </button>
                      <button type="button" disabled title="暂未开放">
                        重新解析
                      </button>
                      <button
                        className="danger-link"
                        type="button"
                        disabled={!profile.canManageDocs || deletingDocumentId === document.id || deletingDocumentIds.includes(document.id)}
                        title={!profile.canManageDocs ? '当前角色无权限执行此操作。' : undefined}
                        onClick={() => onDeleteDocument(document)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {detailDocument && (
        <DocumentDetailModal
          document={detailDocument}
          workspace={workspace}
          uploader={enterpriseUploaderName(detailDocument, user, members)}
          chunkCount={chunks.filter((chunk) => chunk.document_id === detailDocument.id).length || detailDocument.chunk_count}
          canManage={profile.canManageDocs}
          onClose={() => setDetailDocument(null)}
          onViewChunks={() => {
            onKnowledgeDocumentFilterChange(detailDocument.id);
            setDetailDocument(null);
            onNavigate('knowledge');
          }}
          onAsk={() => {
            onPrepareQuestion(`请基于企业文档《${detailDocument.filename}》回答问题。`, [detailDocument.id]);
            setDetailDocument(null);
          }}
          onDelete={() => {
            onDeleteDocument(detailDocument);
            setDetailDocument(null);
          }}
        />
      )}
    </section>
  );
}

function EnterpriseKnowledgeBase({
  currentNavLabel,
  user,
  workspace,
  documents,
  knowledgeBase,
  chunks,
  documentContents,
  members,
  searchQuery,
  searchResults,
  searching,
  loading,
  documentFilter,
  profile,
  error,
  notice,
  onNavigate,
  onPrepareQuestion,
  onLoadDocumentContent,
  selectedKnowledgeDocumentIds,
  onSelectedKnowledgeDocumentIdsChange,
  onSearchQueryChange,
  onDocumentFilterChange,
  onSearch,
  onClearSearch,
  onRefresh
}: EnterpriseSharedProps & {
  searchQuery: string;
  searchResults: KnowledgeChunk[];
  searching: boolean;
  loading: boolean;
  documentFilter: string;
  onSearchQueryChange: (value: string) => void;
  onDocumentFilterChange: (value: string) => void;
  onSearch: () => void;
  onClearSearch: () => void;
  onRefresh: () => void;
}) {
  const [chunkFilter, setChunkFilter] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState('');
  const [detailChunk, setDetailChunk] = useState<KnowledgeChunk | null>(null);
  const [detailDocument, setDetailDocument] = useState<DocumentRecord | null>(null);
  const hasQuery = searchQuery.trim().length > 0;
  const sourceChunks = hasQuery ? searchResults : chunks;
  const visibleChunks = sourceChunks.filter((chunk) => {
    const matchesDocument = documentFilter === 'all' || chunk.document_id === documentFilter;
    const matchesChunk = !chunkFilter.trim() || String(chunk.chunk_index + 1) === chunkFilter.trim();
    const document = documents.find((item) => item.id === chunk.document_id);
    const matchesUploader =
      !uploaderFilter.trim() ||
      enterpriseUploaderName(document, user, members)
        .toLowerCase()
        .includes(uploaderFilter.trim().toLowerCase());
    return matchesDocument && matchesChunk && matchesUploader;
  });
  const visibleLibraries = documents.filter((document) => {
    const matchesLibrary = documentFilter === 'all' || document.id === documentFilter;
    const matchesUploader = enterpriseUploaderName(document, user, members)
      .toLowerCase()
      .includes(uploaderFilter.trim().toLowerCase());
    return matchesLibrary && matchesUploader;
  });

  function reset() {
    onClearSearch();
    onDocumentFilterChange('all');
    setChunkFilter('');
    setUploaderFilter('');
  }

  function toggleChatLibrary(documentId: string) {
    const nextIds = selectedKnowledgeDocumentIds.includes(documentId)
      ? selectedKnowledgeDocumentIds.filter((id) => id !== documentId)
      : [...selectedKnowledgeDocumentIds, documentId];
    onSelectedKnowledgeDocumentIdsChange(nextIds);
  }

  return (
    <section className="enterprise-page personal-page">
      <PageHeading
        eyebrow={currentNavLabel}
        title="企业知识库"
        description="查看当前企业工作区中的知识片段，支持关键词检索，并可基于企业知识片段发起 RAG 问答。"
        actionLabel={loading ? '刷新中' : '刷新'}
        actionIcon={RefreshCw}
        onAction={onRefresh}
      />
      <EnterpriseIsolationNotice />
      <Feedback error={error} notice={notice} />

      <MetricGrid
        metrics={[
          { label: '知识库状态', value: profile.knowledgeStatusText },
          { label: '企业文档数量', value: String(knowledgeBase?.document_count ?? profile.documentCount) },
          { label: '企业知识片段', value: String(knowledgeBase?.chunk_count ?? profile.chunkCount) },
          { label: '最近更新时间', value: formatDate(profile.latestUpdatedAt) },
          { label: '可问答状态', value: profile.canAsk ? '可用于企业 RAG 问答' : '暂不可用' },
          { label: '向量索引状态', value: profile.canAsk ? '可检索' : '需要更新' }
        ]}
      />

      <form
        className="personal-search enterprise-search"
        onSubmit={(event) => {
          event.preventDefault();
          void onSearch();
        }}
      >
        <input
          className="standalone-input"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="输入关键词检索企业知识片段"
        />
        <select value={documentFilter} onChange={(event) => onDocumentFilterChange(event.target.value)}>
          <option value="all">全部知识库</option>
          {documents.map((document) => (
            <option key={document.id} value={document.id}>{document.filename}</option>
          ))}
        </select>
        <input
          className="standalone-input"
          value={uploaderFilter}
          onChange={(event) => setUploaderFilter(event.target.value)}
          placeholder="上传人筛选"
        />
        <input
          className="standalone-input"
          value={chunkFilter}
          onChange={(event) => setChunkFilter(event.target.value)}
          placeholder="片段编号"
        />
        <button className="primary-action compact-action" type="submit" disabled={searching || !searchQuery.trim()}>
          <Search size={18} aria-hidden="true" />
          {searching ? '检索中' : '检索'}
        </button>
        <button className="ghost-button" type="button" onClick={reset}>重置</button>
        <span className="result-count">结果 {visibleChunks.length}</span>
      </form>

      <section className="enterprise-card personal-card">
        <SectionTitle title="文件知识库" subtitle="每个文件对应一个企业知识库，库名为文件名" />
        {visibleLibraries.length === 0 ? (
          <EmptyState text="没有找到符合筛选条件的文件知识库。" />
        ) : (
          <div className="library-card-grid">
            {visibleLibraries.map((document) => (
              <article className="library-card" key={document.id}>
                <div>
                  <strong>{document.filename}</strong>
                  <StatusBadge value={document.index_status} />
                </div>
                <DefinitionList
                  items={[
                    ['库名', document.filename],
                    ['上传人', enterpriseUploaderName(document, user, members)],
                    ['类型', document.file_type || '未知'],
                    ['解析状态', statusText(document.parse_status, 'parse')],
                    ['入库状态', statusText(document.index_status, 'index')],
                    ['片段数量', String(document.chunk_count ?? 0)],
                    ['隔离字段', document.permission_scope],
                    ['上传时间', formatDate(document.created_at)]
                  ]}
                />
                <div className="inline-actions wrap">
                  <button
                    type="button"
                    onClick={() => {
                      void onLoadDocumentContent(document);
                      setDetailDocument(document);
                    }}
                  >
                    查看整个文档
                  </button>
                  <button type="button" onClick={() => toggleChatLibrary(document.id)}>
                    {selectedKnowledgeDocumentIds.includes(document.id) ? '取消问答选择' : '选择用于问答'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onPrepareQuestion(`请基于企业知识库《${document.filename}》回答：`, [document.id])}
                  >
                    进入对话
                  </button>
                  <button type="button" onClick={() => onDocumentFilterChange(document.id)}>
                    查看片段
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {chunks.length === 0 ? (
        <EmptyState
          icon={Database}
          text="当前企业知识库暂无可检索内容，请先上传并解析企业文档。"
          actionLabel="去上传文档"
          onAction={() => onNavigate('documents')}
        />
      ) : visibleChunks.length === 0 ? (
        <EmptyState text="没有找到相关内容，请尝试更换关键词。" />
      ) : (
        <div className="chunk-card-grid">
          {visibleChunks.map((chunk) => {
            const sourceDocument = documents.find((document) => document.id === chunk.document_id);
            return (
            <article className="knowledge-snippet-card" key={chunk.id}>
              <div>
                <strong>{chunk.filename}</strong>
                <StatusBadge value={`片段 #${chunk.chunk_index + 1}`} />
              </div>
              <p>{chunk.content}</p>
              <small>
                {hasQuery ? `命中关键词：${searchQuery.trim()}` : '企业知识片段'} · 上传人：{enterpriseUploaderName(sourceDocument, user, members)}
              </small>
              <div className="inline-actions wrap">
                <button type="button" onClick={() => setDetailChunk(chunk)}>查看完整片段</button>
                <button type="button" onClick={() => onPrepareQuestion(`请基于片段 #${chunk.chunk_index + 1} 回答：`, [chunk.document_id])}>
                  基于此片段提问
                </button>
                <button type="button" onClick={() => copyText(chunk.content)}>
                  <ClipboardCopy size={16} aria-hidden="true" />
                  复制内容
                </button>
              </div>
            </article>
          );
          })}
        </div>
      )}

      {detailChunk && (
        <ChunkDetailModal
          chunk={detailChunk}
          workspace={workspace}
          keyword={searchQuery.trim()}
          onClose={() => setDetailChunk(null)}
          onAsk={() => {
            onPrepareQuestion(`请基于企业知识片段 #${detailChunk.chunk_index + 1} 回答：`, [detailChunk.document_id]);
            setDetailChunk(null);
          }}
        />
      )}

      {detailDocument && (
        <DocumentContentModal
          document={detailDocument}
          content={documentContents[detailDocument.id]?.content}
          chunkCount={documentContents[detailDocument.id]?.chunk_count ?? detailDocument.chunk_count}
          workspaceLabel="企业工作区"
          onClose={() => setDetailDocument(null)}
          onAsk={() => {
            onSelectedKnowledgeDocumentIdsChange([detailDocument.id]);
            onPrepareQuestion(`请基于企业知识库《${detailDocument.filename}》回答：`, [detailDocument.id]);
            setDetailDocument(null);
          }}
        />
      )}
    </section>
  );
}

function EnterpriseRagChat({
  currentNavLabel,
  user,
  documents,
  selectedKnowledgeDocumentIds,
  useKnowledgeBaseForChat,
  activeChatModelName,
  chunks,
  chatMessages,
  question,
  loading,
  profile,
  error,
  notice,
  onNavigate,
  onSelectedKnowledgeDocumentIdsChange,
  onUseKnowledgeBaseForChatChange,
  onQuestionChange,
  onAsk,
  onDeleteChatTurn,
  onClearChatHistory
}: EnterpriseSharedProps & {
  question: string;
  loading: boolean;
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
  onDeleteChatTurn: (messageId: string) => void;
  onClearChatHistory: () => void;
}) {
  const [detailChunk, setDetailChunk] = useState<KnowledgeChunk | null>(null);
  const canAskWithKnowledge = profile.canAsk;
  const canAsk = !useKnowledgeBaseForChat || canAskWithKnowledge;
  const history = buildQuestionHistory(chatMessages, user);
  const prompts = [
    '当前企业知识库主要包含哪些内容？',
    '请总结企业文档中的核心信息',
    '这个项目的核心功能是什么？',
    '企业工作区和个人工作区有什么区别？',
    '当前企业知识库中有哪些重要模块？',
    '请提取企业知识库中的关键概念',
    '请根据企业文档生成一份项目摘要'
  ];

  function toggleDocument(documentId: string) {
    const nextIds = selectedKnowledgeDocumentIds.includes(documentId)
      ? selectedKnowledgeDocumentIds.filter((id) => id !== documentId)
      : [...selectedKnowledgeDocumentIds, documentId];
    onSelectedKnowledgeDocumentIdsChange(nextIds);
  }

  return (
    <section className="enterprise-page personal-page">
      <PageHeading
        eyebrow={currentNavLabel}
        title="企业问答"
        description="默认使用当前企业模型进行普通对话；开启知识库后，回答会进入企业 RAG 模式并展示可追溯引用来源。"
      />
      <EnterpriseIsolationNotice />
      <Feedback error={error} notice={notice} />

      <div className="chat-status-strip enterprise-status-strip">
        <article><span>知识库状态</span><strong>{profile.knowledgeStatusText}</strong></article>
        <article><span>已入库企业文档</span><strong>{profile.indexedCount}</strong></article>
        <article><span>企业知识片段</span><strong>{profile.chunkCount}</strong></article>
        <article><span>回答模式</span><strong>{useKnowledgeBaseForChat ? '企业 RAG 知识库问答' : '普通大模型对话'}</strong></article>
        <article><span>当前模型</span><strong>{activeChatModelName}</strong></article>
        <article><span>当前权限范围</span><strong>{roleText(profile.role)}</strong></article>
      </div>

      {useKnowledgeBaseForChat && !canAskWithKnowledge && (
        <div className="personal-callout warning">
          <span>已开启企业知识库问答，但当前企业工作区还没有可检索文档。可以关闭知识库进行普通对话，或先上传并解析企业文档。</span>
          <button type="button" onClick={() => onNavigate('documents')}>去上传企业文档</button>
        </div>
      )}

      <section className="enterprise-card personal-card">
        <label className="chat-mode-toggle">
          <input
            type="checkbox"
            checked={useKnowledgeBaseForChat}
            onChange={(event) => onUseKnowledgeBaseForChatChange(event.target.checked)}
          />
          <span>
            <strong>使用企业知识库回答</strong>
            <small>关闭时为普通大模型对话；开启后只在当前企业工作区知识库中检索引用。</small>
          </span>
        </label>
        <SectionTitle
          title="问答知识库范围"
          subtitle={
            useKnowledgeBaseForChat
              ? selectedKnowledgeDocumentIds.length
                ? `已选择 ${selectedKnowledgeDocumentIds.length} 个企业知识库`
                : '开启知识库且未选择时默认使用全部企业文件知识库'
              : '当前未使用知识库，所选范围不会参与本次普通对话'
          }
        />
        {documents.length === 0 ? (
          <EmptyState text="暂无可选择的企业文件知识库。" />
        ) : (
          <div className="library-selector-grid">
            {documents.map((document) => (
              <label key={document.id} className="library-selector-item">
                <input
                  type="checkbox"
                  checked={selectedKnowledgeDocumentIds.includes(document.id)}
                  disabled={!useKnowledgeBaseForChat}
                  onChange={() => toggleDocument(document.id)}
                />
                <span>{document.filename}</span>
                <small>{document.chunk_count ?? 0} 个片段</small>
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="enterprise-card personal-card">
        <SectionTitle title="推荐问题" subtitle="点击后会填入输入框" />
        <div className="prompt-grid">
          {prompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => onQuestionChange(prompt)}>
              <Sparkles size={16} aria-hidden="true" />
              {prompt}
            </button>
          ))}
        </div>
      </section>

      <div className="chat-layout">
        <section className="enterprise-card personal-card">
          <SectionTitle
            title="企业问答输入"
            subtitle={`当前模型：${activeChatModelName} · ${useKnowledgeBaseForChat ? '使用企业知识库 RAG 回答' : '普通对话，不检索知识库'}`}
          />
          <form
            className="personal-chat-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void onAsk();
            }}
          >
            <textarea
              value={question}
              onChange={(event) => onQuestionChange(event.target.value)}
              placeholder={useKnowledgeBaseForChat ? '输入要向企业知识库提问的问题' : '输入问题，直接使用当前企业模型正常对话'}
              disabled={!canAsk || loading}
            />
            <div className="inline-actions wrap">
              <button className="primary-action compact-action" type="submit" disabled={!canAsk || loading || !question.trim()}>
                <Bot size={18} aria-hidden="true" />
                {loading ? '生成中' : '提问'}
              </button>
              <button className="ghost-button" type="button" onClick={() => onQuestionChange('')} disabled={loading || !question}>
                清空
              </button>
            </div>
          </form>

          <div className="personal-chat-thread" aria-live="polite">
            {chatMessages.length === 0 ? (
              <EmptyState text={useKnowledgeBaseForChat ? '企业 RAG 回答会显示引用来源。' : '默认普通对话不会检索企业知识库；需要引用文档时请打开“使用企业知识库回答”。'} />
            ) : (
              chatMessages.map((message) => (
                <article className={`personal-message ${message.role}`} key={message.id}>
                  <div className="personal-message-bubble">
                    <strong>{message.role === 'user' ? `提问人：${getDisplayName(user)}` : '企业知识助手'}</strong>
                    <span>
                      {message.role === 'assistant'
                        ? `回答模式：${message.useKnowledgeBase ? '企业 RAG 知识库问答' : '普通大模型对话'}${message.modelName ? ` · 模型：${message.modelName}` : ''}`
                        : formatDate(message.createdAt)}
                    </span>
                    <p>{message.content}</p>
                  </div>
                  {loading && message.role === 'user' && (
                    <div className="personal-message-bubble">
                      <div className="skeleton-line" />
                      <div className="skeleton-line" />
                    </div>
                  )}
                  {message.sources && message.sources.length > 0 && (
                    <div className="source-list">
                      <span>引用来源</span>
                      {message.sources.map((source) => (
                        <article key={source.id}>
                          <strong>{source.filename}</strong>
                          <small>
                            片段 #{source.chunk_index + 1}
                            {typeof source.score === 'number' ? ` · 相似度 ${source.score.toFixed(2)}` : ''}
                          </small>
                          <p>{summarize(source.content, 120)}</p>
                          <button type="button" onClick={() => setDetailChunk(source)}>查看片段</button>
                        </article>
                      ))}
                    </div>
                  )}
                  {message.role === 'assistant' && message.useKnowledgeBase && (!message.sources || message.sources.length === 0) && (
                    <div className="source-list">
                      <span>引用来源</span>
                      <article>
                        <p>本次回答未返回引用来源</p>
                      </article>
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="enterprise-card personal-card">
          <SectionTitle title="企业问答历史" subtitle="当前会话记录" />
          {history.length === 0 ? (
            <EmptyState text="暂无企业问答历史。" />
          ) : (
            <div className="personal-list">
              {history.map((item) => (
                <article key={item.id}>
                  <strong>{item.question}</strong>
                  <span>{item.asker}</span>
                  <small>{formatDate(item.createdAt)}</small>
                  <div className="inline-actions wrap">
                    <button type="button" onClick={() => onQuestionChange(item.question)}>继续问答</button>
                    <button className="danger-link" type="button" onClick={() => onDeleteChatTurn(item.id)}>删除</button>
                  </div>
                </article>
              ))}
              <button className="ghost-button" type="button" onClick={onClearChatHistory}>
                清空当前会话历史
              </button>
            </div>
          )}
          <DefinitionList
            items={[
              ['已入库文档', String(documents.filter((item) => item.index_status === 'indexed').length)],
              ['知识片段', String(chunks.length)],
              ['没有检索到内容时', '请换个问题或先补充企业文档']
            ]}
          />
        </aside>
      </div>

      {detailChunk && (
        <ChunkDetailModal
          chunk={detailChunk}
          keyword=""
          onClose={() => setDetailChunk(null)}
          onAsk={() => {
            onQuestionChange(`请基于企业知识片段 #${detailChunk.chunk_index + 1} 继续分析。`);
            setDetailChunk(null);
          }}
        />
      )}
    </section>
  );
}

interface EnterpriseModelApiForm {
  provider: string;
  model_name: string;
  api_key: string;
  base_url: string;
  temperature: string;
  max_tokens: string;
  enable_rag: boolean;
  return_sources: boolean;
}

const enterpriseModelCatalog = [
  { key: 'deepseek', label: 'DeepSeek', models: ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-r1', 'deepseek-v3'], baseUrl: 'https://api.deepseek.com' },
  { key: 'chatgpt', label: 'ChatGPT', models: ['gpt-5', 'gpt-4o', 'gpt-4.1', 'o4-mini'], baseUrl: 'https://api.openai.com/v1' },
  { key: 'opus', label: 'Opus', models: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-6'], baseUrl: 'https://api.anthropic.com/v1' },
  { key: 'glm', label: 'GLM', models: ['glm-5.2', 'glm-5', 'glm-4.7-flash', 'glm-4.6'], baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { key: 'qianwen', label: 'Qianwen', models: ['qwen3-235b-a22b', 'qwen-max', 'qwen-plus', 'qwen-turbo', 'qwq-32b'], baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { key: 'doubao', label: 'Doubao', models: ['doubao-pro-4k', 'doubao-pro-32k', 'doubao-lite'], baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
  { key: 'gemini', label: 'Gemini', models: ['gemini-3.1-pro', 'gemini-flash'], baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  { key: 'kimi', label: 'Kimi', models: ['moonshot-v1-128k', 'kimi-k2.5'], baseUrl: 'https://api.moonshot.cn/v1' },
  { key: 'minimax', label: 'MiniMax', models: ['minimax-m2.5'], baseUrl: 'https://api.minimax.chat/v1' },
  { key: 'ernie', label: 'ERNIE', models: ['ernie-4.0'], baseUrl: 'https://qianfan.baidubce.com/v2' },
  { key: 'grok', label: 'Grok', models: ['grok-2'], baseUrl: 'https://api.x.ai/v1' }
];

const legacyEnterpriseModelCatalog = [
  {
    key: 'deepseek',
    label: 'DeepSeek',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-r1', 'deepseek-v3', 'deepseek-r1-distill-qwen-7b', 'deepseek-r1-distill-qwen-14b'],
    baseUrl: 'https://api.deepseek.com'
  },
  {
    key: 'chatgpt',
    label: 'ChatGPT',
    models: ['gpt-5', 'gpt-4o', 'gpt-4.1', 'o4-mini', 'o3', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    baseUrl: 'https://api.openai.com/v1'
  },
  {
    key: 'opus',
    label: 'Opus',
    models: ['claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-6'],
    baseUrl: 'https://api.anthropic.com/v1'
  },
  {
    key: 'glm',
    label: 'GLM',
    models: ['glm-5.2', 'glm-5.1', 'glm-5', 'glm-5-turbo', 'glm-4.7', 'glm-4.7-flash', 'glm-4.6', 'glm-4.5-air', 'glm-4.5', 'glm-4-long', 'glm-4-flash', 'glm-4v', 'glm-5v-turbo', 'glm-4.6v', 'cogview-3', 'cogvideox-3', 'glm-tts', 'codegeex-4', 'embedding-3'],
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4'
  },
  {
    key: 'qianwen',
    label: '千问',
    models: ['qwen3-235b-a22b', 'qwen3-max-2026-01-23', 'qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen3.6-plus', 'qwen3.5-plus', 'qwen3-coder-plus', 'qwen3-coder-next', 'qwq-32b'],
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  },
  {
    key: 'doubao',
    label: '豆包',
    models: ['doubao-pro-4k', 'doubao-pro-32k', 'doubao-lite', 'doubao-1-5-thinking-pro-250415', 'doubao-seed-2.0'],
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3'
  },
  {
    key: 'gemini',
    label: 'Gemini',
    models: ['gemini-3.1-pro', 'gemini-flash'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai'
  },
  {
    key: 'kimi',
    label: 'Kimi',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'kimi-k2.5'],
    baseUrl: 'https://api.moonshot.cn/v1'
  },
  {
    key: 'minimax',
    label: 'MiniMax',
    models: ['minimax-m2.5'],
    baseUrl: 'https://api.minimax.chat/v1'
  },
  {
    key: 'ernie',
    label: '文心一言',
    models: ['ernie-4.0'],
    baseUrl: 'https://qianfan.baidubce.com/v2'
  },
  {
    key: 'grok',
    label: 'Grok',
    models: ['grok-1', 'grok-2'],
    baseUrl: 'https://api.x.ai/v1'
  }
];

function enterpriseModelApiDefaults(): Record<string, unknown> {
  return {
    provider: 'deepseek',
    model_name: 'deepseek-v4-flash',
    api_key: '',
    base_url: 'https://api.deepseek.com',
    temperature: 0.2,
    max_tokens: 4096,
    enable_rag: true,
    return_sources: true,
    api_key_configured: false,
    api_key_masked: ''
  };
}

function getEnterpriseSettingValue(
  settings: WorkspaceSettingRecord[],
  key: string,
  fallback: Record<string, unknown>
) {
  return {
    ...fallback,
    ...(settings.find((item) => item.setting_key === key)?.setting_value ?? {})
  };
}

function toEnterpriseModelApiForm(value: Record<string, unknown>): EnterpriseModelApiForm {
  return {
    provider: enterpriseStringSetting(value.provider, 'deepseek'),
    model_name: enterpriseStringSetting(value.model_name, 'deepseek-v4-flash'),
    api_key: '',
    base_url: enterpriseStringSetting(value.base_url, 'https://api.deepseek.com'),
    temperature: enterpriseStringSetting(value.temperature, '0.2'),
    max_tokens: enterpriseStringSetting(value.max_tokens, '4096'),
    enable_rag: enterpriseBooleanSetting(value.enable_rag, true),
    return_sources: enterpriseBooleanSetting(value.return_sources, true)
  };
}

function enterpriseStringSetting(value: unknown, fallback: string) {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function enterpriseBooleanSetting(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function EnterpriseSettings({
  currentNavLabel,
  user,
  workspace,
  members,
  profile,
  workspaceSettings,
  settingSavingKey,
  settingTestingKey,
  error,
  notice,
  onSaveWorkspaceSetting,
  onTestWorkspaceModelConnection
}: EnterpriseSharedProps) {
  const modelApiConfig = getEnterpriseSettingValue(
    workspaceSettings,
    'enterprise_model_api_config',
    enterpriseModelApiDefaults()
  );
  const [apiForm, setApiForm] = useState(() => toEnterpriseModelApiForm(modelApiConfig));

  useEffect(() => {
    setApiForm(toEnterpriseModelApiForm(modelApiConfig));
  }, [workspace.id, JSON.stringify(modelApiConfig)]);

  const modelOptions = enterpriseModelCatalog.find((item) => item.key === apiForm.provider)?.models ?? [];
  const isApiSaving = settingSavingKey === 'enterprise_model_api_config';
  const isApiTesting = settingTestingKey === 'enterprise_model_api_config';
  const keyConfigured = Boolean(modelApiConfig.api_key_configured);
  const keyMasked = String(modelApiConfig.api_key_masked || '');
  const canManageSettings = profile.role === 'owner' || profile.role === 'admin';
  const apiBaseline = useMemo(() => toEnterpriseModelApiForm(modelApiConfig), [workspace.id, JSON.stringify(modelApiConfig)]);
  const apiDirty = JSON.stringify(apiForm) !== JSON.stringify(apiBaseline);

  function updateApiField(field: keyof EnterpriseModelApiForm, value: string | boolean) {
    setApiForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'provider') {
        const provider = enterpriseModelCatalog.find((item) => item.key === value);
        next.model_name = provider?.models[0] ?? current.model_name;
        next.base_url = provider?.baseUrl ?? current.base_url;
      }
      return next;
    });
  }

  function restoreApiDefaults() {
    setApiForm(toEnterpriseModelApiForm(enterpriseModelApiDefaults()));
  }

  function apiFormPayload() {
    return {
      provider: apiForm.provider,
      model_name: apiForm.model_name,
      api_key: apiForm.api_key,
      base_url: apiForm.base_url,
      temperature: Number(apiForm.temperature),
      max_tokens: Number(apiForm.max_tokens),
      enable_rag: apiForm.enable_rag,
      return_sources: apiForm.return_sources
    };
  }

  async function handleApiSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageSettings) return;
    await onSaveWorkspaceSetting('enterprise_model_api_config', apiFormPayload());
    setApiForm((current) => ({ ...current, api_key: '' }));
  }

  function handleApiConnectionTest() {
    if (!canManageSettings) return;
    void onTestWorkspaceModelConnection('enterprise_model_api_config', apiFormPayload());
  }

  return (
    <section className="enterprise-page personal-page">
      <PageHeading
        eyebrow={currentNavLabel}
        title="企业设置"
        description="查看企业基础信息、配置企业模型 API、管理权限说明、存储信息和安全隔离边界。"
      />
      <EnterpriseIsolationNotice />
      <Feedback error={error} notice={notice} />

      <div className="settings-grid">
        <section className="enterprise-card personal-card">
          <SectionTitle title="基础信息" subtitle="当前企业空间" />
          <DefinitionList
            items={[
              ['企业名称', workspace.name],
              ['当前空间', '企业工作区'],
              ['当前用户', getDisplayName(user)],
              ['邮箱', maskEmail(user.email)],
              ['当前用户角色', roleText(profile.role)],
              ['工作区标识', shortId(workspace.id)],
              ['文档数量', String(profile.documentCount)],
              ['知识片段数量', String(profile.chunkCount)],
              ['成员数量', String(profile.memberCount)]
            ]}
          />
        </section>

        <form className="enterprise-card personal-card config-form full" onSubmit={handleApiSubmit}>
          <SectionTitle
            title="企业模型 API"
            subtitle="企业区通过 API Key 自行切换模型供应商和模型版本，问答时优先调用该接口"
          />
          <div className="config-summary">
            <StatusBadge value={keyConfigured ? 'configured' : 'pending'} />
            <span>{keyConfigured ? `API Key 已配置：${keyMasked}` : '尚未配置企业模型 API Key'}</span>
          </div>
          {!canManageSettings && (
            <div className="personal-callout warning">
              <span>当前角色无权限修改企业模型 API 配置，仅 owner/admin 可保存。</span>
            </div>
          )}
          {apiDirty && (
            <div className="personal-callout warning">
              <span>存在未保存更改。</span>
            </div>
          )}
          <fieldset className="config-fieldset" disabled={!canManageSettings || isApiSaving}>
            <div className="config-form-grid three">
              <label>
                <span>模型供应商</span>
                <select value={apiForm.provider} onChange={(event) => updateApiField('provider', event.target.value)}>
                  {enterpriseModelCatalog.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>模型版本</span>
                <select value={apiForm.model_name} onChange={(event) => updateApiField('model_name', event.target.value)}>
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Base URL</span>
                <input value={apiForm.base_url} onChange={(event) => updateApiField('base_url', event.target.value)} />
              </label>
              <label>
                <span>API Key</span>
                <input
                  type="password"
                  placeholder={keyConfigured ? '留空则继续使用已保存 Key' : '输入企业模型 API Key'}
                  value={apiForm.api_key}
                  onChange={(event) => updateApiField('api_key', event.target.value)}
                />
              </label>
              <label>
                <span>temperature：{apiForm.temperature}</span>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={apiForm.temperature}
                  onChange={(event) => updateApiField('temperature', event.target.value)}
                />
              </label>
              <label>
                <span>最大回答长度</span>
                <input
                  type="number"
                  min="256"
                  max="8192"
                  step="256"
                  value={apiForm.max_tokens}
                  onChange={(event) => updateApiField('max_tokens', event.target.value)}
                />
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={apiForm.enable_rag}
                  onChange={(event) => updateApiField('enable_rag', event.target.checked)}
                />
                <span>启用企业 RAG</span>
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={apiForm.return_sources}
                  onChange={(event) => updateApiField('return_sources', event.target.checked)}
                />
                <span>返回引用来源</span>
              </label>
            </div>
          </fieldset>
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={!canManageSettings || isApiSaving}>
              {isApiSaving ? '保存中...' : '保存企业模型 API'}
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={handleApiConnectionTest}
              disabled={!canManageSettings || isApiSaving || isApiTesting}
              title="???????? API ??????????"
            >
              {isApiTesting ? '???...' : '????'}
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={restoreApiDefaults}
              disabled={!canManageSettings || isApiSaving}
            >
              恢复默认配置
            </button>
          </div>
        </form>

        <section className="enterprise-card personal-card">
          <SectionTitle title="权限配置" subtitle="企业工作区角色说明" />
          <div className="role-grid">
            {roleDescriptions(members).map((item) => (
              <article key={item.role}>
                <strong>{item.role}</strong>
                <span>{item.description}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="enterprise-card personal-card">
          <SectionTitle title="存储配置" subtitle="企业知识资产占用" />
          <DefinitionList
            items={[
              ['企业文档数量', String(profile.documentCount)],
              ['企业知识片段数量', String(profile.chunkCount)],
              ['存储占用', '暂无'],
              ['最近清理时间', '暂无']
            ]}
          />
          <button className="ghost-button" type="button" disabled title="暂未开放">
            清理缓存
          </button>
        </section>

        <section className="enterprise-card personal-card full">
          <SectionTitle title="安全与隔离说明" subtitle="企业版核心边界" />
          <ul className="security-list">
            <li>当前为企业工作区。</li>
            <li>企业工作区数据仅当前企业成员在权限范围内可见。</li>
            <li>不会同步到个人工作区。</li>
            <li>不支持企业数据复制到个人空间。</li>
            <li>不支持个人数据导入企业空间。</li>
            <li>所有企业问答、文档、知识片段、向量索引和审计日志均限定在当前企业工作区内。</li>
          </ul>
        </section>
      </div>
    </section>
  );
}

function EnterpriseAdvancedDashboard({
  currentNavLabel,
  user,
  documents,
  chunks,
  members,
  auditLogs,
  chatMessages,
  notifications,
  profile,
  overview,
  graph,
  selectedGraphDocumentIds,
  loading,
  error,
  notice,
  onNavigate,
  onRefresh,
  onRebuildGraph,
  onSearchQueryChange,
  onKnowledgeDocumentFilterChange,
  onSelectedGraphDocumentIdsChange,
  onSearchGraphNodes,
  onLoadGraphNodeDetail,
  onLoadGraphNeighbors
}: EnterpriseSharedProps & {
  overview: AdvancedOverview | null;
  graph: KnowledgeGraph | null;
  loading: boolean;
  onRefresh: () => void;
  onRebuildGraph: () => void;
  onSearchQueryChange: (value: string) => void;
  onKnowledgeDocumentFilterChange: (documentId: string) => void;
}) {
  const operations = buildEnterpriseOperations(documents, auditLogs, chatMessages, notifications, user, members).slice(0, 8);
  const analysis = buildEnterpriseAssetAnalysis(documents, chunks, members, chatMessages);
  const combinedActivityItems = [
    ...notifications.slice(0, 4).map((item) => ({
      id: `notice-${item.id}`,
      badge: notificationType(item.action),
      title: item.title,
      description: item.message,
      timeLabel: formatDate(item.created_at),
      status: item.level === 'error' ? 'failed' : 'success'
    })),
    ...operations
      .filter((item) => !item.id.startsWith('notice-'))
      .slice(0, 6)
      .map((item) => ({
        id: `operation-${item.id}`,
        badge: item.type,
        title: item.type,
        description: `${item.target} · ${item.actor}`,
        timeLabel: formatDate(item.createdAt),
        status: item.status
      }))
  ].slice(0, 10);

  return (
    <section className="enterprise-page personal-page">
      <PageHeading
        eyebrow={currentNavLabel}
        title="高级驾驶舱"
        description="集中查看企业知识资产、知识图谱、问答动态、成员动态和系统运行状态。"
        actionLabel={loading ? '刷新中' : '刷新'}
        actionIcon={RefreshCw}
        onAction={onRefresh}
      />
      <EnterpriseIsolationNotice />
      <Feedback error={error} notice={notice} />

      <MetricGrid
        metrics={[
          { label: '企业文档数量', value: String(overview?.document_count ?? profile.documentCount) },
          { label: '企业知识片段', value: String(overview?.chunk_count ?? profile.chunkCount) },
          { label: '成员数量', value: String(overview?.member_count ?? profile.memberCount) },
          { label: '问答次数', value: String(profile.qaCount) },
          { label: '审计事件', value: String(overview?.audit_log_count ?? profile.auditCount) },
          { label: '知识库状态', value: profile.knowledgeStatusText }
        ]}
      />

      <section className="enterprise-card personal-card graph-card-wide graph-card-expanded">
        <KnowledgeGraphExplorer
          graph={graph}
          loading={loading}
          documents={documents}
          selectedDocumentIds={selectedGraphDocumentIds}
          workspaceLabel="企业工作区"
          onOpenDocument={(documentId) => {
            onKnowledgeDocumentFilterChange(documentId);
            onNavigate('documents');
          }}
          onSearchKnowledge={(keyword) => {
            onSearchQueryChange(keyword);
            onNavigate('knowledge');
          }}
          onOpenQuestion={() => onNavigate('chat')}
          onDocumentSelectionChange={onSelectedGraphDocumentIdsChange}
          onSearchGraphNodes={onSearchGraphNodes}
          onLoadGraphNodeDetail={onLoadGraphNodeDetail}
          onLoadGraphNeighbors={onLoadGraphNeighbors}
          onRefresh={onRefresh}
          onRebuild={onRebuildGraph}
        />
      </section>

      <div className="enterprise-dashboard-grid personal-dashboard-grid advanced-support-grid">
        <section className="enterprise-card personal-card combined-activity-card">
          <SectionTitle title="企业状态与操作记录" subtitle="通知、审计和最近操作合并展示" />
          {combinedActivityItems.length === 0 ? (
            <EmptyState text="暂无企业状态和操作记录。" />
          ) : (
            <div className="combined-activity-list">
              {combinedActivityItems.map((item) => (
                <article key={item.id} className="combined-activity-item">
                  <StatusBadge value={item.badge} />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                    <small>{item.timeLabel}</small>
                  </div>
                  <StatusBadge value={item.status} />
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="enterprise-card personal-card">
          <SectionTitle title="企业知识资产分析" subtitle="文档、片段、关键词和成员贡献" />
          <AnalysisBlock title="文档类型分布" items={analysis.types} />
          <AnalysisBlock title="知识片段来源分布" items={analysis.sources} />
          <AnalysisBlock title="高频关键词" items={analysis.keywords} />
          <AnalysisBlock title="最近活跃趋势" items={analysis.trends} />
          <AnalysisBlock title="成员贡献排行" items={analysis.contributors} />
          <AnalysisBlock title="问答活跃度" items={analysis.qa} />
        </section>
      </div>
    </section>
  );
}

function EnterpriseMembers({
  currentNavLabel,
  user,
  members,
  profile,
  loading,
  saving,
  actionMemberId,
  email,
  department,
  role,
  canGrantAdmin,
  error,
  notice,
  onEmailChange,
  onDepartmentChange,
  onRoleChange,
  onAddMember,
  onUpdateRole,
  onUpdateDepartment,
  onRemoveMember,
  onRefresh
}: EnterpriseSharedProps & {
  loading: boolean;
  saving: boolean;
  actionMemberId: string | null;
  email: string;
  department: string;
  role: WorkspaceRole;
  canGrantAdmin: boolean;
  onEmailChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onRoleChange: (value: WorkspaceRole) => void;
  onAddMember: () => void;
  onUpdateRole: (member: WorkspaceMember, role: WorkspaceRole) => void;
  onUpdateDepartment: (member: WorkspaceMember, department: string) => void;
  onRemoveMember: (member: WorkspaceMember) => void;
  onRefresh: () => void;
}) {
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const departments = unique(members.map((member) => member.department || '未设置'));
  const availableRoleOptions = canGrantAdmin
    ? roleOptions
    : roleOptions.filter((option) => option.value !== 'admin');
  const visibleMembers = members.filter((member) => {
    const matchesKeyword = `${member.username} ${member.email}`.toLowerCase().includes(keyword.trim().toLowerCase());
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    const matchesDepartment = departmentFilter === 'all' || (member.department || '未设置') === departmentFilter;
    return matchesKeyword && matchesRole && matchesDepartment;
  });
  const roleCounts = {
    owner: members.filter((member) => member.role === 'owner').length,
    admin: members.filter((member) => member.role === 'admin').length,
    member: members.filter((member) => member.role === 'member').length,
    viewer: members.filter((member) => member.role === 'viewer').length,
    noDepartment: members.filter((member) => !member.department).length
  };

  function submitAddMember(event: FormEvent) {
    event.preventDefault();
    void onAddMember();
  }

  return (
    <section className="enterprise-page personal-page">
      <PageHeading
        eyebrow={currentNavLabel}
        title="成员管理"
        description="查看企业工作区成员，管理角色、部门和协作权限。"
        actionLabel={loading ? '刷新中' : '刷新'}
        actionIcon={RefreshCw}
        onAction={onRefresh}
      />
      <EnterpriseIsolationNotice />
      <Feedback error={error} notice={notice} />

      <MetricGrid
        metrics={[
          { label: '成员总数', value: String(members.length) },
          { label: 'owner 数量', value: String(roleCounts.owner) },
          { label: 'admin 数量', value: String(roleCounts.admin) },
          { label: 'member 数量', value: String(roleCounts.member) },
          { label: 'viewer 数量', value: String(roleCounts.viewer) },
          { label: '未设置部门', value: String(roleCounts.noDepartment), tone: roleCounts.noDepartment ? 'warning' : 'normal' }
        ]}
      />

      {profile.canManageMembers ? (
        <form className="enterprise-card personal-card member-form-grid" onSubmit={submitAddMember}>
          <label>
            邮箱
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="成员已注册邮箱"
            />
          </label>
          <label>
            角色
            <select value={role} onChange={(event) => onRoleChange(event.target.value as WorkspaceRole)}>
              {availableRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            部门
            <input value={department} onChange={(event) => onDepartmentChange(event.target.value)} placeholder="例如：产品部" />
          </label>
          <button className="primary-action compact-action" type="submit" disabled={saving || !email.trim()}>
            <UserPlus size={18} aria-hidden="true" />
            {saving ? '添加中' : '添加成员'}
          </button>
        </form>
      ) : (
        <div className="personal-callout warning">
          <span>当前角色无权限执行成员管理操作。</span>
        </div>
      )}

      <div className="enterprise-filter-bar filter-bar">
        <input
          className="standalone-input"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="按邮箱 / 名称搜索"
        />
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
          <option value="all">全部角色</option>
          <option value="owner">owner</option>
          <option value="admin">admin</option>
          <option value="member">member</option>
          <option value="viewer">viewer</option>
        </select>
        <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
          <option value="all">全部部门</option>
          {departments.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <button
          className="ghost-button"
          type="button"
          onClick={() => {
            setKeyword('');
            setRoleFilter('all');
            setDepartmentFilter('all');
          }}
        >
          重置筛选
        </button>
      </div>

      <section className="enterprise-card personal-card">
        <SectionTitle title="成员列表" subtitle={`${visibleMembers.length} 位成员`} />
        {members.length === 0 ? (
          <EmptyState text="当前企业工作区还没有成员。" />
        ) : visibleMembers.length === 0 ? (
          <EmptyState text="没有找到相关成员，请尝试更换关键词。" />
        ) : (
          <div className="compact-scroll">
            <div className="personal-table">
              <div className="personal-table-head enterprise-member-row">
                <span>成员名称</span>
                <span>邮箱</span>
                <span>角色</span>
                <span>部门</span>
                <span>加入时间</span>
                <span>最近操作</span>
                <span>操作</span>
              </div>
              {visibleMembers.map((member) => {
                const isProtectedOwner = member.role === 'owner';
                const isCurrentUser = member.user_id === user.id;
                const canEdit = profile.canManageMembers && !isProtectedOwner && !isCurrentUser;
                return (
                  <div className="personal-table-row enterprise-member-row" key={member.id}>
                    <strong>{getMemberDisplayName(member)}</strong>
                    <span>{maskEmail(member.email)}</span>
                    <span>
                      {canEdit ? (
                        <select
                          value={member.role}
                          disabled={actionMemberId === member.id}
                          onChange={(event) => onUpdateRole(member, event.target.value as WorkspaceRole)}
                        >
                          {availableRoleOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge value={member.role} />
                      )}
                    </span>
                    <span>
                      {canEdit ? (
                        <input
                          className="standalone-input compact-input"
                          defaultValue={member.department || ''}
                          placeholder="未设置"
                          disabled={actionMemberId === member.id}
                          onBlur={(event) => {
                            const nextDepartment = event.target.value.trim();
                            if (nextDepartment !== (member.department || '')) {
                              onUpdateDepartment(member, nextDepartment);
                            }
                          }}
                        />
                      ) : (
                        member.department || '未设置'
                      )}
                    </span>
                    <span>{formatDate(member.joined_at)}</span>
                    <span>暂无</span>
                    <div className="inline-actions">
                      <button
                        className="danger-link"
                        type="button"
                        disabled={!canEdit || actionMemberId === member.id}
                        title={!canEdit ? '当前角色无权限、不能移除 owner 或不能移除当前登录用户。' : undefined}
                        onClick={() => onRemoveMember(member)}
                      >
                        移除成员
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </section>
  );
}

function EnterpriseAuditLogs({
  currentNavLabel,
  user,
  members,
  auditLogs,
  profile,
  loading,
  error,
  notice,
  deletingAuditLogId,
  auditBulkDeleting,
  auditRetentionDeleting,
  onRefresh,
  onDeleteAuditLog,
  onDeleteAllAuditLogs,
  onDeleteAuditLogsByRetention
}: EnterpriseSharedProps & {
  loading: boolean;
  deletingAuditLogId: string | null;
  auditBulkDeleting: boolean;
  auditRetentionDeleting: boolean;
  onRefresh: () => void;
  onDeleteAuditLog: (log: AuditLogRecord) => void;
  onDeleteAllAuditLogs: () => void;
  onDeleteAuditLogsByRetention: (retentionDays: number) => void;
}) {
  const [actionFilter, setActionFilter] = useState('all');
  const [actorFilter, setActorFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retentionDays, setRetentionDays] = useState(30);
  const todayCount = auditLogs.filter((log) => isToday(log.created_at)).length;
  const visibleLogs = auditLogs.filter((log) => {
    const status = auditStatus(log);
    const actorName = getActorName(log.user_id, members, user);
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesActor = !actorFilter.trim() || actorName.includes(actorFilter.trim());
    const matchesTarget = targetFilter === 'all' || (log.target_type || '无') === targetFilter;
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    const matchesKeyword =
      !keyword.trim() ||
      `${log.action} ${log.target_type || ''} ${log.target_id || ''} ${formatAuditDetail(log.detail)}`
        .toLowerCase()
        .includes(keyword.trim().toLowerCase());
    return matchesAction && matchesActor && matchesTarget && matchesStatus && matchesKeyword;
  });
  const actionTypes = unique(auditLogs.map((log) => log.action));
  const targetTypes = unique(auditLogs.map((log) => log.target_type || '无'));

  return (
    <section className="enterprise-page personal-page">
      <PageHeading
        eyebrow={currentNavLabel}
        title="审计日志"
        description="查看当前企业工作区最近的成员、文档、知识库和问答操作。"
        actionLabel={loading ? '刷新中' : '刷新'}
        actionIcon={RefreshCw}
        onAction={onRefresh}
      />
      <EnterpriseIsolationNotice />
      <Feedback error={error} notice={notice} />

      {!profile.canManageMembers && (
        <div className="personal-callout warning">
          <span>当前角色可能无权限查看完整审计日志，如后端拒绝访问会显示明确错误。</span>
        </div>
      )}

      <MetricGrid
        metrics={[
          { label: '今日事件数', value: String(todayCount) },
          { label: '文档事件数', value: String(auditLogs.filter((log) => log.action.includes('document')).length) },
          { label: '问答事件数', value: String(auditLogs.filter((log) => log.action.includes('chat') || log.action.includes('rag')).length) },
          { label: '成员事件数', value: String(auditLogs.filter((log) => log.action.includes('member')).length) },
          { label: '失败事件数', value: String(profile.failedOperationCount), tone: profile.failedOperationCount ? 'danger' : 'normal' },
          { label: '最近事件时间', value: formatDate(auditLogs[0]?.created_at) }
        ]}
      />

      <div className="enterprise-filter-bar audit-filter-grid">
        <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
          <option value="all">全部操作类型</option>
          {actionTypes.map((item) => (
            <option key={item} value={item}>{auditActionText(item)}</option>
          ))}
        </select>
        <input
          className="standalone-input"
          value={actorFilter}
          onChange={(event) => setActorFilter(event.target.value)}
          placeholder="操作人筛选"
        />
        <select value={targetFilter} onChange={(event) => setTargetFilter(event.target.value)}>
          <option value="all">全部目标类型</option>
          {targetTypes.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">全部状态</option>
          <option value="success">成功</option>
          <option value="failed">失败</option>
        </select>
        <input
          className="standalone-input"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="关键词搜索"
        />
        <button
          className="ghost-button"
          type="button"
          onClick={() => {
            setActionFilter('all');
            setActorFilter('');
            setTargetFilter('all');
            setStatusFilter('all');
            setKeyword('');
          }}
        >
          重置
        </button>
      </div>

      <section className="enterprise-card personal-card">
        <div className="section-title-row">
          <SectionTitle title="审计日志列表" subtitle={`${visibleLogs.length} 条事件`} />
          <div className="audit-cleanup-actions">
            <button
              className="compact-operation-delete audit-cleanup-delete"
              type="button"
              disabled={auditBulkDeleting || auditLogs.length === 0 || profile.role !== 'owner'}
              onClick={onDeleteAllAuditLogs}
            >
              <Trash2 size={15} aria-hidden="true" />
              {auditBulkDeleting ? '删除中' : '统一删除'}
            </button>
            <select
              value={retentionDays}
              onChange={(event) => setRetentionDays(Number(event.target.value))}
              disabled={auditRetentionDeleting || auditLogs.length === 0 || profile.role !== 'owner'}
              aria-label="审计日志保留天数"
            >
              <option value={7}>保留 7 天</option>
              <option value={30}>保留 30 天</option>
              <option value={90}>保留 90 天</option>
              <option value={180}>保留 180 天</option>
            </select>
            <button
              className="ghost-button audit-retention-button"
              type="button"
              disabled={auditRetentionDeleting || auditLogs.length === 0 || profile.role !== 'owner'}
              onClick={() => onDeleteAuditLogsByRetention(retentionDays)}
            >
              <History size={15} aria-hidden="true" />
              {auditRetentionDeleting ? '清理中' : '定时删除'}
            </button>
          </div>
        </div>
        {auditLogs.length === 0 ? (
          <EmptyState text="当前企业工作区暂无审计事件。" />
        ) : visibleLogs.length === 0 ? (
          <EmptyState text="没有找到相关审计事件，请调整筛选条件。" />
        ) : (
          <div className="audit-list structured">
            {visibleLogs.map((log) => (
              <article className="audit-item" key={log.id}>
                <div className="audit-main">
                  <button
                    className="audit-title-button"
                    type="button"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    {expandedId === log.id ? '收起详情' : auditActionText(log.action)}
                  </button>
                  <span>{log.action}</span>
                  <span>操作人：{getActorName(log.user_id, members, user)}</span>
                  <span>目标：{log.target_type || '无'} / {shortId(log.target_id)}</span>
                  <span>{formatDate(log.created_at)}</span>
                  <StatusBadge value={auditStatus(log)} />
                  <button
                    className="compact-operation-delete"
                    type="button"
                    disabled={profile.role !== 'owner' || deletingAuditLogId === log.id}
                    title={profile.role !== 'owner' ? '仅 owner 可以删除审计日志。' : undefined}
                    onClick={() => onDeleteAuditLog(log)}
                  >
                    {deletingAuditLogId === log.id ? '删除中' : '删除'}
                  </button>
                </div>
                <p>{metadataSummary(log.detail)}</p>
                {expandedId === log.id && (
                  <pre>{JSON.stringify(log.detail ?? {}, null, 2)}</pre>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="personal-metric-grid enterprise-metric-grid">
      {metrics.map((metric) => (
        <article className={`personal-metric ${metric.tone ?? ''}`} key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          {metric.hint && <small>{metric.hint}</small>}
        </article>
      ))}
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  actionLabel,
  actionIcon: Icon,
  onAction
}: {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionIcon?: LucideIcon;
  onAction?: () => void;
}) {
  return (
    <div className="panel-heading personal-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actionLabel && onAction && (
        <button className="ghost-button" type="button" onClick={onAction}>
          {Icon && <Icon size={18} aria-hidden="true" />}
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function EnterpriseIsolationNotice() {
  return (
    <div className="isolation-notice enterprise-isolation">
      <Info size={18} aria-hidden="true" />
      当前空间：企业工作区，数据仅在当前企业内部可见，不与个人工作区同步。
    </div>
  );
}

function Feedback({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {notice && <p className="form-success">{notice}</p>}
      {error && <p className="form-error">{error}</p>}
    </>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="section-title compact-title">
      <Layers3 size={18} aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        {subtitle && <span>{subtitle}</span>}
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}>
      <Icon size={18} aria-hidden="true" />
      {label}
    </button>
  );
}

function EmptyState({
  text,
  icon: Icon = FileSearch,
  actionLabel,
  onAction
}: {
  text: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="personal-empty">
      <Icon size={22} aria-hidden="true" />
      <span>{text}</span>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

type StatusBadgeKind = 'default' | 'parse' | 'index';

function StatusBadge({ value, kind = 'default' }: { value: string; kind?: StatusBadgeKind }) {
  return <span className={`status-badge ${statusClass(value)}`}>{statusText(value, kind)}</span>;
}

function DefinitionList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="definition-list">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || '暂无'}</dd>
        </div>
      ))}
    </dl>
  );
}

function AnalysisBlock({ title, items }: { title: string; items: Array<[string, string]> }) {
  return (
    <div className="analysis-block">
      <strong>{title}</strong>
      <div>
        {items.length === 0 ? (
          <span>暂无</span>
        ) : (
          items.map(([label, value]) => (
            <span key={`${title}-${label}`}>
              {label}：{value}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function DocumentDetailModal({
  document,
  workspace,
  uploader,
  chunkCount,
  canManage,
  onClose,
  onViewChunks,
  onAsk,
  onDelete
}: {
  document: DocumentRecord;
  workspace: Workspace;
  uploader: string;
  chunkCount: number;
  canManage: boolean;
  onClose: () => void;
  onViewChunks: () => void;
  onAsk: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="detail-modal" role="dialog" aria-modal="true" aria-label="企业文档详情">
        <SectionTitle title="企业文档详情" subtitle={document.filename} />
        <DefinitionList
          items={[
            ['文件名', document.filename],
            ['类型', document.file_type || '未知'],
            ['文件大小', '暂无'],
            ['上传人', uploader],
            ['上传时间', formatDate(document.created_at)],
            ['解析状态', statusText(document.parse_status, 'parse')],
            ['入库状态', statusText(document.index_status, 'index')],
            ['知识片段数量', String(chunkCount)],
            ['所属空间', '企业工作区'],
            ['所属企业名称', workspace.name],
            ['文档摘要', '暂无'],
            ['失败原因', document.parse_status === 'failed' || document.index_status === 'failed' ? '请查看后端日志或重新上传。' : '无']
          ]}
        />
        <div className="modal-actions">
          <button type="button" onClick={onViewChunks}>查看知识片段</button>
          <button type="button" onClick={onAsk}>基于此文档提问</button>
          <button type="button" disabled title="暂未开放">重新解析</button>
          <button className="danger-link" type="button" disabled={!canManage} onClick={onDelete}>
            删除文档
          </button>
          <button type="button" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}

function DocumentContentModal({
  document,
  content,
  chunkCount,
  workspaceLabel,
  onClose,
  onAsk
}: {
  document: DocumentRecord;
  content?: string;
  chunkCount: number;
  workspaceLabel: string;
  onClose: () => void;
  onAsk: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="detail-modal large" role="dialog" aria-modal="true" aria-label="文档全文">
        <SectionTitle title="查看整个文档" subtitle={document.filename} />
        <DefinitionList
          items={[
            ['库名', document.filename],
            ['文档 ID', document.id],
            ['工作区 ID', document.workspace_id],
            ['类型', document.file_type || '未知'],
            ['解析状态', statusText(document.parse_status, 'parse')],
            ['入库状态', statusText(document.index_status, 'index')],
            ['知识片段数量', String(chunkCount)],
            ['所属空间', workspaceLabel],
            ['隔离字段', document.permission_scope],
            ['上传时间', formatDate(document.created_at)]
          ]}
        />
        <div className="full-content">
          {content || '全文内容加载中，或当前文档暂无可展示文本。'}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onAsk}>基于此知识库提问</button>
          <button type="button" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}

function ChunkDetailModal({
  chunk,
  workspace,
  keyword,
  onClose,
  onAsk
}: {
  chunk: KnowledgeChunk;
  workspace?: Workspace;
  keyword: string;
  onClose: () => void;
  onAsk: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="detail-modal large" role="dialog" aria-modal="true" aria-label="企业知识片段详情">
        <SectionTitle title="企业知识片段详情" subtitle={chunk.filename} />
        <DefinitionList
          items={[
            ['来源文档', chunk.filename],
            ['片段编号', `#${chunk.chunk_index + 1}`],
            ['相关关键词', keyword || '暂无'],
            ['所属空间', '企业工作区'],
            ['所属企业名称', workspace?.name ?? '当前企业']
          ]}
        />
        <div className="full-content">{chunk.content}</div>
        <div className="modal-actions">
          <button type="button" onClick={onAsk}>基于此片段提问</button>
          <button type="button" onClick={() => copyText(chunk.content)}>复制内容</button>
          <button type="button" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}

function buildEnterpriseProfile(
  workspace: Workspace,
  documents: DocumentRecord[],
  knowledgeBase: KnowledgeBaseStatus | null,
  chunks: KnowledgeChunk[],
  members: WorkspaceMember[],
  auditLogs: AuditLogRecord[],
  chatMessages: EnterpriseChatMessage[],
  notifications: AdvancedNotification[],
  canManageMembers: boolean
): EnterpriseProfile {
  const role = (workspace.role || 'member') as WorkspaceRole;
  const parsedCount = documents.filter((document) => document.parse_status === 'parsed').length;
  const indexedCount = documents.filter((document) => document.index_status === 'indexed').length;
  const failedCount = documents.filter(
    (document) => document.parse_status === 'failed' || document.index_status === 'failed'
  ).length;
  const chunkCount = knowledgeBase?.chunk_count ?? chunks.length;
  const latestUpdatedAt = latestDate([
    ...documents.map((document) => document.created_at),
    ...auditLogs.map((log) => log.created_at),
    ...notifications.map((item) => item.created_at),
    ...chatMessages.map((message) => message.createdAt ?? '')
  ]);
  const latestQuestionAt = latestDate(
    chatMessages.filter((message) => message.role === 'user').map((message) => message.createdAt ?? '')
  );
  const latestParsedAt = latestDate(
    documents.filter((document) => document.parse_status === 'parsed').map((document) => document.created_at)
  );
  const knowledgeStatusRaw = knowledgeBase?.status ?? (chunkCount > 0 ? 'ready' : 'empty');
  const failedOperationCount =
    auditLogs.filter((log) => auditStatus(log) === 'failed').length + failedCount;

  return {
    role,
    documentCount: knowledgeBase?.document_count ?? documents.length,
    parsedCount,
    indexedCount,
    failedCount,
    chunkCount,
    memberCount: members.length,
    auditCount: auditLogs.length,
    qaCount: chatMessages.filter((message) => message.role === 'user').length,
    latestUpdatedAt,
    latestQuestionAt,
    latestParsedAt,
    knowledgeStatusText: knowledgeStatusText(knowledgeStatusRaw, chunkCount),
    knowledgeStatusRaw,
    canAsk: chunkCount > 0 && knowledgeStatusRaw !== 'empty',
    canUpload: role !== 'viewer',
    canManageDocs: role === 'owner' || role === 'admin',
    canManageMembers,
    failedOperationCount
  };
}

function buildEnterpriseReminders(
  profile: EnterpriseProfile,
  members: WorkspaceMember[],
  operations: Array<{ status: string }>
) {
  const reminders: Array<{ title: string; description: string; action: string; page: EnterprisePageKey }> = [];
  if (profile.documentCount > profile.parsedCount) {
    reminders.push({
      title: '有文档未解析',
      description: '请在文档管理页关注解析状态。',
      action: '去文档管理',
      page: 'documents'
    });
  }
  if (profile.documentCount > profile.indexedCount) {
    reminders.push({
      title: '有文档未入库',
      description: '知识库可能需要等待构建或重新上传。',
      action: '去知识库',
      page: 'knowledge'
    });
  }
  if (!profile.canAsk) {
    reminders.push({
      title: '企业知识库暂无可检索内容',
      description: '上传并解析企业文档后才能进行 RAG 问答。',
      action: '去文档管理',
      page: 'documents'
    });
  }
  if (members.some((member) => !member.department)) {
    reminders.push({
      title: '有成员未设置部门',
      description: '补全部门信息便于企业权限和贡献分析。',
      action: '去成员管理',
      page: 'members'
    });
  }
  if (operations.some((operation) => operation.status === '失败')) {
    reminders.push({
      title: '有最近失败操作',
      description: '请查看审计日志定位失败原因。',
      action: '去审计日志',
      page: 'audit'
    });
  }
  if (profile.knowledgeStatusRaw === 'needs_update') {
    reminders.push({
      title: '向量库需要更新',
      description: '企业知识索引状态需要关注。',
      action: '去知识库',
      page: 'knowledge'
    });
  }
  return reminders;
}

function buildQuestionHistory(messages: EnterpriseChatMessage[], user: User) {
  return messages
    .filter((message) => message.role === 'user')
    .map((message) => ({
      id: message.id,
      question: message.content,
      asker: getDisplayName(user),
      createdAt: message.createdAt ?? ''
    }))
    .reverse();
}

function buildEnterpriseOperations(
  documents: DocumentRecord[],
  auditLogs: AuditLogRecord[],
  chatMessages: EnterpriseChatMessage[],
  notifications: AdvancedNotification[],
  user: User,
  members: WorkspaceMember[]
) {
  const fromAudit = auditLogs.map((log) => ({
    id: `audit-${log.id}`,
    type: auditActionText(log.action),
    target: `${log.target_type || '目标'} ${shortId(log.target_id)}`.trim(),
    actor: getActorName(log.user_id, members, user),
    createdAt: log.created_at,
    status: auditStatus(log) === 'failed' ? '失败' : '成功'
  }));
  const fromDocs = documents.map((document) => ({
    id: `doc-${document.id}`,
    type: '上传企业文档',
    target: document.filename,
    actor: enterpriseUploaderName(document, user, members),
    createdAt: document.created_at,
    status: document.parse_status === 'failed' || document.index_status === 'failed' ? '失败' : '成功'
  }));
  const fromChat = chatMessages
    .filter((message) => message.role === 'user')
    .map((message) => ({
      id: `chat-${message.id}`,
      type: '企业问答',
      target: summarize(message.content, 30),
      actor: getDisplayName(user),
      createdAt: message.createdAt ?? '',
      status: '成功'
    }));
  const fromNotifications = notifications.map((item) => ({
    id: `notice-${item.id}`,
    type: notificationType(item.action),
    target: item.title,
    actor: '系统',
    createdAt: item.created_at,
    status: item.level === 'error' ? '失败' : '成功'
  }));
  return [...fromAudit, ...fromDocs, ...fromChat, ...fromNotifications].sort(
    (a, b) => dateValue(b.createdAt) - dateValue(a.createdAt)
  );
}

function buildEnterpriseAssetAnalysis(
  documents: DocumentRecord[],
  chunks: KnowledgeChunk[],
  members: WorkspaceMember[],
  chatMessages: EnterpriseChatMessage[]
) {
  return {
    types: countPairs(documents.map((document) => document.file_type || '未知')),
    sources: countPairs(chunks.map((chunk) => chunk.filename || '未知来源')).slice(0, 5),
    keywords: extractKeywords(chunks).slice(0, 8).map((keyword) => [keyword, '高频'] as [string, string]),
    trends: [
      ['文档上传', `${documents.length} 个`],
      ['知识片段', `${chunks.length} 条`],
      ['问答记录', `${chatMessages.filter((message) => message.role === 'user').length} 次`]
    ] as Array<[string, string]>,
    contributors: members.slice(0, 5).map((member) => [getMemberDisplayName(member), member.department || roleText(member.role)] as [string, string]),
    qa: [
      ['当前会话问答', `${chatMessages.filter((message) => message.role === 'user').length} 次`],
      ['引用来源', `${chatMessages.reduce((sum, message) => sum + (message.sources?.length ?? 0), 0)} 条`]
    ] as Array<[string, string]>
  };
}

function roleDescriptions(members: WorkspaceMember[]) {
  const existingRoles = new Set(members.map((member) => member.role));
  const descriptions: Record<WorkspaceRole, string> = {
    owner: '企业空间所有者，可管理成员、文档、设置和审计。',
    admin: '可管理文档、知识库和部分成员。',
    member: '可上传文档、检索知识库、发起问答。',
    viewer: '仅查看和问答，具体能力以后端权限为准。'
  };
  const roles: WorkspaceRole[] = ['owner', 'admin', 'member', 'viewer'];
  return roles
    .filter((role) => role === 'owner' || existingRoles.has(role) || role === 'member')
    .map((role) => ({ role, description: descriptions[role] }));
}

function statusText(value: string, kind: StatusBadgeKind = 'default') {
  const maps: Record<StatusBadgeKind, Record<string, string>> = {
    default: {
      owner: '所有者',
      admin: '管理员',
      member: '成员',
      viewer: '只读',
      empty: '暂无数据',
      ready: '可检索',
      building: '构建中',
      needs_update: '需要更新',
      uploaded: '已上传',
      pending: '待处理',
      parsing: '解析中',
      parsed: '已解析',
      indexing: '入库中',
      indexed: '已入库',
      unsupported: '暂不支持解析',
      asset_only: '仅保存',
      failed: '失败',
      success: '成功'
    },
    parse: {
      uploaded: '已上传',
      pending: '待解析',
      parsing: '解析中',
      parsed: '已解析',
      unsupported: '暂不支持解析',
      failed: '解析失败'
    },
    index: {
      pending: '待入库',
      indexing: '入库中',
      indexed: '已入库',
      asset_only: '仅保存',
      failed: '入库失败'
    }
  };
  return maps[kind][value] ?? maps.default[value] ?? value;
}

function statusClass(value: string) {
  if (value.startsWith('片段')) return 'indexed';
  return value;
}

function knowledgeStatusText(value: string, chunkCount: number) {
  if (chunkCount <= 0 || value === 'empty') return '暂无数据';
  if (value === 'building') return '构建中';
  if (value === 'needs_update') return '需要更新';
  return '可检索';
}

function roleText(role?: string | null) {
  const map: Record<string, string> = {
    owner: 'owner / 所有者',
    admin: 'admin / 管理员',
    member: 'member / 成员',
    viewer: 'viewer / 只读'
  };
  return map[role || 'member'] ?? role ?? 'member';
}

function auditActionText(action: string) {
  const map: Record<string, string> = {
    'auth.registered': '账号注册',
    'auth.login': '密码登录',
    'auth.email_code_login': '验证码登录',
    'auth.password_reset': '重置密码',
    'workspace.created': '创建工作区',
    'workspace.deleted': '删除工作区',
    'workspace.updated': '更新工作区',
    'member.added': '添加成员',
    'member.role_changed': '修改成员角色',
    'member.role_updated': '修改成员角色',
    'member.removed': '删除成员',
    'document.created': '创建文档记录',
    'document.uploaded': '上传文档',
    'document.asset_saved': '保存文件资产',
    'document.parsed': '解析文档',
    'document.deleted': '删除文档',
    'knowledge.searched': '检索知识片段',
    'rag.asked': '企业问答',
    'chat.asked': '企业问答',
    'system.error': '错误提醒'
  };
  return map[action] ?? action;
}

function notificationType(action: string) {
  if (action.includes('document') && action.includes('upload')) return '文档已上传';
  if (action.includes('document') && action.includes('asset')) return '文件资产已保存';
  if (action.includes('document') && action.includes('parsed')) return '文档解析完成';
  if (action.includes('index') || action.includes('knowledge')) return '知识库已更新';
  if (action.includes('member') && action.includes('role')) return '成员角色已变更';
  if (action.includes('member')) return '成员已加入';
  if (action.includes('chat') || action.includes('rag')) return '企业问答已完成';
  if (action.includes('error')) return '错误提醒';
  return '系统提醒';
}

function auditStatus(log: AuditLogRecord) {
  const text = `${log.action} ${formatAuditDetail(log.detail)}`.toLowerCase();
  return text.includes('fail') || text.includes('error') || text.includes('失败')
    ? 'failed'
    : 'success';
}

function metadataSummary(detail: Record<string, unknown>) {
  const text = formatAuditDetail(detail);
  return text === '无详情' ? text : summarize(text, 120);
}

function formatAuditDetail(detail: Record<string, unknown>) {
  const text = JSON.stringify(detail ?? {});
  return text === '{}' ? '无详情' : text;
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value?: string | null) {
  return formatBeijingDateTime(value);
}

function enterpriseUploaderName(
  document: DocumentRecord | undefined,
  user: User,
  members: WorkspaceMember[]
) {
  if (!document) return getDisplayName(user);
  const member = members.find((item) => item.user_id === document.user_id);
  if (member) return getMemberDisplayName(member);
  return document.user_id === user.id ? getDisplayName(user) : '未知上传人';
}

function latestDate(values: string[]) {
  const sorted = values
    .filter(Boolean)
    .map((value) => ({ value, time: dateValue(value) }))
    .filter((item) => item.time > 0)
    .sort((a, b) => b.time - a.time);
  return sorted[0]?.value ?? null;
}

function dateValue(value?: string | null) {
  return getApiDateValue(value);
}

function summarize(value: string, maxLength = 90) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text || '暂无';
  return `${text.slice(0, maxLength)}...`;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function countPairs(values: string[]) {
  const counts = values.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([label, count]) => [label, `${count}`] as [string, string]);
}

function extractKeywords(chunks: KnowledgeChunk[]) {
  const stopWords = new Set(['的', '了', '和', '是', '在', '与', '及', '一个', '当前', '企业', '知识', '平台']);
  const tokens = chunks
    .flatMap((chunk) => chunk.content.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,}/g) ?? [])
    .filter((token) => !stopWords.has(token));
  return countPairs(tokens)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([token]) => token);
}

function isToday(value: string) {
  if (dateValue(value) <= 0) return false;
  return beijingDateKey(value) === beijingDateKey(new Date().toISOString());
}

function beijingDateKey(value: string) {
  return formatBeijingDateKey(value);
}

function copyText(value: string) {
  if (navigator.clipboard) {
    void navigator.clipboard.writeText(value);
  }
}
