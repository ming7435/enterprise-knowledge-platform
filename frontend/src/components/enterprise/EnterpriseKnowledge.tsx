import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ClipboardCopy, Eye, MessageSquare, RefreshCw, RotateCcw, Search } from 'lucide-react';

import type { DocumentRecord, KnowledgeChunk } from '../../types';
import { Button } from '../ui/Button';
import { DataTable } from '../ui/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../ui/AsyncState';
import { SearchInput, SegmentedControl, SelectField } from '../ui/FormControls';
import { Drawer, Modal } from '../ui/Overlay';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge } from '../ui/StatusBadge';
import {
  copyText,
  DefinitionList,
  enterpriseKnowledgeMetrics,
  enterpriseUploaderName,
  EnterpriseIsolationNotice,
  Feedback,
  formatDate,
  MetricStrip,
  SectionHeader,
  statusText,
  summarize,
} from './shared';
import type { EnterpriseSharedProps } from './types';

type LibraryTab = 'overview' | 'content' | 'chunks' | 'retrieval';

export interface EnterpriseKnowledgeProps extends EnterpriseSharedProps {
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

export function EnterpriseKnowledge({
  user,
  workspace,
  documents,
  chunks,
  members,
  documentContents,
  profile,
  loading,
  error,
  notice,
  searchQuery,
  searchResults,
  searching,
  documentFilter,
  onNavigate,
  onPrepareQuestion,
  onLoadDocumentContent,
  onSearchQueryChange,
  onDocumentFilterChange,
  onSearch,
  onClearSearch,
  onRefresh,
}: EnterpriseKnowledgeProps) {
  const [libraryQuery, setLibraryQuery] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLibrary, setSelectedLibrary] = useState<DocumentRecord | null>(null);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('overview');
  const [selectedChunk, setSelectedChunk] = useState<KnowledgeChunk | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  useEffect(() => {
    if (documentFilter === 'all') return;
    const target = documents.find((item) => item.id === documentFilter);
    if (target) setSelectedLibrary(target);
  }, [documentFilter, documents]);

  const filteredLibraries = useMemo(() => documents.filter((item) => {
    const ready = item.parse_status === 'parsed' && item.index_status === 'indexed';
    const failed = item.parse_status === 'failed' || item.index_status === 'failed';
    const statusMatches = statusFilter === 'all'
      || (statusFilter === 'ready' && ready)
      || (statusFilter === 'failed' && failed)
      || (statusFilter === 'processing' && !ready && !failed);
    return item.filename.toLowerCase().includes(libraryQuery.trim().toLowerCase())
      && enterpriseUploaderName(item, user, members).toLowerCase().includes(uploaderFilter.trim().toLowerCase())
      && statusMatches;
  }), [documents, libraryQuery, members, statusFilter, uploaderFilter, user]);
  const selectedChunks = selectedLibrary
    ? chunks.filter((item) => item.document_id === selectedLibrary.id)
    : [];
  const visibleResults = searchQuery.trim()
    ? searchResults
    : documentFilter === 'all'
      ? chunks
      : chunks.filter((item) => item.document_id === documentFilter);

  function resetFilters() {
    setLibraryQuery('');
    setUploaderFilter('');
    setStatusFilter('all');
    onDocumentFilterChange('all');
    onClearSearch();
  }

  async function openLibrary(document: DocumentRecord, tab: LibraryTab = 'overview') {
    setSelectedLibrary(document);
    setLibraryTab(tab);
    onDocumentFilterChange(document.id);
    setContentError(null);
    if (tab !== 'content' || documentContents[document.id]) return;
    setContentLoading(true);
    try {
      await onLoadDocumentContent(document);
    } catch (reason) {
      setContentError(reason instanceof Error ? reason.message : '企业文档全文加载失败');
    } finally {
      setContentLoading(false);
    }
  }

