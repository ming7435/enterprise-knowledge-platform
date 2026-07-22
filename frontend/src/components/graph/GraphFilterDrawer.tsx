import { Database, Filter, GitBranch, Search, X } from 'lucide-react';

import type { DocumentRecord, KnowledgeGraphNode } from '../../types';

interface GraphFilterDrawerProps {
  visible: boolean;
  workspaceLabel: string;
  nodeCount: number;
  edgeCount: number;
  documents: DocumentRecord[];
  selectedDocumentIds: string[];
  loading: boolean;
  availableTypes: string[];
  enabledTypes: string[];
  typeCounts: Map<string, number>;
  relationCounts: Array<[string, number]>;
  enabledRelations: string[];
  searchLoading: boolean;
  searchError: string | null;
  query: string;
  searchResults: KnowledgeGraphNode[];
  selectedNodeId: string | null;
  getNodeType: (node: KnowledgeGraphNode) => string;
  getTypeLabel: (type: string) => string;
  getTypeColor: (type: string) => string;
  getRelationColor: (relation: string) => string;
  onClose: () => void;
  onClearDocuments: () => void;
  onToggleDocument: (documentId: string) => void;
  onToggleType: (type: string) => void;
  onToggleRelation: (relation: string) => void;
  onSelectNode: (node: KnowledgeGraphNode) => void;
}

export function GraphFilterDrawer({
  visible,
  workspaceLabel,
  nodeCount,
  edgeCount,
  documents,
  selectedDocumentIds,
  loading,
  availableTypes,
  enabledTypes,
  typeCounts,
  relationCounts,
  enabledRelations,
  searchLoading,
  searchError,
  query,
  searchResults,
  selectedNodeId,
  getNodeType,
  getTypeLabel,
  getTypeColor,
  getRelationColor,
  onClose,
  onClearDocuments,
  onToggleDocument,
  onToggleType,
  onToggleRelation,
  onSelectNode
}: GraphFilterDrawerProps) {
  if (!visible) return null;

  return (
    <aside className="graph-left-panel graph-filter-drawer" aria-label="知识图谱筛选">
      <div className="graph-drawer-heading">
        <div>
          <strong>图谱筛选</strong>
          <span>{nodeCount} 个实体 · {edgeCount} 条关系</span>
        </div>
        <button type="button" onClick={onClose} aria-label="隐藏图谱筛选" title="隐藏筛选">
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <section className="graph-filter-section">
        <div className="graph-panel-heading">
          <Database size={16} aria-hidden="true" />
          <span>知识库</span>
          <small>{workspaceLabel}</small>
        </div>
        <button
          type="button"
          className={`graph-filter-all ${selectedDocumentIds.length === 0 ? 'active' : ''}`}
          onClick={onClearDocuments}
          disabled={loading}
        >
          全部知识库
          <b>{documents.length}</b>
        </button>
        <div className="graph-library-list">
          {documents.length === 0 ? (
            <span className="graph-muted">暂无可筛选知识库。</span>
          ) : documents.map((document) => (
            <label key={document.id} className={selectedDocumentIds.includes(document.id) ? 'enabled' : ''} title={document.filename}>
              <input
                type="checkbox"
                checked={selectedDocumentIds.includes(document.id)}
                onChange={() => onToggleDocument(document.id)}
                disabled={loading}
              />
              <span>{document.filename}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="graph-filter-section">
        <div className="graph-panel-heading">
          <Filter size={16} aria-hidden="true" />
          <span>实体类型</span>
        </div>
        <div className="graph-type-list">
          {availableTypes.length === 0 ? <span className="graph-muted">暂无实体类型。</span> : availableTypes.map((type) => (
            <label key={type} className={enabledTypes.includes(type) ? 'enabled' : ''}>
              <input type="checkbox" checked={enabledTypes.includes(type)} onChange={() => onToggleType(type)} />
              <i style={{ backgroundColor: getTypeColor(type) }} />
              <span>{getTypeLabel(type)}</span>
              <b>{typeCounts.get(type) ?? 0}</b>
            </label>
          ))}
        </div>
      </section>

      <section className="graph-filter-section">
        <div className="graph-panel-heading">
          <GitBranch size={16} aria-hidden="true" />
          <span>关系类型</span>
        </div>
        <div className="graph-relation-list">
          {relationCounts.length === 0 ? <span className="graph-muted">暂无关系类型。</span> : relationCounts.map(([relation, count]) => (
            <label key={relation} className={enabledRelations.includes(relation) ? 'enabled' : ''}>
              <input type="checkbox" checked={enabledRelations.includes(relation)} onChange={() => onToggleRelation(relation)} />
              <i style={{ backgroundColor: getRelationColor(relation) }} />
              <span>{relation}</span>
              <b>{count}</b>
            </label>
          ))}
        </div>
      </section>

      <section className="graph-filter-section graph-search-results">
        <div className="graph-panel-heading">
          <Search size={16} aria-hidden="true" />
          <span>实体定位</span>
        </div>
        {searchLoading ? (
          <p className="graph-muted">正在搜索完整图谱...</p>
        ) : searchError ? (
          <p className="graph-inline-error">{searchError}</p>
        ) : searchResults.length === 0 ? (
          <p className="graph-muted">{query.trim() ? '没有找到相关实体。' : '在顶部输入关键词定位实体。'}</p>
        ) : searchResults.map((node) => {
          const type = getNodeType(node);
          return (
            <button type="button" key={node.id} className={selectedNodeId === node.id ? 'active' : ''} onClick={() => onSelectNode(node)}>
              <i style={{ backgroundColor: getTypeColor(type) }} />
              <span>
                <strong>{node.label}</strong>
                <small>{getTypeLabel(type)}</small>
              </span>
            </button>
          );
        })}
      </section>
    </aside>
  );
}
