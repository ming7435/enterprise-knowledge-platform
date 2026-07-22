import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Eye, FileSearch, FileText, MessageSquare, RefreshCw, RotateCcw, Trash2, Upload } from 'lucide-react';

import type { DocumentRecord } from '../../types';
import { Button } from '../ui/Button';
import { DataTable } from '../ui/DataTable';
import { EmptyState, ErrorState, LoadingState, PermissionDenied } from '../ui/AsyncState';
import { SearchInput, SelectField } from '../ui/FormControls';
import { Drawer } from '../ui/Overlay';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge } from '../ui/StatusBadge';
import {
  DefinitionList,
  enterpriseDocumentMetrics,
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

export interface EnterpriseDocumentsProps extends EnterpriseSharedProps {
  selectedFile: File | null;
  selectedFiles: File[];
  uploading: boolean;
  deletingDocumentId: string | null;
  deletingDocumentIds: string[];
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onDeleteDocument: (document: DocumentRecord) => Promise<boolean>;
  onDeleteDocuments: (documents: DocumentRecord[]) => Promise<boolean>;
  onReprocessDocument: (document: DocumentRecord) => Promise<boolean>;
  onRefresh: () => void;
  onKnowledgeDocumentFilterChange: (documentId: string) => void;
}

export function EnterpriseDocuments({
  user,
  workspace,
  documents,
  chunks,
  members,
  documentContents,
  profile,
  loading,
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
  onReprocessDocument,
  onLoadDocumentContent,
  onRefresh,
  onKnowledgeDocumentFilterChange,
}: EnterpriseDocumentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState('');
  const [parseFilter, setParseFilter] = useState('all');
  const [indexFilter, setIndexFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const filteredDocuments = useMemo(() => documents.filter((document) => (
    document.filename.toLowerCase().includes(query.trim().toLowerCase())
    && enterpriseUploaderName(document, user, members).toLowerCase().includes(uploaderFilter.trim().toLowerCase())
    && (parseFilter === 'all' || document.parse_status === parseFilter)
    && (indexFilter === 'all' || document.index_status === indexFilter)
  )), [documents, indexFilter, members, parseFilter, query, uploaderFilter, user]);
  const selectedDocuments = documents.filter((item) => selectedIds.includes(item.id));
  const fileSummary = selectedFiles.length
    ? selectedFiles.map((item) => item.name).join('、')
    : selectedFile?.name ?? '尚未选择文件';

  function resetFilters() {
    setQuery('');
    setUploaderFilter('');
    setParseFilter('all');
    setIndexFilter('all');
    setSelectedIds([]);
  }

  function openKnowledge(document: DocumentRecord) {
    onKnowledgeDocumentFilterChange(document.id);
    setSelectedDocument(null);
    onNavigate('knowledge');
  }

  async function openDetails(document: DocumentRecord) {
    setSelectedDocument(document);
    setDetailError(null);
    if (documentContents[document.id]) return;
    setDetailLoading(true);
    try {
      await onLoadDocumentContent(document);
    } catch (reason) {
      setDetailError(reason instanceof Error ? reason.message : '企业文档全文加载失败');
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <section className="personal-workbench-v2 enterprise-workbench-v2 personal-page-documents">
      <PageHeader
        eyebrow="企业工作区"
        title="文档管理"
        description="上传企业文档，系统将在当前企业工作区内解析、切片和入库。"
        actions={<Button icon={RefreshCw} loading={loading} onClick={onRefresh}>刷新列表</Button>}
      />
      <EnterpriseIsolationNotice />
      <Feedback error={error} notice={notice} />
      {error && !documents.length ? <ErrorState title="企业文档加载失败" description={error} onRetry={onRefresh} /> : null}
      {loading && !documents.length ? <LoadingState label="正在加载企业文档" /> : null}

      {profile.canUpload ? (
        <section className="personal-upload-surface">
          <div className="personal-upload-copy">
            <span><Upload size={20} aria-hidden="true" /></span>
            <div>
              <strong>上传企业文档</strong>
              <p>支持 PDF、DOCX、TXT、Markdown、表格、演示文稿及常见资产文件，可一次选择多个文件。</p>
              <small title={fileSummary}>{fileSummary}</small>
            </div>
          </div>
          <div className="personal-upload-actions">
            <input ref={fileInputRef} className="personal-visually-hidden" type="file" multiple onChange={onFileChange} accept=".pdf,.docx,.txt,.md,.xlsx,.csv,.pptx,.jpg,.jpeg,.png,.mp3,.mp4,.zip" />
            <Button onClick={() => fileInputRef.current?.click()}>选择文件</Button>
            <Button variant="primary" icon={Upload} loading={uploading} disabled={!selectedFiles.length} onClick={onUpload}>上传文档</Button>
          </div>
        </section>
      ) : <PermissionDenied title="当前角色为只读" description="你可以查看企业文档，但不能上传、重新解析或删除。" />}

      <MetricStrip metrics={enterpriseDocumentMetrics(profile)} />

      <section className="personal-section">
        <div className="personal-filter-toolbar">
          <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery('')} placeholder="按文件名搜索" />
          <SelectField value={parseFilter} onChange={(event) => setParseFilter(event.target.value)} options={[
            { value: 'all', label: '全部解析状态' }, { value: 'queued', label: '排队中' },
            { value: 'pending', label: '待解析' }, { value: 'parsing', label: '解析中' },
            { value: 'parsed', label: '已解析' }, { value: 'failed', label: '失败' },
          ]} />
          <SelectField value={indexFilter} onChange={(event) => setIndexFilter(event.target.value)} options={[
            { value: 'all', label: '全部入库状态' }, { value: 'pending', label: '待入库' },
            { value: 'indexing', label: '入库中' }, { value: 'indexed', label: '已入库' },
            { value: 'failed', label: '失败' },
          ]} />
          <input className="personal-filter-input" value={uploaderFilter} onChange={(event) => setUploaderFilter(event.target.value)} placeholder="上传人名称" aria-label="上传人名称" />
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={resetFilters}>重置</Button>
          <Button
            size="sm"
            variant="danger"
            icon={Trash2}
            disabled={!profile.canManageDocs || !selectedDocuments.length || deletingDocumentIds.length > 0}
            title={!profile.canManageDocs ? '当前角色不能删除文档' : undefined}
            onClick={async () => {
              const succeeded = await onDeleteDocuments(selectedDocuments);
              if (succeeded) setSelectedIds([]);
            }}
          >
            批量删除 {selectedDocuments.length ? `(${selectedDocuments.length})` : ''}
          </Button>
        </div>

        <SectionHeader title="企业文档列表" description={`共 ${filteredDocuments.length} 个符合条件的文档 · 所属企业：${workspace.name}`} />
        {documents.length ? (
          <DataTable<DocumentRecord>
            rows={filteredDocuments}
            rowKey={(item) => item.id}
            emptyText="没有找到相关内容，请尝试更换关键词"
            columns={[
              {
                key: 'select', label: '', width: '42px', render: (item) => (
                  <input type="checkbox" disabled={!profile.canManageDocs} checked={selectedIds.includes(item.id)} onChange={() => setSelectedIds((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id])} aria-label={`选择 ${item.filename}`} />
                ),
              },
              {
                key: 'file', label: '文件', render: (item) => (
                  <button className="personal-file-link" type="button" onClick={() => void openDetails(item)}>
                    <FileText size={16} aria-hidden="true" /><span title={item.filename}>{item.filename}</span>
                  </button>
                ),
              },
              { key: 'uploader', label: '上传人', width: '110px', render: (item) => enterpriseUploaderName(item, user, members) },
              { key: 'parse', label: '解析状态', width: '100px', render: (item) => <StatusBadge status={item.parse_status} /> },
              { key: 'index', label: '入库状态', width: '100px', render: (item) => <StatusBadge status={item.index_status} /> },
              { key: 'chunks', label: '片段', width: '70px', render: (item) => item.chunk_count ?? 0 },
              { key: 'time', label: '上传时间', width: '168px', render: (item) => formatDate(item.created_at) },
              {
                key: 'actions', label: '操作', width: '350px', render: (item) => (
                  <div className="personal-row-actions">
                    <Button size="sm" variant="ghost" icon={Eye} onClick={() => void openDetails(item)}>详情</Button>
                    <Button size="sm" variant="ghost" icon={FileSearch} onClick={() => openKnowledge(item)}>片段</Button>
                    <Button size="sm" variant="ghost" icon={MessageSquare} onClick={() => onPrepareQuestion(`请基于企业文档《${item.filename}》回答：`, [item.id])}>问答</Button>
                    <Button size="sm" variant="ghost" icon={RefreshCw} disabled={!profile.canManageDocs || ['queued', 'parsing'].includes(item.parse_status)} onClick={() => void onReprocessDocument(item)}>重解析</Button>
                    <Button size="sm" variant="ghost" icon={Trash2} disabled={!profile.canManageDocs || deletingDocumentId === item.id || deletingDocumentIds.includes(item.id)} onClick={() => void onDeleteDocument(item)}>删除</Button>
                  </div>
                ),
              },
            ]}
          />
        ) : (
          <EmptyState title="当前企业工作区还没有文档" description="企业成员上传文档后，可构建独立知识库并进行 RAG 问答。" action={profile.canUpload ? { label: '选择文件', onClick: () => fileInputRef.current?.click(), icon: Upload } : undefined} />
        )}
      </section>

      <Drawer
        open={Boolean(selectedDocument)}
        title="企业文档详情"
        description={selectedDocument?.filename}
        onClose={() => setSelectedDocument(null)}
        footer={selectedDocument ? (
          <>
            <Button icon={FileSearch} onClick={() => openKnowledge(selectedDocument)}>查看知识片段</Button>
            <Button icon={MessageSquare} onClick={() => { onPrepareQuestion(`请基于企业文档《${selectedDocument.filename}》回答：`, [selectedDocument.id]); setSelectedDocument(null); }}>基于文档提问</Button>
            <Button icon={RefreshCw} disabled={!profile.canManageDocs} onClick={async () => { if (await onReprocessDocument(selectedDocument)) setSelectedDocument(null); }}>重新解析</Button>
            <Button variant="danger" icon={Trash2} disabled={!profile.canManageDocs} onClick={async () => { if (await onDeleteDocument(selectedDocument)) setSelectedDocument(null); }}>删除文档</Button>
          </>
        ) : undefined}
      >
        {selectedDocument ? (
          <>
            <DefinitionList items={[
              ['文件名', selectedDocument.filename],
              ['类型', selectedDocument.file_type || '未知'],
              ['上传人', enterpriseUploaderName(selectedDocument, user, members)],
              ['上传时间', formatDate(selectedDocument.created_at)],
              ['解析状态', statusText(selectedDocument.parse_status)],
              ['入库状态', statusText(selectedDocument.index_status)],
              ['知识片段', String(chunks.filter((item) => item.document_id === selectedDocument.id).length || selectedDocument.chunk_count || 0)],
              ['所属空间', `企业工作区 · ${workspace.name}`],
              ['权限范围', selectedDocument.permission_scope || '当前企业成员'],
              ['文档摘要', documentContents[selectedDocument.id]?.content ? summarize(documentContents[selectedDocument.id].content, 180) : '全文加载后显示真实摘要'],
              ['失败原因', selectedDocument.processing_error || '暂无'],
            ]} />
            <section className="personal-document-content-preview">
              <SectionHeader title="文档全文 / 解析文本" description="来自当前企业工作区的真实文档内容接口" />
              {detailLoading ? <LoadingState compact label="正在加载企业文档全文" /> : null}
              {!detailLoading && detailError ? <ErrorState compact title="文档全文加载失败" description={detailError} onRetry={() => void openDetails(selectedDocument)} /> : null}
              {!detailLoading && !detailError ? <div className="personal-full-content">{documentContents[selectedDocument.id]?.content || '当前文档暂无可展示的解析文本。'}</div> : null}
            </section>
            <div className="personal-processing-progress">
              <div><span>处理进度</span><strong>{selectedDocument.processing_progress ?? 0}%</strong></div>
              <progress max="100" value={selectedDocument.processing_progress ?? 0} />
              <small>{selectedDocument.processing_stage || '未开始'}</small>
            </div>
          </>
        ) : null}
      </Drawer>
    </section>
  );
}