  return (
    <section className="personal-workbench-v2 enterprise-workbench-v2 personal-page-knowledge">
      <PageHeader
        eyebrow="企业工作区"
        title="知识库"
        description="每个企业文件对应一个独立知识库，可查看全文、知识片段并按所选知识库检索。"
        actions={<Button icon={RefreshCw} loading={loading} onClick={onRefresh}>刷新知识库</Button>}
      />
      <EnterpriseIsolationNotice />
      <Feedback error={error} notice={notice} />
      {error && !documents.length ? <ErrorState title="企业知识库加载失败" description={error} onRetry={onRefresh} /> : null}
      {loading && !documents.length ? <LoadingState label="正在加载企业知识库" /> : null}
      <MetricStrip metrics={enterpriseKnowledgeMetrics(profile)} />

      <section className="personal-section">
        <div className="personal-filter-toolbar">
          <SearchInput value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} onClear={() => setLibraryQuery('')} placeholder="按库名筛选" />
          <input className="personal-filter-input" value={uploaderFilter} onChange={(event) => setUploaderFilter(event.target.value)} placeholder="上传人名称" aria-label="上传人名称" />
          <SelectField value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} options={[
            { value: 'all', label: '全部状态' },
            { value: 'ready', label: '可检索' },
            { value: 'processing', label: '构建中' },
            { value: 'failed', label: '失败' },
          ]} />
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={resetFilters}>重置</Button>
        </div>
        <SectionHeader title="文件知识库" description={`当前企业 ${workspace.name} · ${filteredLibraries.length} 个知识库`} />
        {documents.length ? (
          <DataTable<DocumentRecord>
            rows={filteredLibraries}
            rowKey={(item) => item.id}
            emptyText="没有找到相关内容，请尝试更换关键词"
            columns={[
              { key: 'library', label: '库名', render: (item) => <button className="personal-file-link" type="button" onClick={() => void openLibrary(item)}><BookOpen size={16} aria-hidden="true" /><span>{item.filename}</span></button> },
              { key: 'uploader', label: '上传人', width: '120px', render: (item) => enterpriseUploaderName(item, user, members) },
              { key: 'type', label: '类型', width: '90px', render: (item) => item.file_type || '未知' },
              { key: 'status', label: '状态', width: '100px', render: (item) => <StatusBadge status={item.index_status === 'indexed' ? 'ready' : item.index_status} /> },
              { key: 'chunks', label: '片段', width: '70px', render: (item) => item.chunk_count ?? 0 },
              { key: 'time', label: '更新时间', width: '170px', render: (item) => formatDate(item.created_at) },
              { key: 'actions', label: '操作', width: '240px', render: (item) => <div className="personal-row-actions"><Button size="sm" variant="ghost" icon={Eye} onClick={() => void openLibrary(item, 'content')}>全文</Button><Button size="sm" variant="ghost" onClick={() => void openLibrary(item, 'chunks')}>片段</Button><Button size="sm" variant="ghost" icon={MessageSquare} onClick={() => onPrepareQuestion(`请基于企业知识库《${item.filename}》回答：`, [item.id])}>对话</Button></div> },
            ]}
          />
        ) : <EmptyState title="当前企业知识库暂无内容" description="请先上传并解析企业文档。" action={profile.canUpload ? { label: '去上传文档', onClick: () => onNavigate('documents'), icon: BookOpen } : undefined} />}
      </section>

      <section className="personal-section">
        <SectionHeader title="企业知识检索" description="真实调用当前 workspace_id 的知识检索接口" />
        <form className="personal-search-bar" onSubmit={(event) => { event.preventDefault(); onSearch(); }}>
          <SearchInput value={searchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} onClear={onClearSearch} placeholder="输入关键词检索企业知识片段" />
          <SelectField value={documentFilter} onChange={(event) => onDocumentFilterChange(event.target.value)} options={[
            { value: 'all', label: '全部知识库' },
            ...documents.map((item) => ({ value: item.id, label: item.filename })),
          ]} />
          <Button type="submit" variant="primary" icon={Search} loading={searching} disabled={!searchQuery.trim()}>检索</Button>
          <Button icon={RotateCcw} onClick={resetFilters}>重置</Button>
          <span className="personal-result-count">结果 {visibleResults.length}</span>
        </form>
        {visibleResults.length ? (
          <div className="personal-chunk-grid">
            {visibleResults.map((item) => (
              <article className="personal-chunk-card" key={item.id}>
                <header><div><strong>{item.filename}</strong><span>片段 #{item.chunk_index + 1}</span></div>{item.score !== undefined ? <StatusBadge status="ready" label={`相似度 ${Number(item.score).toFixed(2)}`} /> : null}</header>
                <p>{summarize(item.content, 180)}</p>
                <div><Button size="sm" variant="ghost" onClick={() => setSelectedChunk(item)}>查看完整片段</Button><Button size="sm" variant="ghost" icon={MessageSquare} onClick={() => onPrepareQuestion(`请基于企业知识片段 #${item.chunk_index + 1} 回答：`, [item.document_id])}>基于片段提问</Button><Button size="sm" variant="ghost" icon={ClipboardCopy} onClick={() => void copyText(item.content)}>复制</Button></div>
              </article>
            ))}
          </div>
        ) : searchQuery.trim() && !searching ? <EmptyState compact title="没有找到相关内容，请尝试更换关键词" /> : null}
      </section>

      <Drawer open={Boolean(selectedLibrary)} title="企业知识库详情" description={selectedLibrary?.filename} onClose={() => setSelectedLibrary(null)}>
        {selectedLibrary ? (
          <>
            <SegmentedControl value={libraryTab} onChange={(value) => { const tab = value as LibraryTab; setLibraryTab(tab); if (tab === 'content') void openLibrary(selectedLibrary, tab); }} options={[
              { value: 'overview', label: '概览' }, { value: 'content', label: '全文' }, { value: 'chunks', label: '片段' }, { value: 'retrieval', label: '检索' },
            ]} />
            {libraryTab === 'overview' ? <DefinitionList items={[
              ['库名', selectedLibrary.filename], ['文档类型', selectedLibrary.file_type || '未知'],
              ['上传人', enterpriseUploaderName(selectedLibrary, user, members)], ['解析状态', statusText(selectedLibrary.parse_status)],
              ['入库状态', statusText(selectedLibrary.index_status)], ['知识片段', String(selectedChunks.length || selectedLibrary.chunk_count || 0)],
              ['所属企业', workspace.name], ['工作区 ID', workspace.id], ['权限范围', selectedLibrary.permission_scope || '当前企业成员'],
              ['上传时间', formatDate(selectedLibrary.created_at)],
            ]} /> : null}
            {libraryTab === 'content' ? (
              <section className="personal-document-content-preview">
                {contentLoading ? <LoadingState compact label="正在加载企业文档全文" /> : null}
                {!contentLoading && contentError ? <ErrorState compact title="全文加载失败" description={contentError} onRetry={() => void openLibrary(selectedLibrary, 'content')} /> : null}
                {!contentLoading && !contentError ? <div className="personal-full-content">{documentContents[selectedLibrary.id]?.content || '当前文档暂无可展示文本。'}</div> : null}
              </section>
            ) : null}
            {libraryTab === 'chunks' ? (
              selectedChunks.length ? <div className="personal-chunk-list">{selectedChunks.map((item) => <button type="button" key={item.id} onClick={() => setSelectedChunk(item)}><strong>片段 #{item.chunk_index + 1}</strong><span>{summarize(item.content, 120)}</span></button>)}</div> : <EmptyState compact title="该知识库暂无片段" />
            ) : null}
            {libraryTab === 'retrieval' ? <div className="personal-inline-empty"><Search size={18} /><span>关闭详情后，在检索区输入关键词；当前库筛选已自动设为“{selectedLibrary.filename}”。</span></div> : null}
          </>
        ) : null}
      </Drawer>

      <Modal
        open={Boolean(selectedChunk)}
        title="企业知识片段详情"
        description={selectedChunk ? `${selectedChunk.filename} · 片段 #${selectedChunk.chunk_index + 1}` : undefined}
        size="lg"
        onClose={() => setSelectedChunk(null)}
        footer={selectedChunk ? <><Button icon={ClipboardCopy} onClick={() => void copyText(selectedChunk.content)}>复制内容</Button><Button variant="primary" icon={MessageSquare} onClick={() => { onPrepareQuestion(`请基于这个企业知识片段继续回答：${summarize(selectedChunk.content, 80)}`, [selectedChunk.document_id]); setSelectedChunk(null); }}>基于片段提问</Button></> : undefined}
      >
        {selectedChunk ? <><DefinitionList items={[
          ['来源文档', selectedChunk.filename], ['片段编号', `#${selectedChunk.chunk_index + 1}`], ['所属空间', `企业工作区 · ${workspace.name}`],
        ]} /><div className="personal-full-content">{selectedChunk.content}</div></> : null}
      </Modal>
    </section>
  );
}
