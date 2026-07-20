import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ClipboardCopy,
  FileSearch,
  MessageSquare,
  PanelLeftOpen,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';

import type { DocumentRecord, KnowledgeChunk } from '../../types';
import { Button } from '../ui/Button';
import { ContextSidebar } from '../ui/ContextSidebar';
import { DataTable } from '../ui/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../ui/AsyncState';
import { SearchInput, SegmentedControl, SelectField } from '../ui/FormControls';
import { Drawer, Modal } from '../ui/Overlay';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge } from '../ui/StatusBadge';
import {
  ChunkDetailModal,
  copyText,
  DefinitionList,
  documentUploaderName,
  Feedback,
  formatDate,
  knowledgeMetrics,
  MetricStrip,
  PersonalIsolationNotice,
  SectionHeader,
  statusText,
  summarize,
} from './shared';
import type { PersonalSharedProps } from './types';

interface KnowledgeFilters {
  query: string;
  status: 'all' | 'ready' | 'processing' | 'failed';
  uploader: string;
}

const EMPTY_FILTERS: KnowledgeFilters = { query: '', status: 'all', uploader: '' };
type LibraryTab = 'overview' | 'content' | 'chunks' | 'retrieval' | 'index';

export interface PersonalKnowledgeProps extends PersonalSharedProps {
  searchQuery: string;
  searchResults: KnowledgeChunk[];
  searching: boolean;
  documentFilter: string;
  onSearchQueryChange: (value: string) => void;
  onDocumentFilterChange: (documentId: string) => void;
  onSearch: () => void;
  onClearSearch: () => void;
  onRefresh: () => void;
}

function matchesStatus(document: DocumentRecord, status: KnowledgeFilters['status']) {
  if (status === 'all') return true;
  if (status === 'ready') return document.parse_status === 'parsed' && document.index_status === 'indexed';
  if (status === 'failed') return document.parse_status === 'failed' || document.index_status === 'failed';
  return ['queued', 'pending', 'parsing'].includes(document.parse_status)
    || ['pending', 'indexing'].includes(document.index_status);
}

