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
  HelpCircle,
  History,
  Info,
  Layers3,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload
} from 'lucide-react';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';

import { getDisplayName, maskEmail, shortId } from '../display';
import { formatBeijingDateTime } from '../time';
import { KnowledgeGraphExplorer } from './KnowledgeGraphExplorer';
import type {
  AdvancedNotification,
  AdvancedOverview,
  DocumentContent,
  DocumentRecord,
  KnowledgeBaseStatus,
  KnowledgeChunk,
  KnowledgeGraph,
  User,
  Workspace,
  WorkspaceModelConnectionTestResult,
  WorkspaceSettingRecord
} from '../types';

export type PersonalPageKey =
  | 'dashboard'
  | 'documents'
  | 'knowledge'
  | 'chat'
  | 'settings'
  | 'advanced';

interface PersonalChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: KnowledgeChunk[];
  modelName?: string;
  useKnowledgeBase?: boolean;
}

interface PersonalWorkspacePanelProps {
  activePage: PersonalPageKey;
  currentNavLabel: string;
  user: User;
  workspace: Workspace;
  documents: DocumentRecord[];
  knowledgeBase: KnowledgeBaseStatus | null;
  chunks: KnowledgeChunk[];
  searchQuery: string;
  searchResults: KnowledgeChunk[];
  selectedFile: File | null;
  selectedFiles: File[];
  documentContents: Record<string, DocumentContent>;
  chatQuestion: string;
  chatMessages: PersonalChatMessage[];
  selectedKnowledgeDocumentIds: string[];
  selectedGraphDocumentIds: string[];
  useKnowledgeBaseForChat: boolean;
  activeChatModelName: string;
  workspaceSettings: WorkspaceSettingRecord[];
  advancedOverview: AdvancedOverview | null;
  knowledgeGraph: KnowledgeGraph | null;
  notifications: AdvancedNotification[];
  loading: boolean;
  uploading: boolean;
  searching: boolean;
  chatLoading: boolean;
  deletingDocumentId: string | null;
  deletingDocumentIds: string[];
  settingSavingKey: string | null;
  settingTestingKey: string | null;
  error: string | null;
  notice: string | null;
  knowledgeDocumentFilter: string;
  onNavigate: (page: PersonalPageKey) => void;
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
  onRefreshAdvanced: () => void;
  onRebuildGraph: () => void;
  onSearchQueryChange: (value: string) => void;
  onKnowledgeDocumentFilterChange: (documentId: string) => void;
  onSearch: () => void;
  onClearSearch: () => void;
  onQuestionChange: (value: string) => void;
  onSelectedKnowledgeDocumentIdsChange: (documentIds: string[]) => void;
  onSelectedGraphDocumentIdsChange: (documentIds: string[]) => void;
  onUseKnowledgeBaseForChatChange: (value: boolean) => void;
  onAsk: () => void;
  onPrepareQuestion: (question: string, documentIds?: string[]) => void;
  onDeleteChatTurn: (messageId: string) => void;
  onClearChatHistory: () => void;
}

interface Metric {
  label: string;
  value: string;
  hint?: string;
  tone?: 'normal' | 'warning' | 'danger';
}

