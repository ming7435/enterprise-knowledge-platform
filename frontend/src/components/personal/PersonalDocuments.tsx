import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  Eye,
  FileSearch,
  FileText,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';

import type { DocumentRecord } from '../../types';
import { Button } from '../ui/Button';
import { DataTable } from '../ui/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../ui/AsyncState';
import { SearchInput, SelectField } from '../ui/FormControls';
import { Drawer } from '../ui/Overlay';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge } from '../ui/StatusBadge';
import {
  DefinitionList,
  documentMetrics,
  documentUploaderName,
  Feedback,
  formatDate,
  MetricStrip,
  PersonalIsolationNotice,
  SectionHeader,
  statusText,
  summarize,
} from './shared';
import type { PersonalSharedProps } from './types';

export interface PersonalDocumentsProps extends PersonalSharedProps {
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

export function PersonalDocuments({
  user,
  documents,
  chunks,
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
}: PersonalDocumentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState('');
  const [parseFilter, setParseFilter] = useState('all');
  const [indexFilter, setIndexFilter] = useState('all');
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const filteredDocuments = useMemo(() => documents.filter((document) => {
    const uploader = documentUploaderName(document, user).toLowerCase();
    return document.filename.toLowerCase().includes(query.trim().toLowerCase())
      && uploader.includes(uploaderFilter.trim().toLowerCase())
      && (parseFilter === 'all' || document.parse_status === parseFilter)
      && (indexFilter === 'all' || document.index_status === indexFilter);
  }), [documents, indexFilter, parseFilter, query, uploaderFilter, user]);
  const selectedDocuments = documents.filter((document) => selectedDocumentIds.includes(document.id));

  function toggleDocument(documentId: string) {
    setSelectedDocumentIds((ids) => ids.includes(documentId)
      ? ids.filter((id) => id !== documentId)
      : [...ids, documentId]);
  }

  function resetFilters() {
    setQuery('');
    setUploaderFilter('');
    setParseFilter('all');
    setIndexFilter('all');
    setSelectedDocumentIds([]);
  }

  function openKnowledge(document: DocumentRecord) {
    onKnowledgeDocumentFilterChange(document.id);
    setSelectedDocument(null);
    onNavigate('knowledge');
  }

  async function openDocumentDetails(document: DocumentRecord) {
    setSelectedDocument(document);
    setDetailError(null);
    if (documentContents[document.id]) return;
    setDetailLoading(true);
    try {
      await onLoadDocumentContent(document);
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : '文档全文加载失败');
    } finally {
      setDetailLoading(false);
    }
  }

  const fileSummary = selectedFiles.length > 0
    ? selectedFiles.map((file) => file.name).join('、')
    : selectedFile?.name ?? '尚未选择文件';

  return (
    <section className="personal-workbench-v2 personal-page-documents">
      <PageHeader
        eyebrow="个人工作区"
        title="文档管理"
        description="上传个人文档，系统会解析文本、生成知识片段，并加入当前个人知识库。"
        actions={<Button icon={RefreshCw} loading={loading} onClick={onRefresh}>刷新列表</Button>}
      />
      <PersonalIsolationNotice />
      <Feedback error={error} notice={notice} />
      {error && documents.length === 0 ? <ErrorState title="文档列表加载失败" description={error} onRetry={onRefresh} /> : null}
      {loading && documents.length === 0 ? <LoadingState label="正在加载个人文档" /> : null}

      <section className="personal-upload-surface">
        <div className="personal-upload-copy">
          <span><Upload size={20} aria-hidden="true" /></span>
          <div>
            <strong>上传个人文档</strong>
            <p>支持 PDF、DOCX、TXT、Markdown、表格、演示文稿及常见资产文件，可一次选择多个文件。</p>
            <small title={fileSummary}>{fileSummary}</small>
          </div>
        </div>
        <div className="personal-upload-actions">
          <input
            ref={fileInputRef}
            className="personal-visually-hidden"
            type="file"
            multiple
            onChange={onFileChange}
            accept=".pdf,.docx,.txt,.md,.xlsx,.csv,.pptx,.jpg,.jpeg,.png,.mp3,.mp4,.zip"
          />
          <Button onClick={() => fileInputRef.current?.click()}>选择文件</Button>
          <Button
            variant="primary"
            icon={Upload}
            loading={uploading}
            disabled={selectedFiles.length === 0}
            onClick={onUpload}
          >
            上传文档
          </Button>
        </div>
      </section>

      <MetricStrip metrics={documentMetrics(profile)} />

      <section className="personal-section">
        <div className="personal-filter-toolbar">
          <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery('')} placeholder="按文件名搜索" />
          <SelectField
            value={parseFilter}
            onChange={(event) => setParseFilter(event.target.value)}
            options={[
              { value: 'all', label: '全部解析状态' },
              { value: 'queued', label: '排队中' },
              { value: 'pending', label: '待解析' },
              { value: 'parsing', label: '解析中' },
              { value: 'parsed', label: '已解析' },
              { value: 'failed', label: '失败' },
            ]}
          />
          <SelectField
            value={indexFilter}
            onChange={(event) => setIndexFilter(event.target.value)}
            options={[
              { value: 'all', label: '全部入库状态' },
              { value: 'pending', label: '待入库' },
              { value: 'indexing', label: '入库中' },
              { value: 'indexed', label: '已入库' },
              { value: 'failed', label: '失败' },
            ]}
          />
          <input
            className="personal-filter-input"
            value={uploaderFilter}
            onChange={(event) => setUploaderFilter(event.target.value)}
            placeholder="上传人名称"
            aria-label="上传人名称"
          />
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={resetFilters}>重置</Button>
          <Button
            size="sm"
            variant="danger"
            icon={Trash2}
            disabled={selectedDocuments.length === 0 || deletingDocumentIds.length > 0}
            onClick={async () => {
              const succeeded = await onDeleteDocuments(selectedDocuments);
              if (succeeded) setSelectedDocumentIds([]);
            }}
          >
            批量删除 {selectedDocuments.length ? `(${selectedDocuments.length})` : ''}
          </Button>
        </div>