export function PersonalKnowledge({
  user,
  documents,
  knowledgeBase,
  chunks,
  documentContents,
  workspaceSettings,
  selectedKnowledgeDocumentIds,
  searchQuery,
  searchResults,
  searching,
  loading,
  documentFilter,
  error,
  notice,
  profile,
  onNavigate,
  onPrepareQuestion,
  onLoadDocumentContent,
  onSelectedKnowledgeDocumentIdsChange,
  onSearchQueryChange,
  onDocumentFilterChange,
  onSearch,
  onClearSearch,
  onRefresh,
}: PersonalKnowledgeProps) {
  const [filters, setFilters] = useState<KnowledgeFilters>({ ...EMPTY_FILTERS, query: searchQuery });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedChunk, setSelectedChunk] = useState<KnowledgeChunk | null>(null);
  const [selectedLibrary, setSelectedLibrary] = useState<DocumentRecord | null>(null);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('overview');
  const [fullDocument, setFullDocument] = useState<DocumentRecord | null>(null);
  const [loadingContentId, setLoadingContentId] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [retrievalTestQuery, setRetrievalTestQuery] = useState(searchQuery);

  useEffect(() => {
    setFilters((current) => ({ ...current, query: searchQuery }));
  }, [searchQuery]);

  const filteredLibraries = useMemo(() => documents.filter((document) => {
    const matchesLibrary = documentFilter === 'all' || document.id === documentFilter;
    const matchesUploader = documentUploaderName(document, user)
      .toLowerCase()
      .includes(filters.uploader.trim().toLowerCase());
    return matchesLibrary && matchesUploader && matchesStatus(document, filters.status);
  }), [documentFilter, documents, filters.status, filters.uploader, user]);

  const visibleLibraryIds = new Set(filteredLibraries.map((document) => document.id));
  const chunkSource = searchQuery.trim() ? searchResults : chunks;
  const visibleChunks = chunkSource.filter((chunk) => visibleLibraryIds.has(chunk.document_id));
  const activeLibraryChunks = selectedLibrary
    ? chunks.filter((chunk) => chunk.document_id === selectedLibrary.id)
    : [];
  const vectorConfig = useMemo(
    () => workspaceSettings.find((item) => item.setting_key === 'personal_vector_config')?.setting_value ?? {},
    [workspaceSettings]
  );
  const scopedSearchResults = selectedLibrary
    ? searchResults.filter((chunk) => chunk.document_id === selectedLibrary.id)
    : [];

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    onSearchQueryChange('');
    onClearSearch();
    onDocumentFilterChange('all');
    setCopyNotice(null);
  }

  function toggleChatLibrary(documentId: string) {
    onSelectedKnowledgeDocumentIdsChange(
      selectedKnowledgeDocumentIds.includes(documentId)
        ? selectedKnowledgeDocumentIds.filter((id) => id !== documentId)
        : [...selectedKnowledgeDocumentIds, documentId]
    );
  }

  async function openFullDocument(document: DocumentRecord) {
    setFullDocument(document);
    setContentError(null);
    if (documentContents[document.id]) return;
    setLoadingContentId(document.id);
    try {
      await onLoadDocumentContent(document);
    } catch (loadError) {
      setContentError(loadError instanceof Error ? loadError.message : '文档全文加载失败，请稍后重试。');
    } finally {
      setLoadingContentId(null);
    }
  }

  function openLibrary(document: DocumentRecord, tab: LibraryTab = 'overview') {
    setSelectedLibrary(document);
    setLibraryTab(tab);
    setContentError(null);
    if (tab === 'retrieval') onDocumentFilterChange(document.id);
  }

  return (
    <section className="personal-workbench-v2 personal-page-knowledge">
      <PageHeader
        eyebrow="个人工作区"
        title="知识库"
        description="每个文件对应一个独立知识库，可检索片段、查看全文并选择多个知识库用于 RAG 问答。"
        actions={<Button icon={RefreshCw} loading={loading} onClick={onRefresh}>刷新知识库</Button>}
      />
      <PersonalIsolationNotice />
      <Feedback error={error} notice={copyNotice ?? notice} />
      {error && documents.length === 0 ? <ErrorState title="知识库加载失败" description={error} onRetry={onRefresh} /> : null}
      {loading && documents.length === 0 && chunks.length === 0 ? <LoadingState label="正在加载个人知识库" /> : null}
      <MetricStrip metrics={knowledgeMetrics(profile)} />

      <div className="personal-context-layout">
        <ContextSidebar
          title="文件知识库"
          open={sidebarOpen}
          activeKey={documentFilter}
          items={[
            { key: 'all', label: '全部知识库', count: documents.length },
            ...documents.map((document) => ({ key: document.id, label: document.filename, count: document.chunk_count ?? 0 })),
          ]}
          onSelect={onDocumentFilterChange}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="personal-context-content">
          <section className="personal-section">
            <form
              className="personal-filter-toolbar personal-knowledge-toolbar"
              onSubmit={(event) => {
                event.preventDefault();
                onSearch();
              }}
            >
              <Button size="sm" variant="ghost" icon={PanelLeftOpen} onClick={() => setSidebarOpen(true)}>知识库列表</Button>
              <SearchInput
                value={filters.query}
                placeholder="输入关键词检索知识片段"
                onChange={(event) => {
                  const query = event.target.value;
                  setFilters((current) => ({ ...current, query }));
                  onSearchQueryChange(query);
                }}
                onClear={() => {
                  setFilters((current) => ({ ...current, query: '' }));
                  onSearchQueryChange('');
                  onClearSearch();
                }}
              />
              <SelectField
                value={documentFilter}
                onChange={(event) => onDocumentFilterChange(event.target.value)}
                options={[
                  { value: 'all', label: '全部库名' },
                  ...documents.map((document) => ({ value: document.id, label: document.filename })),
                ]}
              />
              <input
                className="personal-filter-input"
                value={filters.uploader}
                placeholder="上传人名称"
                aria-label="上传人名称"
                onChange={(event) => setFilters((current) => ({ ...current, uploader: event.target.value }))}
              />
              <SelectField
                value={filters.status}
                onChange={(event) => setFilters((current) => ({
                  ...current,
                  status: event.target.value as KnowledgeFilters['status'],
                }))}
                options={[
                  { value: 'all', label: '全部状态' },
                  { value: 'ready', label: '可检索' },
                  { value: 'processing', label: '处理中' },
                  { value: 'failed', label: '失败' },
                ]}
              />
              <Button size="sm" variant="primary" icon={Search} loading={searching} type="submit">检索</Button>
              <Button size="sm" variant="ghost" icon={RotateCcw} onClick={resetFilters}>重置</Button>
              <span className="personal-result-count">结果 {visibleChunks.length} 条</span>
            </form>
          </section>

          <section className="personal-section">
            <SectionHeader title="文件知识库" description="库名与文件名一致，所有数据限定在当前个人工作区" />
            {documents.length === 0 ? (
              <EmptyState
                title="当前个人知识库暂无内容"
                description="请先上传并解析文档。"
                action={{ label: '去上传文档', onClick: () => onNavigate('documents') }}
              />
            ) : (
              <DataTable<DocumentRecord>
                rows={filteredLibraries}
                rowKey={(document) => document.id}
                emptyText="没有找到符合筛选条件的文件知识库"
                columns={[
                  {
                    key: 'library', label: '库名', render: (document) => (
                      <button className="personal-file-link" type="button" onClick={() => openLibrary(document)}>
                        <BookOpen size={16} aria-hidden="true" />
                        <span title={document.filename}>{document.filename}</span>
                      </button>
                    ),
                  },
                  { key: 'uploader', label: '上传人', width: '110px', render: (document) => documentUploaderName(document, user) },
                  { key: 'parse', label: '解析', width: '95px', render: (document) => <StatusBadge status={document.parse_status} /> },
                  { key: 'index', label: '入库', width: '95px', render: (document) => <StatusBadge status={document.index_status} /> },
                  { key: 'chunks', label: '片段', width: '70px', render: (document) => document.chunk_count ?? 0 },
                  { key: 'scope', label: '隔离范围', width: '120px', render: (document) => document.permission_scope || 'workspace' },
                  { key: 'time', label: '上传时间', width: '170px', render: (document) => formatDate(document.created_at) },
                  {
                    key: 'actions', label: '操作', width: '300px', render: (document) => (
                      <div className="personal-row-actions">
                        <Button size="sm" variant="ghost" onClick={() => void openFullDocument(document)}>全文</Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleChatLibrary(document.id)}>
                          {selectedKnowledgeDocumentIds.includes(document.id) ? '取消选择' : '选择问答'}
                        </Button>
                        <Button size="sm" variant="ghost" icon={MessageSquare} onClick={() => onPrepareQuestion(`请基于《${document.filename}》回答：`, [document.id])}>对话</Button>
                        <Button size="sm" variant="ghost" icon={FileSearch} onClick={() => openLibrary(document, 'chunks')}>片段</Button>
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </section>

          <section className="personal-section">
            <SectionHeader title="知识片段" description="默认显示摘要，完整内容通过详情弹窗查看" />
            <DataTable<KnowledgeChunk>
              rows={visibleChunks}
              rowKey={(chunk) => chunk.id}
              loading={searching}
              emptyText={chunks.length === 0 ? '当前个人知识库暂无可检索内容' : '没有找到相关内容，请尝试更换关键词'}
              columns={[
                { key: 'source', label: '来源文档', width: '220px', render: (chunk) => chunk.filename },
                { key: 'number', label: '片段', width: '80px', render: (chunk) => `#${chunk.chunk_index + 1}` },
                { key: 'summary', label: '内容摘要', render: (chunk) => <p className="personal-chunk-summary">{summarize(chunk.content, 180)}</p> },
                {
                  key: 'score', label: '相关度', width: '90px', render: (chunk) => (
                    typeof chunk.score === 'number' ? chunk.score.toFixed(2) : '暂无'
                  ),
                },
                {
                  key: 'actions', label: '操作', width: '250px', render: (chunk) => (
                    <div className="personal-row-actions">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedChunk(chunk)}>查看</Button>
                      <Button size="sm" variant="ghost" icon={MessageSquare} onClick={() => onPrepareQuestion(`请基于这个片段回答：${summarize(chunk.content, 80)}`, [chunk.document_id])}>提问</Button>
                      <Button size="sm" variant="ghost" icon={ClipboardCopy} onClick={async () => {
                        await copyText(chunk.content);
                        setCopyNotice('片段内容已复制。');
                      }}>复制</Button>
                    </div>
                  ),
                },
              ]}
            />
          </section>
        </div>
      </div>

      <Drawer
        open={Boolean(selectedLibrary)}
        title="知识库详情"
        description={selectedLibrary?.filename}
        onClose={() => setSelectedLibrary(null)}
        footer={selectedLibrary ? (
          <>
            <Button onClick={() => void openFullDocument(selectedLibrary)}>查看完整文档</Button>
            <Button variant="primary" icon={MessageSquare} onClick={() => onPrepareQuestion(`请基于《${selectedLibrary.filename}》回答：`, [selectedLibrary.id])}>进入对话</Button>
          </>
        ) : undefined}
      >
        {selectedLibrary ? (
          <div className="personal-library-drawer">
            <SegmentedControl<LibraryTab>
              value={libraryTab}
              ariaLabel="知识库详情标签"
              onChange={(tab) => {
                setLibraryTab(tab);
                if (tab === 'retrieval') onDocumentFilterChange(selectedLibrary.id);
              }}
              options={[
                { value: 'overview', label: '概览' },
                { value: 'content', label: '全文' },
                { value: 'chunks', label: '片段' },
                { value: 'retrieval', label: '检索测试' },
                { value: 'index', label: '索引设置' },
              ]}
            />
            {libraryTab === 'overview' ? (
              <DefinitionList items={[
                ['库名', selectedLibrary.filename],
                ['上传人', documentUploaderName(selectedLibrary, user)],
                ['文件类型', selectedLibrary.file_type || '未知'],
                ['解析状态', statusText(selectedLibrary.parse_status)],
                ['入库状态', statusText(selectedLibrary.index_status)],
                ['知识片段', String(selectedLibrary.chunk_count ?? 0)],
                ['所属空间', '个人工作区'],
                ['隔离字段', selectedLibrary.permission_scope],
                ['上传时间', formatDate(selectedLibrary.created_at)],
              ]} />
            ) : null}
            {libraryTab === 'content' ? (
              <div className="personal-drawer-panel">
                <p>查看当前文件知识库对应的真实解析文本。</p>
                {loadingContentId === selectedLibrary.id ? <LoadingState compact label="正在加载文档全文" /> : null}
                {!loadingContentId && contentError ? (
                  <ErrorState
                    compact
                    title="文档全文加载失败"
                    description={contentError}
                    onRetry={() => void openFullDocument(selectedLibrary)}
                  />
                ) : null}
                {!loadingContentId && !contentError && documentContents[selectedLibrary.id]?.content ? (
                  <div className="personal-full-content">{documentContents[selectedLibrary.id].content}</div>
                ) : null}
                {!loadingContentId && !contentError && !documentContents[selectedLibrary.id]?.content ? (
                  <EmptyState
                    compact
                    title="全文尚未加载或暂无解析文本"
                    action={{ label: '加载全文', onClick: () => void openFullDocument(selectedLibrary), icon: BookOpen }}
                  />
                ) : null}
                {documentContents[selectedLibrary.id]?.content ? (
                  <Button icon={BookOpen} onClick={() => void openFullDocument(selectedLibrary)}>在大窗口查看</Button>
                ) : null}
              </div>
            ) : null}
            {libraryTab === 'chunks' ? (
              activeLibraryChunks.length ? (
                <div className="personal-mini-chunks">
                  {activeLibraryChunks.map((chunk) => (
                    <button type="button" key={chunk.id} onClick={() => setSelectedChunk(chunk)}>
                      <strong>片段 #{chunk.chunk_index + 1}</strong>
                      <span>{summarize(chunk.content, 100)}</span>
                    </button>
                  ))}
                </div>
              ) : <EmptyState compact title="当前知识库暂无片段" />
            ) : null}
            {libraryTab === 'retrieval' ? (
              <div className="personal-drawer-panel">
                <form
                  className="personal-retrieval-test"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onDocumentFilterChange(selectedLibrary.id);
                    onSearchQueryChange(retrievalTestQuery);
                    onSearch();
                  }}
                >
                  <SearchInput
                    label="检索测试关键词"
                    value={retrievalTestQuery}
                    placeholder="输入关键词，仅检索当前文件知识库"
                    onChange={(event) => {
                      setRetrievalTestQuery(event.target.value);
                      onSearchQueryChange(event.target.value);
                    }}
                    onClear={() => {
                      setRetrievalTestQuery('');
                      onSearchQueryChange('');
                      onClearSearch();
                    }}
                  />
                  <Button variant="primary" icon={Search} loading={searching} disabled={!retrievalTestQuery.trim()} type="submit">检索当前知识库</Button>
                </form>
                <DataTable<KnowledgeChunk>
                  rows={scopedSearchResults}
                  rowKey={(chunk) => chunk.id}
                  loading={searching}
                  emptyText="当前知识库暂无检索结果"
                  columns={[
                    { key: 'chunk', label: '片段', width: '76px', render: (chunk) => `#${chunk.chunk_index + 1}` },
                    { key: 'summary', label: '命中内容', render: (chunk) => summarize(chunk.content, 150) },
                    { key: 'score', label: '相关度', width: '80px', render: (chunk) => typeof chunk.score === 'number' ? chunk.score.toFixed(2) : '暂无' },
                    { key: 'action', label: '操作', width: '80px', render: (chunk) => <Button size="sm" variant="ghost" onClick={() => setSelectedChunk(chunk)}>查看</Button> },
                  ]}
                />
              </div>
            ) : null}
            {libraryTab === 'index' ? (
              <div className="personal-drawer-panel">
                {loading ? (
                  <LoadingState compact label="正在加载个人向量配置" />
                ) : (
                  <>
                    <DefinitionList items={[
                      ['知识库状态', statusText(knowledgeBase?.status ?? profile.knowledgeStatus)],
                      ['向量库类型', String(vectorConfig.vector_type || '未配置')],
                      ['Embedding 模型', String(vectorConfig.embedding_model || '未配置')],
                      ['检索模式', String(vectorConfig.retrieval_mode || '未配置')],
                      ['Top K', vectorConfig.top_k === undefined ? '未配置' : String(vectorConfig.top_k)],
                      ['相似度阈值', vectorConfig.score_threshold === undefined ? '未配置' : String(vectorConfig.score_threshold)],
                      ['Rerank', vectorConfig.rerank_enabled === undefined ? '未配置' : vectorConfig.rerank_enabled ? '开启' : '关闭'],
                      ['切片参数', vectorConfig.chunk_size === undefined ? '未配置' : `${String(vectorConfig.chunk_size)} / 重叠 ${String(vectorConfig.chunk_overlap ?? 0)}`],
                    ]} />
                    <p>索引参数来自个人工作区真实配置；请前往个人设置修改并保存。</p>
                    <Button variant="primary" onClick={() => onNavigate('settings')}>前往个人设置</Button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>

      <Modal
        open={Boolean(fullDocument)}
        title="查看完整文档"
        description={fullDocument?.filename}
        size="xl"
        onClose={() => {
          setFullDocument(null);
          setContentError(null);
        }}
        footer={fullDocument ? (
          <Button variant="primary" icon={MessageSquare} onClick={() => {
            onSelectedKnowledgeDocumentIdsChange([fullDocument.id]);
            onPrepareQuestion(`请基于《${fullDocument.filename}》回答：`, [fullDocument.id]);
            setFullDocument(null);
          }}>基于此知识库提问</Button>
        ) : undefined}
      >
        {fullDocument ? (
          <>
            <DefinitionList items={[
              ['库名', fullDocument.filename],
              ['文档 ID', fullDocument.id],
              ['工作区 ID', fullDocument.workspace_id],
              ['类型', fullDocument.file_type || '未知'],
              ['解析状态', statusText(fullDocument.parse_status)],
              ['入库状态', statusText(fullDocument.index_status)],
              ['片段数量', String(documentContents[fullDocument.id]?.chunk_count ?? fullDocument.chunk_count ?? 0)],
              ['所属空间', '个人工作区'],
            ]} />
            {loadingContentId === fullDocument.id ? (
              <LoadingState label="正在加载文档全文" />
            ) : contentError ? (
              <ErrorState
                title="文档全文加载失败"
                description={contentError}
                onRetry={() => void openFullDocument(fullDocument)}
              />
            ) : (
              <div className="personal-full-content">
                {documentContents[fullDocument.id]?.content || '当前文档暂无可展示的解析文本。'}
              </div>
            )}
          </>
        ) : null}
      </Modal>

      <ChunkDetailModal
        open={Boolean(selectedChunk)}
        chunk={selectedChunk}
        onClose={() => setSelectedChunk(null)}
        onAsk={(chunk) => {
          onPrepareQuestion(`请基于这个片段回答：${summarize(chunk.content, 80)}`, [chunk.document_id]);
          setSelectedChunk(null);
        }}
        onCopy={async (chunk) => {
          await copyText(chunk.content);
          setCopyNotice('片段内容已复制。');
        }}
      />
    </section>
  );
}