export function PersonalWorkspacePanel({
  activePage,
  currentNavLabel,
  user,
  workspace,
  documents,
  knowledgeBase,
  chunks,
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
  advancedOverview,
  knowledgeGraph,
  notifications,
  loading,
  uploading,
  searching,
  chatLoading,
  deletingDocumentId,
  deletingDocumentIds,
  settingSavingKey,
  settingTestingKey,
  error,
  notice,
  knowledgeDocumentFilter,
  onNavigate,
  onFileChange,
  onUpload,
  onDeleteDocument,
  onDeleteDocuments,
  onLoadDocumentContent,
  onSaveWorkspaceSetting,
  onTestWorkspaceModelConnection,
  onRefreshModules,
  onRefreshAdvanced,
  onRebuildGraph,
  onSearchQueryChange,
  onKnowledgeDocumentFilterChange,
  onSearch,
  onClearSearch,
  onQuestionChange,
  onSelectedKnowledgeDocumentIdsChange,
  onSelectedGraphDocumentIdsChange,
  onUseKnowledgeBaseForChatChange,
  onAsk,
  onPrepareQuestion,
  onDeleteChatTurn,
  onClearChatHistory
}: PersonalWorkspacePanelProps) {
  const profile = useMemo(
    () => buildPersonalProfile(documents, knowledgeBase, chunks, chatMessages, notifications),
    [documents, knowledgeBase, chunks, chatMessages, notifications]
  );

  const shared = {
    currentNavLabel,
    user,
    workspace,
    documents,
    knowledgeBase,
    chunks,
    documentContents,
    chatMessages,
    selectedKnowledgeDocumentIds,
    selectedGraphDocumentIds,
    useKnowledgeBaseForChat,
    activeChatModelName,
    workspaceSettings,
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
    onUseKnowledgeBaseForChatChange
  };

  if (activePage === 'documents') {
    return (
      <PersonalDocuments
        {...shared}
        selectedFile={selectedFile}
        selectedFiles={selectedFiles}
        uploading={uploading}
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
      <PersonalKnowledgeBase
        {...shared}
        searchQuery={searchQuery}
        searchResults={searchResults}
        searching={searching}
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
      <PersonalRagChat
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
    return <PersonalSettings {...shared} />;
  }

  if (activePage === 'advanced') {
    return (
      <PersonalAdvancedDashboard
        {...shared}
        overview={advancedOverview}
        graph={knowledgeGraph}
        notifications={notifications}
        loading={loading}
        onRefresh={onRefreshAdvanced}
        onRebuildGraph={onRebuildGraph}
        onSearchQueryChange={onSearchQueryChange}
        onKnowledgeDocumentFilterChange={onKnowledgeDocumentFilterChange}
      />
    );
  }

  return (
    <PersonalHome
      {...shared}
      onRefresh={onRefreshModules}
      onKnowledgeDocumentFilterChange={onKnowledgeDocumentFilterChange}
    />
  );
}

function PersonalHome({
  currentNavLabel,
  user,
  workspace,
  documents,
  chunks,
  chatMessages,
  profile,
  error,
  notice,
  onNavigate,
  onPrepareQuestion,
  onKnowledgeDocumentFilterChange,
  onRefresh
}: PersonalSharedProps & {
  onKnowledgeDocumentFilterChange: (documentId: string) => void;
  onRefresh: () => void;
}) {
  const recentDocuments = documents.slice(0, 5);
  const recentQuestions = getQuestionTurns(chatMessages).slice(0, 5);
  const currentUserName = getDisplayName(user);
  const [hiddenOperationIds, setHiddenOperationIds] = useState<string[]>([]);
  const operations = buildRecentOperations(documents, chatMessages, profile)
    .filter((operation) => !hiddenOperationIds.includes(operation.id))
    .slice(0, 6);
  const reminders = buildReminders(profile);

  function deleteRecentOperation(operationId: string) {
    const confirmed = window.confirm('确认删除这条最近操作记录吗？');
    if (!confirmed) return;
    setHiddenOperationIds((ids) => [...ids, operationId]);
  }

  return (
    <section className="personal-page">
      <PageHeading
        eyebrow={currentNavLabel}
        title="个人知识工作台"
        description="当前空间：个人工作区，数据仅个人可见，不与企业工作区同步。"
        actionLabel="刷新"
        actionIcon={RefreshCw}
        onAction={onRefresh}
      />
      <Feedback error={error} notice={notice} />

      <div className="personal-hero">
        <div>
          <p className="eyebrow">个人工作区</p>
          <h2>{currentUserName} 的个人工作区</h2>
          <p>当前用户：{currentUserName}</p>
          <span>当前空间：个人工作区，数据仅个人可见，不与企业工作区同步。</span>
        </div>
        <ShieldCheck size={48} aria-hidden="true" />
      </div>

      <MetricGrid metrics={buildHomeMetrics(profile)} />

      <div className="quick-actions">
        <ActionButton icon={Upload} label="上传文档" onClick={() => onNavigate('documents')} />
        <ActionButton icon={Database} label="查看知识库" onClick={() => onNavigate('knowledge')} />
        <ActionButton icon={Bot} label="开始问答" onClick={() => onNavigate('chat')} />
        <ActionButton icon={BarChart3} label="查看高级驾驶舱" onClick={() => onNavigate('advanced')} />
      </div>

      <div className="personal-dashboard-grid">
        <section className="personal-card wide">
          <SectionTitle title="最近文档" subtitle="最近上传和解析的个人文档" />
          {recentDocuments.length === 0 ? (
            <EmptyState
              text="你还没有上传文档，上传第一个文档后可以构建个人知识库并进行智能问答。"
              actionLabel="上传文档"
              onAction={() => onNavigate('documents')}
            />
          ) : (
            <div className="personal-table compact-scroll">
              <div className="personal-table-head document-home-row">
                <span>文档名</span>
                <span>类型</span>
                <span>解析</span>
                <span>入库</span>
                <span>片段</span>
                <span>上传时间</span>
                <span>操作</span>
              </div>
              {recentDocuments.map((document) => (
                <div className="personal-table-row document-home-row" key={document.id}>
                  <button
                    className="text-link"
                    type="button"
                    onClick={() => {
                      onKnowledgeDocumentFilterChange(document.id);
                      onNavigate('knowledge');
                    }}
                  >
                    {document.filename}
                  </button>
                  <span>{document.file_type || '未知'}</span>
                  <StatusBadge value={document.parse_status} />
                  <StatusBadge value={document.index_status} />
                  <span>{document.chunk_count ?? 0}</span>
                  <span>{formatDate(document.created_at)}</span>
                  <span className="inline-actions">
                    <button type="button" onClick={() => onNavigate('documents')}>查看</button>
                    <button
                      type="button"
                      onClick={() => onPrepareQuestion(`请基于《${document.filename}》回答我的问题：`, [document.id])}
                    >
                      去问答
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="personal-card">
          <SectionTitle title="最近问答" subtitle="当前会话中的问答记录" />
          {recentQuestions.length === 0 ? (
            <EmptyState
              text="还没有进行过问答，上传并入库文档后可以开始提问。"
              actionLabel="开始问答"
              onAction={() => onNavigate('chat')}
            />
          ) : (
            <div className="personal-list">
              {recentQuestions.map((item) => (
                <article key={item.id}>
                  <strong>{item.question}</strong>
                  <span>{item.timeLabel}</span>
                  <div className="inline-actions">
                    <button type="button" onClick={() => onNavigate('chat')}>查看</button>
                    <button type="button" onClick={() => onPrepareQuestion(item.question)}>继续问答</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="personal-card compact-operations-card">
          <div className="compact-operation-heading">
            <Sparkles size={24} aria-hidden="true" />
            <div>
              <h3>最近操作</h3>
              <p>由文档、知识库和问答数据推导</p>
            </div>
          </div>
          {operations.length === 0 ? (
            <EmptyState text="暂无最近操作。" />
          ) : (
            <div className="compact-operation-list">
              {operations.map((operation) => (
                <article className="compact-operation-item" key={operation.id}>
                  <span className="compact-operation-badge">{statusText(operation.status)}</span>
                  <p>
                    <strong>{operation.title}</strong>
                    <span>{operation.description}</span>
                    <small>{operation.timeLabel}</small>
                  </p>
                  <button
                    className="compact-operation-delete"
                    type="button"
                    onClick={() => deleteRecentOperation(operation.id)}
                  >
                    删除最近操作
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="personal-card">
          <SectionTitle title="待处理提醒" subtitle="根据当前个人知识库状态生成" />
          {reminders.length === 0 ? (
            <EmptyState text="当前没有待处理提醒。" />
          ) : (
            <div className="reminder-list">
              {reminders.map((reminder) => (
                <article key={reminder.title}>
                  <AlertTriangle size={18} aria-hidden="true" />
                  <div>
                    <strong>{reminder.title}</strong>
                    <span>{reminder.description}</span>
                  </div>
                  <button type="button" onClick={() => onNavigate(reminder.target)}>
                    {reminder.action}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function PersonalDocuments({
  currentNavLabel,
  user,
  documents,
  chunks,
  profile,
  selectedFile,
  selectedFiles,
  uploading,
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
}: PersonalSharedProps & {
  selectedFile: File | null;
  selectedFiles: File[];
  uploading: boolean;
  deletingDocumentId: string | null;
  deletingDocumentIds: string[];
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onDeleteDocument: (document: DocumentRecord) => void;
  onDeleteDocuments: (documents: DocumentRecord[]) => void;
  onRefresh: () => void;
  onKnowledgeDocumentFilterChange: (documentId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState('');
  const [parseFilter, setParseFilter] = useState('all');
  const [indexFilter, setIndexFilter] = useState('all');
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentRecord | null>(null);

  const filteredDocuments = documents.filter((document) => {
    const matchesQuery = document.filename.toLowerCase().includes(query.trim().toLowerCase());
    const matchesUploader = documentUploaderName(document, user).toLowerCase().includes(uploaderFilter.trim().toLowerCase());
    const matchesParse = parseFilter === 'all' || document.parse_status === parseFilter;
    const matchesIndex = indexFilter === 'all' || document.index_status === indexFilter;
    return matchesQuery && matchesUploader && matchesParse && matchesIndex;
  });
  const selectedDocuments = documents.filter((document) => selectedDocumentIds.includes(document.id));

  function toggleDocument(documentId: string) {
    setSelectedDocumentIds((ids) =>
      ids.includes(documentId) ? ids.filter((id) => id !== documentId) : [...ids, documentId]
    );
  }

  function resetFilters() {
    setQuery('');
    setUploaderFilter('');
    setParseFilter('all');
    setIndexFilter('all');
    setSelectedDocumentIds([]);
  }

  return (
    <section className="personal-page">
      <PageHeading
        eyebrow={currentNavLabel}
        title="文档管理"
        description="上传个人文档，系统会解析文本、生成知识片段，并加入个人知识库。文档仅在个人工作区内可见。"
        actionLabel="刷新"
        actionIcon={RefreshCw}
        onAction={onRefresh}
      />
      <IsolationNotice />
      <Feedback error={error} notice={notice} />

      <div className="personal-upload-panel">
        <div>
          <Upload size={28} aria-hidden="true" />
          <div>
            <strong>
              {selectedFiles.length > 0
                ? `已选择 ${selectedFiles.length} 个文件`
                : selectedFile?.name || '选择要上传的个人文档'}
            </strong>
            <span>
              {selectedFiles.length > 0
                ? selectedFiles.map((file) => file.name).join('、')
                : '支持常见办公文档、文本文件和资产文件。可解析文件会进入个人知识库，暂不支持解析的文件仅作为资产保存。'}
            </span>
          </div>
        </div>
        <div className="upload-actions">
          <label className="file-picker">
            选择文件
            <input
              type="file"
              multiple
              onChange={onFileChange}
              accept=".pdf,.docx,.txt,.md,.xlsx,.csv,.pptx,.jpg,.jpeg,.png,.mp3,.mp4,.zip"
            />
          </label>
          <button
            className="primary-action compact-action"
            type="button"
            disabled={selectedFiles.length === 0 || uploading}
            onClick={onUpload}
          >
            <Upload size={18} aria-hidden="true" />
            {uploading ? '上传中' : '上传文档'}
          </button>
        </div>
      </div>

      <MetricGrid metrics={buildDocumentMetrics(profile)} />

      <div className="filter-bar">
        <div className="input-row">
          <Search size={18} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="按文件名搜索"
          />
        </div>
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
        <input
          className="standalone-input"
          value={uploaderFilter}
          onChange={(event) => setUploaderFilter(event.target.value)}
          placeholder="上传人名称"
        />
        <button
          className="ghost-button"
          type="button"
          onClick={resetFilters}
        >
          <Filter size={18} aria-hidden="true" />
          重置筛选
        </button>
        <button
          className="compact-operation-delete"
          type="button"
          disabled={selectedDocuments.length === 0 || deletingDocumentIds.length > 0}
          onClick={() => {
            onDeleteDocuments(selectedDocuments);
            setSelectedDocumentIds([]);
          }}
        >
          批量删除
        </button>
      </div>

      <section className="personal-card">
        <SectionTitle title="文档列表" subtitle={`${filteredDocuments.length} 个文档`} />
        {filteredDocuments.length === 0 ? (
          <EmptyState
            text={documents.length === 0 ? '你还没有上传文档，上传第一个文档后可以构建个人知识库并进行智能问答。' : '没有找到符合筛选条件的文档。'}
            actionLabel="上传文档"
            onAction={() => document.querySelector<HTMLInputElement>('.file-picker input')?.click()}
          />
        ) : (
          <div className="personal-table compact-scroll">
            <div className="personal-table-head document-row">
              <span>选择</span>
              <span>文件名</span>
              <span>类型</span>
              <span>上传人</span>
              <span>大小</span>
              <span>解析状态</span>
              <span>入库状态</span>
              <span>片段</span>
              <span>上传时间</span>
              <span>操作</span>
            </div>
            {filteredDocuments.map((document) => (
              <div className="personal-table-row document-row" key={document.id}>
                <input
                  type="checkbox"
                  checked={selectedDocumentIds.includes(document.id)}
                  onChange={() => toggleDocument(document.id)}
                  aria-label={`选择 ${document.filename}`}
                />
                <button className="text-link" type="button" onClick={() => setSelectedDocument(document)}>
                  {document.filename}
                </button>
                <span>{document.file_type || '未知'}</span>
                <span>{documentUploaderName(document, user)}</span>
                <span>暂无</span>
                <StatusBadge value={document.parse_status} />
                <StatusBadge value={document.index_status} />
                <span>{document.chunk_count ?? 0}</span>
                <span>{formatDate(document.created_at)}</span>
                <span className="inline-actions wrap">
                  <button type="button" onClick={() => setSelectedDocument(document)}>详情</button>
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
                    onClick={() => onPrepareQuestion(`请基于《${document.filename}》进行问答：`, [document.id])}
                  >
                    去问答
                  </button>
                  <button type="button" disabled title="暂未开放">重新解析</button>
                  <button
                    className="danger-link"
                    type="button"
                    disabled={deletingDocumentId === document.id || deletingDocumentIds.includes(document.id)}
                    onClick={() => onDeleteDocument(document)}
                  >
                    删除
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedDocument && (
        <DocumentDetailModal
          document={selectedDocument}
          chunkCount={chunks.filter((chunk) => chunk.document_id === selectedDocument.id).length || selectedDocument.chunk_count}
          onClose={() => setSelectedDocument(null)}
          onViewChunks={() => {
            onKnowledgeDocumentFilterChange(selectedDocument.id);
            setSelectedDocument(null);
            onNavigate('knowledge');
          }}
          onAsk={() => {
            onPrepareQuestion(`请基于《${selectedDocument.filename}》回答：`, [selectedDocument.id]);
            setSelectedDocument(null);
          }}
          onDelete={() => {
            onDeleteDocument(selectedDocument);
            setSelectedDocument(null);
          }}
        />
      )}
    </section>
  );
}

function PersonalKnowledgeBase({
  currentNavLabel,
  user,
  documents,
  knowledgeBase,
  chunks,
  documentContents,
  searchQuery,
  searchResults,
  searching,
  documentFilter,
  error,
  notice,
  profile,
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
}: PersonalSharedProps & {
  searchQuery: string;
  searchResults: KnowledgeChunk[];
  searching: boolean;
  documentFilter: string;
  onSearchQueryChange: (value: string) => void;
  onDocumentFilterChange: (documentId: string) => void;
  onSearch: () => void;
  onClearSearch: () => void;
  onRefresh: () => void;
}) {
  const [chunkNumberFilter, setChunkNumberFilter] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState('');
  const [selectedChunk, setSelectedChunk] = useState<KnowledgeChunk | null>(null);
  const [selectedDocumentContent, setSelectedDocumentContent] = useState<DocumentRecord | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const visibleBase = searchQuery.trim() ? searchResults : chunks;
  const visibleChunks = visibleBase.filter((chunk) => {
    const matchesDocument = documentFilter === 'all' || chunk.document_id === documentFilter;
    const document = documents.find((item) => item.id === chunk.document_id);
    const matchesUploader =
      !uploaderFilter.trim() ||
      documentUploaderName(document, user).toLowerCase().includes(uploaderFilter.trim().toLowerCase());
    const number = Number(chunkNumberFilter);
    const matchesNumber = !chunkNumberFilter || chunk.chunk_index + 1 === number;
    return matchesDocument && matchesUploader && matchesNumber;
  });
  const visibleLibraries = documents.filter((document) => {
    const matchesLibrary = documentFilter === 'all' || document.id === documentFilter;
    const matchesUploader = documentUploaderName(document, user)
      .toLowerCase()
      .includes(uploaderFilter.trim().toLowerCase());
    return matchesLibrary && matchesUploader;
  });

  const reset = () => {
    onClearSearch();
    onDocumentFilterChange('all');
    setUploaderFilter('');
    setChunkNumberFilter('');
    setCopyMessage(null);
  };

  function toggleChatLibrary(documentId: string) {
    const nextIds = selectedKnowledgeDocumentIds.includes(documentId)
      ? selectedKnowledgeDocumentIds.filter((id) => id !== documentId)
      : [...selectedKnowledgeDocumentIds, documentId];
    onSelectedKnowledgeDocumentIdsChange(nextIds);
  }

  return (
    <section className="personal-page">
      <PageHeading
        eyebrow={currentNavLabel}
        title="知识库"
        description="查看个人工作区中的知识片段，支持关键词检索，并可基于片段发起问答。"
        actionLabel="刷新"
        actionIcon={RefreshCw}
        onAction={onRefresh}
      />
      <IsolationNotice />
      <Feedback error={error} notice={notice || copyMessage} />
      <MetricGrid metrics={buildKnowledgeMetrics(profile, knowledgeBase)} />

      <form
        className="knowledge-search personal-search"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <div className="input-row">
          <Search size={18} aria-hidden="true" />
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="输入关键词检索个人知识片段"
          />
        </div>
        <select value={documentFilter} onChange={(event) => onDocumentFilterChange(event.target.value)}>
          <option value="all">全部知识库</option>
          {documents.map((document) => (
            <option value={document.id} key={document.id}>
              {document.filename}
            </option>
          ))}
        </select>
        <input
          className="standalone-input"
          value={uploaderFilter}
          onChange={(event) => setUploaderFilter(event.target.value)}
          placeholder="上传人名称"
        />
        <input
          className="standalone-input"
          value={chunkNumberFilter}
          inputMode="numeric"
          onChange={(event) => setChunkNumberFilter(event.target.value)}
          placeholder="片段编号"
        />
        <button className="primary-action compact-action" type="submit" disabled={searching}>
          <Search size={18} aria-hidden="true" />
          {searching ? '检索中' : '检索'}
        </button>
        <button className="ghost-button" type="button" onClick={reset}>
          重置
        </button>
        <span className="result-count">结果 {visibleChunks.length} 条</span>
      </form>

      <section className="personal-card">
        <SectionTitle title="文件知识库" subtitle="每个文件对应一个知识库，库名为文件名" />
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
                    ['上传人', documentUploaderName(document, user)],
                    ['类型', document.file_type || '未知'],
                    ['解析状态', statusText(document.parse_status)],
                    ['入库状态', statusText(document.index_status)],
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
                      setSelectedDocumentContent(document);
                    }}
                  >
                    查看整个文档
                  </button>
                  <button type="button" onClick={() => toggleChatLibrary(document.id)}>
                    {selectedKnowledgeDocumentIds.includes(document.id) ? '取消问答选择' : '选择用于问答'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onPrepareQuestion(`请基于《${document.filename}》回答：`, [document.id])}
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

      <section className="personal-card">
        <SectionTitle title="知识片段" subtitle="按文件知识库筛选，摘要展示，点击可查看完整内容" />
        {visibleChunks.length === 0 ? (
          <EmptyState
            text={chunks.length === 0 ? '当前个人知识库暂无可检索内容，请先上传并解析文档。' : '没有找到相关内容，请尝试更换关键词。'}
            actionLabel={chunks.length === 0 ? '去上传文档' : undefined}
            onAction={chunks.length === 0 ? () => onNavigate('documents') : undefined}
          />
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
                <p>{highlightText(summarize(chunk.content, 130), searchQuery)}</p>
                <small>
                  {chunk.score ? `相关度 ${chunk.score.toFixed(2)}` : '所属空间：个人工作区'} · 上传人：{documentUploaderName(sourceDocument, user)}
                </small>
                <div className="inline-actions">
                  <button type="button" onClick={() => setSelectedChunk(chunk)}>查看完整片段</button>
                  <button
                    type="button"
                    onClick={() => onPrepareQuestion(`请基于这个片段回答：${summarize(chunk.content, 80)}`, [chunk.document_id])}
                  >
                    基于此片段提问
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await copyText(chunk.content);
                      setCopyMessage('片段内容已复制。');
                    }}
                  >
                    复制内容
                  </button>
                </div>
              </article>
            );
            })}
          </div>
        )}
      </section>

      {selectedChunk && (
        <ChunkDetailModal
          chunk={selectedChunk}
          keywords={extractKeywords(selectedChunk.content)}
          onClose={() => setSelectedChunk(null)}
          onAsk={() => {
            onPrepareQuestion(`请基于这个片段回答：${summarize(selectedChunk.content, 80)}`, [selectedChunk.document_id]);
            setSelectedChunk(null);
          }}
          onCopy={async () => {
            await copyText(selectedChunk.content);
            setCopyMessage('片段内容已复制。');
          }}
        />
      )}

      {selectedDocumentContent && (
        <DocumentContentModal
          document={selectedDocumentContent}
          content={documentContents[selectedDocumentContent.id]?.content}
          chunkCount={
            documentContents[selectedDocumentContent.id]?.chunk_count ??
            selectedDocumentContent.chunk_count
          }
          workspaceLabel="个人工作区"
          onClose={() => setSelectedDocumentContent(null)}
          onAsk={() => {
            onSelectedKnowledgeDocumentIdsChange([selectedDocumentContent.id]);
            onPrepareQuestion(`请基于《${selectedDocumentContent.filename}》回答：`, [selectedDocumentContent.id]);
            setSelectedDocumentContent(null);
          }}
        />
      )}
    </section>
  );
}

function PersonalRagChat({
  currentNavLabel,
  documents,
  knowledgeBase,
  selectedKnowledgeDocumentIds,
  useKnowledgeBaseForChat,
  activeChatModelName,
  chatMessages,
  question,
  loading,
  error,
  notice,
  profile,
  onNavigate,
  onSelectedKnowledgeDocumentIdsChange,
  onUseKnowledgeBaseForChatChange,
  onQuestionChange,
  onAsk,
  onPrepareQuestion,
  onDeleteChatTurn,
  onClearChatHistory
}: PersonalSharedProps & {
  question: string;
  loading: boolean;
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
  onDeleteChatTurn: (messageId: string) => void;
  onClearChatHistory: () => void;
}) {
  const [selectedSource, setSelectedSource] = useState<KnowledgeChunk | null>(null);
  const canAskWithKnowledge = profile.chunkCount > 0 && profile.knowledgeReady;
  const canAsk = !useKnowledgeBaseForChat || canAskWithKnowledge;
  const turns = getQuestionTurns(chatMessages);
  const recommendations = [
    '这份文档主要讲了什么？',
    '请总结当前知识库的核心内容',
    '这个项目的核心功能是什么？',
    '个人工作区和企业工作区有什么区别？',
    '当前文档中有哪些重要模块？',
    '请提取当前知识库中的关键概念'
  ];

  function toggleDocument(documentId: string) {
    const nextIds = selectedKnowledgeDocumentIds.includes(documentId)
      ? selectedKnowledgeDocumentIds.filter((id) => id !== documentId)
      : [...selectedKnowledgeDocumentIds, documentId];
    onSelectedKnowledgeDocumentIdsChange(nextIds);
  }

  return (
    <section className="personal-page chat-workspace">
      <PageHeading
        eyebrow={currentNavLabel}
        title="智能问答"
        description="默认使用当前模型进行普通对话；开启知识库后，回答会进入 RAG 模式并展示可追溯引用来源。"
      />
      <IsolationNotice />
      <Feedback error={error} notice={notice} />

      <div className="chat-status-strip">
        <StatusPill label="知识库状态" value={profile.knowledgeStatusText} />
        <StatusPill label="已入库文档" value={String(profile.indexedDocumentCount)} />
        <StatusPill label="知识片段" value={String(profile.chunkCount)} />
        <StatusPill label="回答模式" value={useKnowledgeBaseForChat ? 'RAG 知识库问答' : '普通大模型对话'} />
        <StatusPill label="当前模型" value={activeChatModelName} />
      </div>

      {useKnowledgeBaseForChat && !canAskWithKnowledge && (
        <div className="personal-callout warning">
          <AlertTriangle size={20} aria-hidden="true" />
          <span>已开启知识库问答，但你还没有可检索的文档。可以关闭知识库进行普通对话，或先上传并解析文档。</span>
          <button type="button" onClick={() => onNavigate('documents')}>去上传文档</button>
        </div>
      )}

      <section className="personal-card">
        <label className="chat-mode-toggle">
          <input
            type="checkbox"
            checked={useKnowledgeBaseForChat}
            onChange={(event) => onUseKnowledgeBaseForChatChange(event.target.checked)}
          />
          <span>
            <strong>使用知识库回答</strong>
            <small>关闭时为普通大模型对话；开启后只在当前个人工作区知识库中检索引用。</small>
          </span>
        </label>
        <SectionTitle
          title="问答知识库范围"
          subtitle={
            useKnowledgeBaseForChat
              ? selectedKnowledgeDocumentIds.length
                ? `已选择 ${selectedKnowledgeDocumentIds.length} 个知识库`
                : '开启知识库且未选择时默认使用全部文件知识库'
              : '当前未使用知识库，所选范围不会参与本次普通对话'
          }
        />
        {documents.length === 0 ? (
          <EmptyState text="暂无可选择的文件知识库。" />
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

      <section className="personal-card">
        <SectionTitle title="推荐问题" subtitle="点击后自动填入输入框" />
        <div className="prompt-grid">
          {recommendations.map((item) => (
            <button key={item} type="button" onClick={() => onQuestionChange(item)}>
              <HelpCircle size={16} aria-hidden="true" />
              {item}
            </button>
          ))}
        </div>
      </section>

      <div className="chat-layout">
        <section className="personal-card chat-main">
          <SectionTitle
            title="问答输入"
            subtitle={`当前模型：${activeChatModelName} · ${useKnowledgeBaseForChat ? '使用个人知识库 RAG 回答' : '普通对话，不检索知识库'}`}
          />
          <form
            className="personal-chat-composer"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              if (canAsk) onAsk();
            }}
          >
            <textarea
              value={question}
              onChange={(event) => onQuestionChange(event.target.value)}
              placeholder={useKnowledgeBaseForChat ? '输入你要问个人知识库的问题' : '输入问题，直接使用当前大模型正常对话'}
              disabled={!canAsk || loading}
            />
            <div className="inline-actions">
              <button
                className="primary-action compact-action"
                type="submit"
                disabled={!canAsk || loading || !question.trim()}
              >
                <Bot size={18} aria-hidden="true" />
                {loading ? (useKnowledgeBaseForChat ? '检索并生成中' : '生成中') : '提问'}
              </button>
              <button className="ghost-button" type="button" onClick={() => onQuestionChange('')}>
                清空
              </button>
            </div>
          </form>

          <div className="personal-chat-thread" aria-live="polite">
            {chatMessages.length === 0 ? (
              <EmptyState
                text={useKnowledgeBaseForChat ? '开启知识库后，回答会展示引用来源。' : '默认普通对话不会检索知识库；需要引用文档时请打开“使用知识库回答”。'}
              />
            ) : (
              chatMessages.map((message) => (
                <article className={`personal-message ${message.role}`} key={message.id}>
                  <div className="personal-message-bubble">
                    <strong>{message.role === 'user' ? '你的问题' : 'AI 回答'}</strong>
                    {message.role === 'assistant' && (
                      <span>
                        回答模式：{message.useKnowledgeBase ? 'RAG 知识库问答' : '普通大模型对话'}
                        {message.modelName ? ` · 模型：${message.modelName}` : ''}
                      </span>
                    )}
                    {loading && message.role === 'assistant' ? (
                      <div className="skeleton-line" />
                    ) : (
                      <p>{message.content || '当前知识库没有检索到足够相关的内容，请换个问题或先补充文档。'}</p>
                    )}
                  </div>
                  {message.sources && message.sources.length > 0 && (
                    <div className="source-list">
                      <span>引用来源</span>
                      {message.sources.map((source) => (
                        <article key={source.id}>
                          <strong>{source.filename}</strong>
                          <small>
                            片段 #{source.chunk_index + 1}
                            {source.score ? ` · 相似度 ${source.score.toFixed(2)}` : ''}
                          </small>
                          <p>{summarize(source.content, 120)}</p>
                          <button type="button" onClick={() => setSelectedSource(source)}>查看片段</button>
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

        <aside className="personal-card chat-history">
          <SectionTitle title="历史问答" subtitle="当前会话记录" />
          {turns.length === 0 ? (
            <EmptyState text="暂无历史问答。" />
          ) : (
            <div className="personal-list">
              {turns.map((turn) => (
                <article key={turn.id}>
                  <strong>{turn.question}</strong>
                  <span>{turn.timeLabel}</span>
                  <div className="inline-actions">
                    <button type="button" onClick={() => onPrepareQuestion(turn.question)}>继续问答</button>
                    <button type="button" onClick={() => onDeleteChatTurn(turn.id)}>删除</button>
                  </div>
                </article>
              ))}
              <button className="ghost-button" type="button" onClick={onClearChatHistory}>
                清空历史
              </button>
            </div>
          )}
        </aside>
      </div>

      {selectedSource && (
        <ChunkDetailModal
          chunk={selectedSource}
          keywords={extractKeywords(selectedSource.content)}
          onClose={() => setSelectedSource(null)}
          onAsk={() => {
            onPrepareQuestion(`请基于这个片段继续回答：${summarize(selectedSource.content, 80)}`, [selectedSource.document_id]);
            setSelectedSource(null);
          }}
          onCopy={() => copyText(selectedSource.content)}
        />
      )}
    </section>
  );
}

interface ModelConfigForm {
  provider: string;
  model_name: string;
  api_key: string;
  base_url: string;
  temperature: string;
  max_tokens: string;
  enable_rag: boolean;
  return_sources: boolean;
}

interface VectorConfigForm {
  embedding_model: string;
  top_k: string;
  score_threshold: string;
  retrieval_mode: string;
  rerank_enabled: boolean;
  chunk_size: string;
  chunk_overlap: string;
}

const modelCatalog = [
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

const legacyModelCatalog = [
  { key: 'deepseek', label: 'DeepSeek', models: ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-r1', 'deepseek-v3'], baseUrl: 'https://api.deepseek.com' },
  { key: 'chatgpt', label: 'ChatGPT', models: ['gpt-5', 'gpt-4o', 'gpt-4.1', 'o4-mini'], baseUrl: 'https://api.openai.com/v1' },
  { key: 'opus', label: 'Opus', models: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-6'], baseUrl: 'https://api.anthropic.com/v1' },
  { key: 'glm', label: 'GLM', models: ['glm-5.2', 'glm-5', 'glm-4.7-flash', 'glm-4.6'], baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { key: 'qianwen', label: '千问', models: ['qwen3-235b-a22b', 'qwen3-max-2026-01-23', 'qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen3.6-plus', 'qwen3.5-plus', 'qwen3-coder-plus', 'qwen3-coder-next', 'qwq-32b'], baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { key: 'doubao', label: '豆包', models: ['doubao-pro-4k', 'doubao-pro-32k', 'doubao-lite', 'doubao-1-5-thinking-pro-250415', 'doubao-seed-2.0'], baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
  { key: 'gemini', label: 'Gemini', models: ['gemini-3.1-pro', 'gemini-flash'], baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  { key: 'kimi', label: 'Kimi', models: ['moonshot-v1-128k', 'kimi-k2.5'], baseUrl: 'https://api.moonshot.cn/v1' },
  { key: 'minimax', label: 'MiniMax', models: ['minimax-m2.5'], baseUrl: 'https://api.minimax.chat/v1' },
  { key: 'ernie', label: '文心一言', models: ['ernie-4.0'], baseUrl: 'https://qianfan.baidubce.com/v2' },
  { key: 'grok', label: 'Grok', models: ['grok-2'], baseUrl: 'https://api.x.ai/v1' }
];

function personalModelDefaults(): Record<string, unknown> {
  return {
    provider: 'deepseek',
    model_name: 'deepseek-v4-flash',
    api_key: '',
    base_url: 'https://api.deepseek.com',
    temperature: 0.2,
    max_tokens: 2048,
    enable_rag: true,
    return_sources: true,
    api_key_configured: false,
    api_key_masked: ''
  };
}

function personalVectorDefaults(): Record<string, unknown> {
  return {
    vector_type: 'milvus',
    embedding_model: 'bge-m3:567m',
    top_k: 5,
    score_threshold: 0.35,
    retrieval_mode: 'hybrid',
    rerank_enabled: true,
    chunk_size: 800,
    chunk_overlap: 120
  };
}

function getSettingValue(
  settings: WorkspaceSettingRecord[],
  key: string,
  fallback: Record<string, unknown>
) {
  return {
    ...fallback,
    ...(settings.find((item) => item.setting_key === key)?.setting_value ?? {})
  };
}

function toModelForm(value: Record<string, unknown>): ModelConfigForm {
  return {
    provider: stringSetting(value.provider, 'deepseek'),
    model_name: stringSetting(value.model_name, 'deepseek-v4-flash'),
    api_key: '',
    base_url: stringSetting(value.base_url, 'https://api.deepseek.com'),
    temperature: stringSetting(value.temperature, '0.2'),
    max_tokens: stringSetting(value.max_tokens, '2048'),
    enable_rag: booleanSetting(value.enable_rag, true),
    return_sources: booleanSetting(value.return_sources, true)
  };
}

function toVectorForm(value: Record<string, unknown>): VectorConfigForm {
  return {
    embedding_model: stringSetting(value.embedding_model, 'bge-m3:567m'),
    top_k: stringSetting(value.top_k, '5'),
    score_threshold: stringSetting(value.score_threshold, '0.35'),
    retrieval_mode: stringSetting(value.retrieval_mode, 'hybrid'),
    rerank_enabled: booleanSetting(value.rerank_enabled, true),
    chunk_size: stringSetting(value.chunk_size, '800'),
    chunk_overlap: stringSetting(value.chunk_overlap, '120')
  };
}

function stringSetting(value: unknown, fallback: string) {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function booleanSetting(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function PersonalSettings({
  currentNavLabel,
  user,
  workspace,
  profile,
  workspaceSettings,
  settingSavingKey,
  settingTestingKey,
  error,
  notice,
  onSaveWorkspaceSetting,
  onTestWorkspaceModelConnection
}: PersonalSharedProps) {
  const modelConfig = getSettingValue(workspaceSettings, 'personal_model_config', personalModelDefaults());
  const vectorConfig = getSettingValue(workspaceSettings, 'personal_vector_config', personalVectorDefaults());
  const [modelForm, setModelForm] = useState(() => toModelForm(modelConfig));
  const [vectorForm, setVectorForm] = useState(() => toVectorForm(vectorConfig));

  useEffect(() => {
    setModelForm(toModelForm(modelConfig));
  }, [workspace.id, JSON.stringify(modelConfig)]);

  useEffect(() => {
    setVectorForm(toVectorForm(vectorConfig));
  }, [workspace.id, JSON.stringify(vectorConfig)]);

  const modelOptions = modelCatalog.find((item) => item.key === modelForm.provider)?.models ?? [];
  const isModelSaving = settingSavingKey === 'personal_model_config';
  const isModelTesting = settingTestingKey === 'personal_model_config';
  const isVectorSaving = settingSavingKey === 'personal_vector_config';
  const modelKeyConfigured = Boolean(modelConfig.api_key_configured);
  const modelKeyMasked = String(modelConfig.api_key_masked || '');
  const modelBaseline = useMemo(() => toModelForm(modelConfig), [workspace.id, JSON.stringify(modelConfig)]);
  const vectorBaseline = useMemo(() => toVectorForm(vectorConfig), [workspace.id, JSON.stringify(vectorConfig)]);
  const modelDirty = JSON.stringify(modelForm) !== JSON.stringify(modelBaseline);
  const vectorDirty = JSON.stringify(vectorForm) !== JSON.stringify(vectorBaseline);

  function updateModelField(field: keyof ModelConfigForm, value: string | boolean) {
    setModelForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'provider') {
        const provider = modelCatalog.find((item) => item.key === value);
        next.model_name = provider?.models[0] ?? current.model_name;
        next.base_url = provider?.baseUrl ?? current.base_url;
      }
      return next;
    });
  }

  function updateVectorField(field: keyof VectorConfigForm, value: string | boolean) {
    setVectorForm((current) => ({ ...current, [field]: value }));
  }

  function restoreModelDefaults() {
    setModelForm(toModelForm(personalModelDefaults()));
  }

  function restoreVectorDefaults() {
    setVectorForm(toVectorForm(personalVectorDefaults()));
  }

  function modelFormPayload() {
    return {
      provider: modelForm.provider,
      model_name: modelForm.model_name,
      api_key: modelForm.api_key,
      base_url: modelForm.base_url,
      temperature: Number(modelForm.temperature),
      max_tokens: Number(modelForm.max_tokens),
      enable_rag: modelForm.enable_rag,
      return_sources: modelForm.return_sources
    };
  }

  async function handleModelSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSaveWorkspaceSetting('personal_model_config', modelFormPayload());
    setModelForm((current) => ({ ...current, api_key: '' }));
  }

  function handleModelConnectionTest() {
    void onTestWorkspaceModelConnection('personal_model_config', modelFormPayload());
  }

  function handleVectorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSaveWorkspaceSetting('personal_vector_config', {
      vector_type: 'milvus',
      embedding_model: vectorForm.embedding_model,
      top_k: Number(vectorForm.top_k),
      score_threshold: Number(vectorForm.score_threshold),
      retrieval_mode: vectorForm.retrieval_mode,
      rerank_enabled: vectorForm.rerank_enabled,
      chunk_size: Number(vectorForm.chunk_size),
      chunk_overlap: Number(vectorForm.chunk_overlap)
    });
  }

  return (
    <section className="personal-page">
      <PageHeading
        eyebrow={currentNavLabel}
        title="个人设置"
        description="管理个人空间基础信息、DeepSeek 默认模型、Milvus 向量检索参数和安全隔离说明。"
      />
      <Feedback error={error} notice={notice} />
      <div className="settings-grid">
        <section className="personal-card">
          <SectionTitle title="基础信息" subtitle="当前个人工作区身份" />
          <DefinitionList
            items={[
              ['用户名', user.username],
              ['邮箱', maskEmail(user.email)],
              ['当前空间', '个人工作区'],
              ['角色', workspace.role || 'owner'],
              ['工作区标识', shortId(workspace.id)],
              ['文档数量', String(profile.documentCount)],
              ['知识片段数量', String(profile.chunkCount)]
            ]}
          />
        </section>
        <form className="personal-card config-form" onSubmit={handleModelSubmit}>
          <SectionTitle title="模型 API 配置" subtitle="个人区可配置模型 API Key；问答时会优先真实调用这里选择的模型" />
          <div className="config-summary">
            <StatusBadge value={modelKeyConfigured ? 'configured' : 'pending'} />
            <span>{modelKeyConfigured ? `API Key 已配置：${modelKeyMasked}` : '尚未配置个人模型 API Key，问答会走全局 DeepSeek / Ollama / 本地兜底'}</span>
          </div>
          {modelDirty && (
            <div className="personal-callout warning">
              <span>存在未保存更改。</span>
            </div>
          )}
          <div className="config-form-grid">
            <label>
              <span>模型供应商</span>
              <select value={modelForm.provider} onChange={(event) => updateModelField('provider', event.target.value)}>
                {modelCatalog.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>模型版本</span>
              <select value={modelForm.model_name} onChange={(event) => updateModelField('model_name', event.target.value)}>
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Base URL</span>
              <input value={modelForm.base_url} onChange={(event) => updateModelField('base_url', event.target.value)} />
            </label>
            <label>
              <span>API Key</span>
              <input
                type="password"
                value={modelForm.api_key}
                onChange={(event) => updateModelField('api_key', event.target.value)}
                placeholder={modelKeyConfigured ? '留空则继续使用已保存密钥' : '请输入模型 API Key'}
                autoComplete="off"
              />
            </label>
            <label>
              <span>temperature：{modelForm.temperature}</span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={modelForm.temperature}
                onChange={(event) => updateModelField('temperature', event.target.value)}
              />
            </label>
            <label>
              <span>最大回答长度</span>
              <input
                type="number"
                min="256"
                max="8192"
                step="256"
                value={modelForm.max_tokens}
                onChange={(event) => updateModelField('max_tokens', event.target.value)}
              />
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={modelForm.enable_rag}
                onChange={(event) => updateModelField('enable_rag', event.target.checked)}
              />
              <span>启用 RAG 知识库问答</span>
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={modelForm.return_sources}
                onChange={(event) => updateModelField('return_sources', event.target.checked)}
              />
              <span>返回引用来源</span>
            </label>
          </div>
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={isModelSaving}>
              {isModelSaving ? '保存中...' : '保存模型配置'}
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={handleModelConnectionTest}
              disabled={isModelSaving || isModelTesting}
              title="?????? API ??????????"
            >
              {isModelTesting ? '???...' : '????'}
            </button>
            <button className="ghost-button" type="button" onClick={restoreModelDefaults} disabled={isModelSaving}>
              恢复默认配置
            </button>
          </div>
        </form>
        <form className="personal-card config-form" onSubmit={handleVectorSubmit}>
          <SectionTitle title="向量库配置" subtitle="个人区统一使用 Milvus，可调优检索召回和重排参数" />
          {vectorDirty && (
            <div className="personal-callout warning">
              <span>存在未保存更改。</span>
            </div>
          )}
          <div className="config-form-grid">
            <label>
              <span>向量库类型</span>
              <input value="milvus" disabled readOnly />
            </label>
            <label>
              <span>Embedding 模型</span>
              <input
                value={vectorForm.embedding_model}
                onChange={(event) => updateVectorField('embedding_model', event.target.value)}
              />
            </label>
            <label>
              <span>Top K</span>
              <input
                type="number"
                min="1"
                max="20"
                value={vectorForm.top_k}
                onChange={(event) => updateVectorField('top_k', event.target.value)}
              />
            </label>
            <label>
              <span>相似度阈值：{Number(vectorForm.score_threshold).toFixed(2)}</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={vectorForm.score_threshold}
                onChange={(event) => updateVectorField('score_threshold', event.target.value)}
              />
            </label>
            <label>
              <span>检索模式</span>
              <select value={vectorForm.retrieval_mode} onChange={(event) => updateVectorField('retrieval_mode', event.target.value)}>
                <option value="hybrid">混合检索</option>
                <option value="vector">向量检索</option>
                <option value="keyword">关键词检索</option>
              </select>
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={vectorForm.rerank_enabled}
                onChange={(event) => updateVectorField('rerank_enabled', event.target.checked)}
              />
              <span>启用 Rerank</span>
            </label>
            <label>
              <span>切片长度</span>
              <input
                type="number"
                min="200"
                max="3000"
                value={vectorForm.chunk_size}
                onChange={(event) => updateVectorField('chunk_size', event.target.value)}
              />
            </label>
            <label>
              <span>切片重叠</span>
              <input
                type="number"
                min="0"
                max="1000"
                value={vectorForm.chunk_overlap}
                onChange={(event) => updateVectorField('chunk_overlap', event.target.value)}
              />
            </label>
          </div>
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={isVectorSaving}>
              {isVectorSaving ? '保存中...' : '保存向量库配置'}
            </button>
            <button className="ghost-button" type="button" onClick={restoreVectorDefaults} disabled={isVectorSaving}>
              恢复默认配置
            </button>
          </div>
        </form>
        <section className="personal-card">
          <SectionTitle title="存储配置" subtitle="个人知识资产规模" />
          <DefinitionList
            items={[
              ['文档数量', String(profile.documentCount)],
              ['知识片段数量', String(profile.chunkCount)],
              ['存储占用', '暂无'],
              ['最近清理时间', '暂无']
            ]}
          />
          <button className="ghost-button" type="button" disabled title="暂未开放">
            清理缓存
          </button>
        </section>
        <section className="personal-card full">
          <SectionTitle title="安全与隔离说明" subtitle="个人版核心边界" />
          <ul className="security-list">
            <li>当前为个人工作区。</li>
            <li>个人工作区数据仅个人可见。</li>
            <li>不会同步到企业工作区。</li>
            <li>不支持企业数据复制到个人空间。</li>
            <li>不支持个人数据导入企业空间。</li>
            <li>所有个人问答、文档、知识片段、向量索引均限定在当前个人工作区内。</li>
          </ul>
        </section>
      </div>
    </section>
  );
}

function PersonalAdvancedDashboard({
  currentNavLabel,
  documents,
  chunks,
  chatMessages,
  overview,
  graph,
  selectedGraphDocumentIds,
  notifications,
  loading,
  error,
  notice,
  profile,
  onNavigate,
  onRefresh,
  onRebuildGraph,
  onSearchQueryChange,
  onKnowledgeDocumentFilterChange,
  onSelectedGraphDocumentIdsChange
}: PersonalSharedProps & {
  overview: AdvancedOverview | null;
  graph: KnowledgeGraph | null;
  notifications: AdvancedNotification[];
  loading: boolean;
  onRefresh: () => void;
  onRebuildGraph: () => void;
  onSearchQueryChange: (value: string) => void;
  onKnowledgeDocumentFilterChange: (documentId: string) => void;
}) {
  const operations = buildRecentOperations(documents, chatMessages, profile).slice(0, 8);
  const analysis = buildAssetAnalysis(documents, chunks, chatMessages);
  const combinedActivityItems = [
    ...notifications.slice(0, 4).map((item) => ({
      id: `notice-${item.id}`,
      badge: notificationType(item.action),
      title: item.title,
      description: item.message,
      timeLabel: formatDate(item.created_at),
      status: item.level === 'error' ? 'failed' : 'ready'
    })),
    ...operations.slice(0, 6).map((operation) => ({
      id: `operation-${operation.id}`,
      badge: operation.type,
      title: operation.title,
      description: operation.description,
      timeLabel: operation.timeLabel,
      status: operation.status
    }))
  ].slice(0, 10);

  return (
    <section className="personal-page">
      <PageHeading
        eyebrow={currentNavLabel}
        title="高级驾驶舱"
        description="集中查看个人知识资产、知识图谱、问答动态和系统运行状态。"
        actionLabel={loading ? '刷新中' : '刷新'}
        actionIcon={RefreshCw}
        onAction={onRefresh}
      />
      <IsolationNotice />
      <Feedback error={error} notice={notice} />

      <MetricGrid
        metrics={[
          { label: '文档数量', value: String(overview?.document_count ?? profile.documentCount) },
          { label: '知识片段', value: String(overview?.chunk_count ?? profile.chunkCount) },
          { label: '问答次数', value: String(profile.chatQuestionCount) },
          { label: '最近操作数', value: String(operations.length) },
          { label: '知识库状态', value: profile.knowledgeStatusText }
        ]}
      />

      <section className="personal-card graph-card-wide graph-card-expanded">
        <KnowledgeGraphExplorer
          graph={graph}
          loading={loading}
          documents={documents}
          selectedDocumentIds={selectedGraphDocumentIds}
          workspaceLabel="个人工作区"
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
          onRefresh={onRefresh}
          onRebuild={onRebuildGraph}
        />
      </section>

      <div className="personal-dashboard-grid advanced-support-grid">
        <section className="personal-card combined-activity-card">
          <SectionTitle title="最近状态与操作记录" subtitle="动态和操作合并展示，图谱保持大画布" />
          {combinedActivityItems.length === 0 ? (
            <EmptyState text="暂无最近状态和操作记录。" />
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
        <section className="personal-card">
          <SectionTitle title="知识资产分析" subtitle="轻量分析，不依赖额外图表库" />
          <AnalysisBlock title="文档类型分布" items={analysis.fileTypes} />
          <AnalysisBlock title="知识片段来源分布" items={analysis.chunkSources} />
          <AnalysisBlock title="高频关键词" items={analysis.keywords} />
          <AnalysisBlock title="最近活跃趋势" items={analysis.trends} />
        </section>
      </div>
    </section>
  );
}

interface PersonalSharedProps {
  currentNavLabel: string;
  user: User;
  workspace: Workspace;
  documents: DocumentRecord[];
  knowledgeBase: KnowledgeBaseStatus | null;
  chunks: KnowledgeChunk[];
  documentContents: Record<string, DocumentContent>;
  chatMessages: PersonalChatMessage[];
  selectedKnowledgeDocumentIds: string[];
  selectedGraphDocumentIds: string[];
  useKnowledgeBaseForChat: boolean;
  activeChatModelName: string;
  workspaceSettings: WorkspaceSettingRecord[];
  profile: PersonalProfile;
  error: string | null;
  notice: string | null;
  settingSavingKey: string | null;
  settingTestingKey: string | null;
  onNavigate: (page: PersonalPageKey) => void;
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
  onUseKnowledgeBaseForChatChange: (value: boolean) => void;
}

interface PersonalProfile {
  documentCount: number;
  parsedDocumentCount: number;
  indexedDocumentCount: number;
  failedDocumentCount: number;
  pendingParseCount: number;
  pendingIndexCount: number;
  chunkCount: number;
  chatQuestionCount: number;
  knowledgeStatus: string;
  knowledgeStatusText: string;
  knowledgeReady: boolean;
  latestActivityText: string;
  latestActivityAt: string | null;
  vectorType: string;
  rerankStatus: string;
}

function buildPersonalProfile(
  documents: DocumentRecord[],
  knowledgeBase: KnowledgeBaseStatus | null,
  chunks: KnowledgeChunk[],
  chatMessages: PersonalChatMessage[],
  notifications: AdvancedNotification[]
): PersonalProfile {
  const documentCount = knowledgeBase?.document_count ?? documents.length;
  const chunkCount = knowledgeBase?.chunk_count ?? chunks.length;
  const parsedDocumentCount = documents.filter((item) => item.parse_status === 'parsed').length;
  const indexedDocumentCount = documents.filter((item) => item.index_status === 'indexed').length;
  const failedDocumentCount = documents.filter(
    (item) => item.parse_status === 'failed' || item.index_status === 'failed'
  ).length;
  const pendingParseCount = documents.filter((item) => item.parse_status !== 'parsed').length;
  const pendingIndexCount = documents.filter((item) => item.index_status !== 'indexed').length;
  const chatQuestionCount = chatMessages.filter((item) => item.role === 'user').length;
  const latestDocument = documents[0]?.created_at ?? null;
  const latestNotification = notifications[0]?.created_at ?? null;
  const latestActivityAt = latestNotification ?? latestDocument;
  const knowledgeStatus = resolveKnowledgeStatus(knowledgeBase, documents, chunkCount);

  return {
    documentCount,
    parsedDocumentCount,
    indexedDocumentCount,
    failedDocumentCount,
    pendingParseCount,
    pendingIndexCount,
    chunkCount,
    chatQuestionCount,
    knowledgeStatus,
    knowledgeStatusText: statusText(knowledgeStatus),
    knowledgeReady: chunkCount > 0 && knowledgeStatus !== 'empty',
    latestActivityText: latestActivityAt ? formatDate(latestActivityAt) : '未开始',
    latestActivityAt,
    vectorType: 'Milvus',
    rerankStatus: 'ready'
  };
}

function buildHomeMetrics(profile: PersonalProfile): Metric[] {
  return [
    { label: '文档数量', value: String(profile.documentCount) },
    { label: '知识片段数量', value: String(profile.chunkCount) },
    { label: '知识库状态', value: profile.knowledgeStatusText },
    { label: '问答次数', value: String(profile.chatQuestionCount), hint: '当前会话累计问答' },
    { label: '最近更新时间', value: profile.latestActivityText }
  ];
}

function buildDocumentMetrics(profile: PersonalProfile): Metric[] {
  return [
    { label: '文档总数', value: String(profile.documentCount) },
    { label: '已解析数量', value: String(profile.parsedDocumentCount) },
    { label: '已入库数量', value: String(profile.indexedDocumentCount) },
    { label: '知识片段数量', value: String(profile.chunkCount) },
    { label: '失败数量', value: String(profile.failedDocumentCount), tone: profile.failedDocumentCount ? 'danger' : 'normal' }
  ];
}

function buildKnowledgeMetrics(
  profile: PersonalProfile,
  knowledgeBase: KnowledgeBaseStatus | null
): Metric[] {
  return [
    { label: '知识库状态', value: profile.knowledgeStatusText },
    { label: '文档数量', value: String(profile.documentCount) },
    { label: '知识片段数量', value: String(profile.chunkCount) },
    { label: '最近更新时间', value: profile.latestActivityText },
    {
      label: '可问答状态',
      value: profile.knowledgeReady ? '可用于 RAG 问答' : '暂不可用',
      tone: profile.knowledgeReady ? 'normal' : 'warning',
      hint: knowledgeBase?.status ? `后端状态：${statusText(knowledgeBase.status)}` : undefined
    }
  ];
}

function buildRecentOperations(
  documents: DocumentRecord[],
  chatMessages: PersonalChatMessage[],
  profile: PersonalProfile
) {
  const documentOperations = documents.flatMap((document) => [
    {
      id: `upload-${document.id}`,
      type: '上传文档',
      title: '上传文档',
      description: document.filename,
      status: document.parse_status,
      timeLabel: formatDate(document.created_at)
    },
    {
      id: `index-${document.id}`,
      type: '文档入库',
      title: document.index_status === 'indexed' ? '文档已入库' : '文档待入库',
      description: `${document.filename} · ${document.chunk_count ?? 0} 个片段`,
      status: document.index_status,
      timeLabel: formatDate(document.created_at)
    }
  ]);
  const chatOperations = getQuestionTurns(chatMessages).map((item) => ({
    id: `chat-${item.id}`,
    type: '发起问答',
    title: '发起问答',
    description: item.question,
    status: 'ready',
    timeLabel: item.timeLabel
  }));
  const knowledgeOperation =
    profile.chunkCount > 0
      ? [
          {
            id: 'knowledge-searchable',
            type: '知识库已更新',
            title: '知识库已更新',
            description: `${profile.chunkCount} 个片段可用于检索`,
            status: 'indexed',
            timeLabel: profile.latestActivityText
          }
        ]
      : [];
  return [...chatOperations, ...documentOperations, ...knowledgeOperation];
}

function buildReminders(profile: PersonalProfile) {
  const reminders: Array<{
    title: string;
    description: string;
    action: string;
    target: PersonalPageKey;
  }> = [];
  if (profile.pendingParseCount > 0) {
    reminders.push({
      title: '有文档未解析',
      description: `${profile.pendingParseCount} 个文档还未完成解析。`,
      action: '去文档管理',
      target: 'documents'
    });
  }
  if (profile.pendingIndexCount > 0) {
    reminders.push({
      title: '有文档未入库',
      description: `${profile.pendingIndexCount} 个文档还未完成入库。`,
      action: '去知识库',
      target: 'knowledge'
    });
  }
  if (profile.chunkCount === 0) {
    reminders.push({
      title: '知识库暂无可检索内容',
      description: '请先上传并解析文档。',
      action: '去文档管理',
      target: 'documents'
    });
  }
  if (profile.chatQuestionCount === 0) {
    reminders.push({
      title: '还没有进行过问答',
      description: '知识库可用后可以发起第一次问答。',
      action: '去问答',
      target: 'chat'
    });
  }
  if (profile.pendingIndexCount > 0 && profile.chunkCount > 0) {
    reminders.push({
      title: '向量库需要更新',
      description: '部分文档尚未入库，问答结果可能不完整。',
      action: '去知识库',
      target: 'knowledge'
    });
  }
  return reminders;
}

function buildAssetAnalysis(
  documents: DocumentRecord[],
  chunks: KnowledgeChunk[],
  chatMessages: PersonalChatMessage[]
) {
  const fileTypes = countBy(documents.map((item) => item.file_type || 'unknown'));
  const chunkSources = countBy(chunks.map((item) => item.filename));
  const keywords = countBy(chunks.flatMap((item) => extractKeywords(item.content)).slice(0, 80));
  const trends: Array<[string, string]> = [
    ['文档', `${documents.length} 个`],
    ['片段', `${chunks.length} 个`],
    ['问答', `${chatMessages.filter((item) => item.role === 'user').length} 次`]
  ];
  return {
    fileTypes: toAnalysisItems(fileTypes),
    chunkSources: toAnalysisItems(chunkSources),
    keywords: toAnalysisItems(keywords),
    trends
  };
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    const key = value || '暂无';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function toAnalysisItems(record: Record<string, number>): Array<[string, string]> {
  const entries = Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, count]) => [label, `${count}`] as [string, string]);
  return entries.length ? entries : [['暂无', '0']];
}

function getQuestionTurns(messages: PersonalChatMessage[]) {
  return messages
    .filter((message) => message.role === 'user')
    .map((message, index) => ({
      id: message.id,
      question: message.content,
      timeLabel: `第 ${index + 1} 轮`
    }))
    .reverse();
}

function resolveKnowledgeStatus(
  knowledgeBase: KnowledgeBaseStatus | null,
  documents: DocumentRecord[],
  chunkCount: number
) {
  if (!knowledgeBase || chunkCount === 0) return 'empty';
  if (documents.some((item) => item.parse_status === 'parsing' || item.index_status === 'indexing')) {
    return 'building';
  }
  if (documents.some((item) => item.parse_status !== 'parsed' || item.index_status !== 'indexed')) {
    return 'needs_update';
  }
  return knowledgeBase.status || 'ready';
}

function statusText(value: string) {
  const map: Record<string, string> = {
    empty: '暂无数据',
    building: '构建中',
    needs_update: '需要更新',
    documents_uploaded: '已上传文档',
    ready: '可检索',
    uploaded: '已上传',
    pending: '待处理',
    parsing: '解析中',
    parsed: '已解析',
    indexing: '入库中',
    indexed: '已入库',
    unsupported: '暂不支持解析',
    asset_only: '仅保存',
    failed: '失败',
    configured: '已配置'
  };
  return map[value] ?? value;
}

function notificationType(action: string) {
  if (action.includes('uploaded')) return '文档已上传';
  if (action.includes('asset')) return '文件资产已保存';
  if (action.includes('deleted')) return '删除文档';
  if (action.includes('chat')) return '问答已完成';
  if (action.includes('failed')) return '错误提醒';
  return '系统提醒';
}

function formatDate(value?: string | null) {
  return formatBeijingDateTime(value);
}

function documentUploaderName(document: DocumentRecord | undefined, user: User) {
  if (!document) return getDisplayName(user);
  return document.user_id === user.id ? getDisplayName(user) : '其他用户';
}

function summarize(content: string, maxLength: number) {
  if (!content) return '暂无内容';
  const cleaned = content.replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}...` : cleaned;
}

function extractKeywords(content: string) {
  const chinese = Array.from(content.matchAll(/[\u4e00-\u9fa5]{2,6}/g)).map((item) => item[0]);
  const english = Array.from(content.matchAll(/[A-Za-z][A-Za-z0-9_-]{2,24}/g)).map((item) => item[0]);
  return Array.from(new Set([...chinese, ...english])).slice(0, 8);
}

function highlightText(text: string, keyword: string) {
  if (!keyword.trim()) return text;
  return text;
}

async function copyText(text: string) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  }
}

function PageHeading({
  eyebrow,
  title,
  description,
  actionLabel,
  actionIcon: ActionIcon,
  onAction
}: {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionIcon?: typeof RefreshCw;
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
          {ActionIcon && <ActionIcon size={18} aria-hidden="true" />}
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function IsolationNotice() {
  return (
    <div className="isolation-notice">
      <ShieldCheck size={18} aria-hidden="true" />
      <span>当前空间：个人工作区，数据仅个人可见，不与企业工作区同步。</span>
    </div>
  );
}

function Feedback({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error && <p className="form-error">{error}</p>}
      {notice && <p className="form-success">{notice}</p>}
    </>
  );
}

function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="personal-metric-grid">
      {metrics.map((metric) => (
        <article className={`personal-metric ${metric.tone ?? 'normal'}`} key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          {metric.hint && <small>{metric.hint}</small>}
        </article>
      ))}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick
}: {
  icon: typeof Upload;
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

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="section-title compact-title">
      <Sparkles size={18} aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        {subtitle && <span>{subtitle}</span>}
      </div>
    </div>
  );
}

function EmptyState({
  text,
  actionLabel,
  onAction
}: {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="personal-empty">
      <Info size={20} aria-hidden="true" />
      <span>{text}</span>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  return <span className={`status-badge ${value}`}>{statusText(value)}</span>;
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function DefinitionList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="definition-list">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
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
        {items.map(([label, value]) => (
          <span key={`${title}-${label}`}>
            {label}：{value}
          </span>
        ))}
      </div>
    </div>
  );
}

function DocumentDetailModal({
  document,
  chunkCount,
  onClose,
  onViewChunks,
  onAsk,
  onDelete
}: {
  document: DocumentRecord;
  chunkCount: number;
  onClose: () => void;
  onViewChunks: () => void;
  onAsk: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="detail-modal" role="dialog" aria-modal="true" aria-label="文档详情">
        <SectionTitle title="文档详情" subtitle={document.filename} />
        <DefinitionList
          items={[
            ['文件名', document.filename],
            ['类型', document.file_type || '未知'],
            ['上传时间', formatDate(document.created_at)],
            ['解析状态', statusText(document.parse_status)],
            ['入库状态', statusText(document.index_status)],
            ['知识片段数量', String(chunkCount ?? 0)],
            ['所属空间', '个人工作区'],
            ['文档摘要', chunkCount > 0 ? `已生成 ${chunkCount} 个知识片段。` : '暂无摘要'],
            ['失败原因', document.parse_status === 'failed' || document.index_status === 'failed' ? '请检查文件内容或重新解析。' : '暂无']
          ]}
        />
        <div className="modal-actions">
          <button type="button" onClick={onViewChunks}>查看知识片段</button>
          <button type="button" onClick={onAsk}>基于此文档提问</button>
          <button type="button" disabled title="暂未开放">重新解析</button>
          <button className="danger-link" type="button" onClick={onDelete}>删除文档</button>
          <button type="button" onClick={onClose}>关闭</button>
        </div>
      </section>
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
      <section className="detail-modal large" role="dialog" aria-modal="true" aria-label="文档全文">
        <SectionTitle title="查看整个文档" subtitle={document.filename} />
        <DefinitionList
          items={[
            ['库名', document.filename],
            ['文档 ID', document.id],
            ['工作区 ID', document.workspace_id],
            ['类型', document.file_type || '未知'],
            ['解析状态', statusText(document.parse_status)],
            ['入库状态', statusText(document.index_status)],
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
      </section>
    </div>
  );
}

function ChunkDetailModal({
  chunk,
  keywords,
  onClose,
  onAsk,
  onCopy
}: {
  chunk: KnowledgeChunk;
  keywords: string[];
  onClose: () => void;
  onAsk: () => void;
  onCopy: () => void | Promise<void>;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="detail-modal large" role="dialog" aria-modal="true" aria-label="片段详情">
        <SectionTitle title="片段详情" subtitle={chunk.filename} />
        <DefinitionList
          items={[
            ['来源文档', chunk.filename],
            ['片段编号', `#${chunk.chunk_index + 1}`],
            ['相关关键词', keywords.length ? keywords.join('、') : '暂无'],
            ['所属空间', '个人工作区']
          ]}
        />
        <div className="full-content">{chunk.content}</div>
        <div className="modal-actions">
          <button type="button" onClick={onAsk}>基于此片段提问</button>
          <button type="button" onClick={onCopy}>复制内容</button>
          <button type="button" onClick={onClose}>关闭</button>
        </div>
      </section>
    </div>
  );
}
