import { Eye, FileText, GitBranch, MousePointer2, PanelRightOpen, Sparkles, X } from 'lucide-react';
import { forwardRef } from 'react';

import type { KnowledgeGraphEdge, KnowledgeGraphNode } from '../../types';

interface GraphInspectorDrawerProps {
  visible: boolean;
  node: KnowledgeGraphNode | null;
  nodeById: Map<string, KnowledgeGraphNode>;
  relations: KnowledgeGraphEdge[];
  workspaceLabel: string;
  loading: boolean;
  error: string | null;
  getNodeType: (node: KnowledgeGraphNode) => string;
  getTypeLabel: (type: string) => string;
  getRelationColor: (relation: string) => string;
  onClose: () => void;
  onClear: () => void;
  onSelectNode: (node: KnowledgeGraphNode) => void;
  onOpenDocument: (documentId: string) => void;
  onSearchKnowledge: (keyword: string) => void;
  onOpenQuestion: () => void;
}

export const GraphInspectorDrawer = forwardRef<HTMLElement, GraphInspectorDrawerProps>(function GraphInspectorDrawer({
  visible,
  node,
  nodeById,
  relations,
  workspaceLabel,
  loading,
  error,
  getNodeType,
  getTypeLabel,
  getRelationColor,
  onClose,
  onClear,
  onSelectNode,
  onOpenDocument,
  onSearchKnowledge,
  onOpenQuestion
}, ref) {
  if (!visible) return null;

  const documentId = node ? String(node.properties?.last_document_id || node.properties?.document_id || '') : '';
  const filename = node ? String(node.properties?.last_filename || node.properties?.filename || '暂无来源文件') : '';
  const chunkIndex = node?.properties?.chunk_index ?? node?.properties?.chunk_no ?? node?.properties?.segment_index;

  return (
    <aside ref={ref} className="graph-right-panel graph-inspector-drawer" aria-label="实体详情">
      <div className="graph-inspector-heading">
        <PanelRightOpen size={17} aria-hidden="true" />
        <span>实体检查器</span>
        {node && (
          <button type="button" onClick={onClear} aria-label="清空节点详情" title="清空详情">
            <X size={16} aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="隐藏实体检查器" title="隐藏详情">
          <PanelRightOpen size={16} aria-hidden="true" />
        </button>
      </div>

      {node ? (
        <>
          {loading && <div className="graph-inspector-state">正在加载真实节点详情与邻居...</div>}
          {error && <div className="graph-inspector-state error">{error}</div>}
          <span className="status-badge indexed">{getTypeLabel(getNodeType(node))}</span>
          <h4>{node.label}</h4>
          <dl className="definition-list graph-definition-list">
            <div><dt>规范名称</dt><dd>{String(node.properties?.canonical_name || node.label)}</dd></div>
            <div><dt>实体类型</dt><dd>{getTypeLabel(getNodeType(node))}</dd></div>
            <div><dt>权重 / 置信度</dt><dd>{node.weight ?? 1}{node.properties?.confidence ? ` / ${node.properties.confidence}` : ''}</dd></div>
            <div><dt>来源文件</dt><dd>{filename}</dd></div>
            <div><dt>证据片段</dt><dd>{chunkIndex === undefined || chunkIndex === null ? '暂无编号' : `第 ${Number(chunkIndex) + 1} 个片段`}</dd></div>
            <div><dt>所属空间</dt><dd>{workspaceLabel}</dd></div>
          </dl>

          {node.properties?.content_preview && (
            <div className="graph-evidence-box">
              <strong>原文证据</strong>
              <p>{String(node.properties.content_preview)}</p>
            </div>
          )}

          <div className="graph-neighbor-list">
            <strong><GitBranch size={15} aria-hidden="true" /> 直接关系</strong>
            {relations.length === 0 ? (
              <span className="graph-muted">当前实体暂无直接关系。</span>
            ) : relations.map((edge) => {
              const neighborId = edge.source === node.id ? edge.target : edge.source;
              const neighbor = nodeById.get(neighborId);
              return (
                <button type="button" key={edge.id} onClick={() => neighbor && onSelectNode(neighbor)} disabled={!neighbor}>
                  <i style={{ backgroundColor: getRelationColor(edge.label) }} />
                  <span>
                    <strong>{edge.label || '关联'} · {neighbor?.label ?? neighborId}</strong>
                    <small>{edge.source === node.id ? '出边' : '入边'} · {Number(edge.properties?.occurrences ?? 1)} 次</small>
                  </span>
                </button>
              );
            })}
          </div>

          <details className="graph-property-list">
            <summary>查看节点原始字段</summary>
            {Object.entries(node.properties ?? {})
              .filter(([key]) => key !== 'content_preview')
              .slice(0, 16)
              .map(([key, value]) => <span key={key}><strong>{key}</strong>{String(value)}</span>)}
          </details>

          <div className="graph-inspector-actions">
            {documentId && (
              <button type="button" onClick={() => onOpenDocument(documentId)}>
                <FileText size={16} aria-hidden="true" />
                打开来源文档
              </button>
            )}
            <button type="button" onClick={() => onSearchKnowledge(node.label)}>
              <Eye size={16} aria-hidden="true" />
              基于实体检索
            </button>
            <button type="button" onClick={onOpenQuestion}>
              <Sparkles size={16} aria-hidden="true" />
              进入问答
            </button>
          </div>
        </>
      ) : (
        <div className="graph-empty-inspector">
          <MousePointer2 size={34} aria-hidden="true" />
          <strong>选择实体查看详情</strong>
          <span>节点、关系与证据仅来自当前所选知识库文档。</span>
        </div>
      )}
    </aside>
  );
});
