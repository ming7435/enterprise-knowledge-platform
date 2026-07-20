import type { DocumentRecord } from '../../types';
import { EmptyState } from './AsyncState';

export interface KnowledgeSelectorProps {
  documents: DocumentRecord[];
  selectedIds: string[];
  disabled?: boolean;
  onChange: (documentIds: string[]) => void;
}

export function KnowledgeSelector({
  documents,
  selectedIds,
  disabled = false,
  onChange,
}: KnowledgeSelectorProps) {
  function toggle(documentId: string) {
    onChange(
      selectedIds.includes(documentId)
        ? selectedIds.filter((id) => id !== documentId)
        : [...selectedIds, documentId]
    );
  }

  if (documents.length === 0) {
    return <EmptyState compact title="暂无可选择的文件知识库" description="上传并解析文档后，这里会出现可选知识库。" />;
  }

  return (
    <div className="ui-knowledge-selector" aria-label="问答知识库范围">
      {documents.map((document) => (
        <label className="ui-knowledge-selector-item" key={document.id}>
          <input
            type="checkbox"
            checked={selectedIds.includes(document.id)}
            disabled={disabled}
            onChange={() => toggle(document.id)}
          />
          <span>
            <strong title={document.filename}>{document.filename}</strong>
            <small>{document.chunk_count ?? 0} 个片段 · {document.index_status === 'indexed' ? '已入库' : '未就绪'}</small>
          </span>
        </label>
      ))}
    </div>
  );
}