        <SectionHeader title="文档列表" description={`共 ${filteredDocuments.length} 个符合条件的文档`} />
        {documents.length === 0 ? (
          <EmptyState
            title="你还没有上传文档"
            description="上传第一个文档后，可以构建个人知识库并进行智能问答。"
            action={{ label: '选择文件', onClick: () => fileInputRef.current?.click(), icon: Upload }}
          />
        ) : (
          <DataTable<DocumentRecord>
            rows={filteredDocuments}
            rowKey={(document) => document.id}
            emptyText="没有找到符合筛选条件的文档"
            columns={[
              {
                key: 'select', label: '', width: '42px', render: (document) => (
                  <input
                    type="checkbox"
                    checked={selectedDocumentIds.includes(document.id)}
                    onChange={() => toggleDocument(document.id)}
                    aria-label={`选择 ${document.filename}`}
                  />
                ),
              },
              {
                key: 'file', label: '文件', render: (document) => (
                  <button className="personal-file-link" type="button" onClick={() => void openDocumentDetails(document)}>
                    <FileText size={16} aria-hidden="true" />
                    <span title={document.filename}>{document.filename}</span>
                  </button>
                ),
              },
              { key: 'uploader', label: '上传人', width: '110px', render: (document) => documentUploaderName(document, user) },
              { key: 'parse', label: '解析状态', width: '100px', render: (document) => <StatusBadge status={document.parse_status} /> },
              { key: 'index', label: '入库状态', width: '100px', render: (document) => <StatusBadge status={document.index_status} /> },
              { key: 'chunks', label: '片段', width: '70px', render: (document) => document.chunk_count ?? 0 },
              { key: 'time', label: '更新时间', width: '168px', render: (document) => formatDate(document.created_at) },
              {
                key: 'actions', label: '操作', width: '360px', render: (document) => (
                  <div className="personal-row-actions">
                    <Button size="sm" variant="ghost" icon={Eye} onClick={() => void openDocumentDetails(document)}>详情</Button>
                    <Button size="sm" variant="ghost" icon={FileSearch} onClick={() => openKnowledge(document)}>片段</Button>
                    <Button size="sm" variant="ghost" icon={MessageSquare} onClick={() => onPrepareQuestion(`请基于《${document.filename}》进行问答：`, [document.id])}>问答</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={RefreshCw}
                      disabled={['queued', 'parsing'].includes(document.parse_status)}
                      onClick={() => void onReprocessDocument(document)}
                    >
                      重解析
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      disabled={deletingDocumentId === document.id || deletingDocumentIds.includes(document.id)}
                      onClick={() => void onDeleteDocument(document)}
                    >
                      删除
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </section>

      <Drawer
        open={Boolean(selectedDocument)}
        title="文档详情"
        description={selectedDocument?.filename}
        onClose={() => setSelectedDocument(null)}
        footer={selectedDocument ? (
          <>
            <Button icon={FileSearch} onClick={() => openKnowledge(selectedDocument)}>查看知识片段</Button>
            <Button icon={MessageSquare} onClick={() => {
              onPrepareQuestion(`请基于《${selectedDocument.filename}》回答：`, [selectedDocument.id]);
              setSelectedDocument(null);
            }}>基于文档提问</Button>
            <Button icon={RefreshCw} onClick={async () => {
              const succeeded = await onReprocessDocument(selectedDocument);
              if (succeeded) setSelectedDocument(null);
            }}>重新解析</Button>
            <Button variant="danger" icon={Trash2} onClick={async () => {
              const succeeded = await onDeleteDocument(selectedDocument);
              if (succeeded) setSelectedDocument(null);
            }}>删除文档</Button>
          </>
        ) : undefined}
      >
        {selectedDocument ? (
          <>
            <DefinitionList
              items={[
                ['文件名', selectedDocument.filename],
                ['类型', selectedDocument.file_type || '未知'],
                ['上传人', documentUploaderName(selectedDocument, user)],
                ['上传时间', formatDate(selectedDocument.created_at)],
                ['解析状态', statusText(selectedDocument.parse_status)],
                ['入库状态', statusText(selectedDocument.index_status)],
                ['知识片段', String(chunks.filter((chunk) => chunk.document_id === selectedDocument.id).length || selectedDocument.chunk_count || 0)],
                ['所属空间', '个人工作区'],
                ['文档摘要', documentContents[selectedDocument.id]?.content
                  ? summarize(documentContents[selectedDocument.id].content, 180)
                  : selectedDocument.chunk_count > 0
                    ? `已生成 ${selectedDocument.chunk_count} 个知识片段，全文加载后显示真实摘要。`
                    : '暂无摘要'],
                ['失败原因', selectedDocument.processing_error || '暂无'],
              ]}
            />
            <section className="personal-document-content-preview">
              <SectionHeader title="文档全文 / 解析文本" description="来自当前个人工作区的真实文档内容接口" />
              {detailLoading ? <LoadingState compact label="正在加载文档全文" /> : null}
              {!detailLoading && detailError ? (
                <ErrorState
                  compact
                  title="文档全文加载失败"
                  description={detailError}
                  onRetry={() => void openDocumentDetails(selectedDocument)}
                />
              ) : null}
              {!detailLoading && !detailError ? (
                <div className="personal-full-content">
                  {documentContents[selectedDocument.id]?.content || '当前文档暂无可展示的解析文本。'}
                </div>
              ) : null}
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
