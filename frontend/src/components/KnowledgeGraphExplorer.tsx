import {
  Box,
  Database,
  Eye,
  FileText,
  Filter,
  GitBranch,
  Maximize2,
  MousePointer2,
  Network,
  PanelRightOpen,
  RefreshCw,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  X
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import type { DocumentRecord, KnowledgeGraph, KnowledgeGraphEdge, KnowledgeGraphNode } from '../types';

type GraphMode = '2d' | '3d';
type ResultView = 'graph' | 'table' | 'text' | 'code';

interface KnowledgeGraphExplorerProps {
  graph: KnowledgeGraph | null;
  loading: boolean;
  documents?: DocumentRecord[];
  selectedDocumentIds?: string[];
  workspaceLabel: string;
  onOpenDocument: (documentId: string) => void;
  onSearchKnowledge: (keyword: string) => void;
  onOpenQuestion: () => void;
  onDocumentSelectionChange?: (documentIds: string[]) => void;
  onRefresh: () => void;
  onRebuild?: () => void;
}

const GRAPH_WIDTH = 1600;
const GRAPH_HEIGHT = 900;

const typeLabels: Record<string, string> = {
  entity: '文件实体',
  workspace: '工作区',
  document: '文档',
  chunk: '片段',
  keyword: '关键词',
  concept: '概念',
  question: '问答',
  qa: '问答',
  member: '成员'
};

const typeColors: Record<string, string> = {
  entity: '#0f766e',
  workspace: '#0f766e',
  document: '#2563eb',
  chunk: '#6b7280',
  keyword: '#d97706',
  concept: '#7c3aed',
  question: '#be123c',
  qa: '#be123c',
  member: '#0891b2',
  node: '#334155'
};

const semanticTypeLabels: Record<string, string> = {
  file: '文件实体',
  api: 'API 实体',
  technology: '技术实体',
  knowledge_base: '知识库实体',
  workspace: '工作区实体',
  module: '模块实体',
  process: '流程实体',
  config: '配置实体',
  permission: '权限实体',
  concept: '概念实体',
  技术组件: '技术组件',
  功能模块: '功能模块',
  数据对象: '数据对象',
  配置权限: '配置权限',
  流程动作: '流程动作',
  指标状态: '指标状态',
  业务概念: '业务概念',
  文档章节: '文档章节',
  其他: '其他'
};

const semanticTypeColors: Record<string, string> = {
  file: '#5270c6',
  api: '#7c3aed',
  technology: '#0891b2',
  knowledge_base: '#37a36f',
  workspace: '#0f766e',
  module: '#3ba574',
  process: '#f4c95d',
  config: '#d97706',
  permission: '#ef6666',
  concept: '#64748b',
  技术组件: '#5270c6',
  功能模块: '#3ba574',
  数据对象: '#6bbbd6',
  配置权限: '#ef6666',
  流程动作: '#f4c95d',
  指标状态: '#86c96d',
  业务概念: '#37a36f',
  文档章节: '#7c6fd6',
  其他: '#64748b'
};

const semanticTypeOrder = [
  'workspace',
  'knowledge_base',
  'file',
  'api',
  'technology',
  'module',
  'process',
  'permission',
  'config',
  'concept',
  '技术组件',
  '功能模块',
  '数据对象',
  '配置权限',
  '流程动作',
  '指标状态',
  '业务概念',
  '文档章节',
  '其他'
];

const relationColors: Record<string, string> = {
  file_relation: '#0f766e',
  关联: '#0f766e',
  包含: '#2563eb',
  组成: '#2563eb',
  依赖: '#7c3aed',
  连接: '#0891b2',
  属于: '#d97706',
  管理: '#0f766e',
  使用: '#2563eb',
  调用: '#2563eb',
  支持: '#0891b2',
  生成: '#be123c',
  同步: '#0f766e',
  隔离: '#be123c',
  检索: '#7c3aed',
  上传: '#d97706',
  解析: '#d97706',
  入库: '#0f766e',
  contains: '#0f766e',
  has_chunk: '#0f766e',
  mentions: '#7c3aed',
  references: '#2563eb',
  wrote: '#0891b2',
  asked: '#be123c',
  uploaded: '#d97706'
};

export function KnowledgeGraphExplorer({
  graph,
  loading,
  documents = [],
  selectedDocumentIds = [],
  workspaceLabel,
  onOpenDocument,
  onSearchKnowledge,
  onOpenQuestion,
  onDocumentSelectionChange,
  onRefresh,
  onRebuild
}: KnowledgeGraphExplorerProps) {
  const [mode, setMode] = useState<GraphMode>('2d');
  const [resultView, setResultView] = useState<ResultView>('graph');
  const [query, setQuery] = useState('');
  const [enabledTypes, setEnabledTypes] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<KnowledgeGraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const nodes = graph?.nodes ?? [];
  const edges = useMemo(() => normalizeEdges(graph), [graph]);
  const availableTypes = useMemo(
    () => Array.from(new Set(nodes.map((node) => semanticTypeOfNode(node)))),
    [nodes]
  );

  useEffect(() => {
    setEnabledTypes((current) => {
      const currentValid = current.filter((type) => availableTypes.includes(type));
      return currentValid.length ? currentValid : availableTypes;
    });
  }, [availableTypes]);

  const filteredNodes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return nodes.filter((node) => {
      const nodeType = semanticTypeOfNode(node);
      const matchesType = enabledTypes.length === 0 || enabledTypes.includes(nodeType);
      const searchable = `${node.label} ${node.id} ${JSON.stringify(node.properties ?? {})}`.toLowerCase();
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      return matchesType && matchesQuery;
    });
  }, [enabledTypes, nodes, query]);

  const visibleNodeIds = useMemo(
    () => new Set(filteredNodes.map((node) => node.id)),
    [filteredNodes]
  );
  const filteredEdges = useMemo(
    () => edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
    [edges, visibleNodeIds]
  );
  const filteredNodeById = useMemo(
    () => new Map(filteredNodes.map((node) => [node.id, node])),
    [filteredNodes]
  );

  useEffect(() => {
    setPositions(computeLayout(filteredNodes, filteredEdges));
  }, [filteredEdges, filteredNodes]);

  function resetView() {
    setQuery('');
    setResultView('graph');
    setEnabledTypes(availableTypes);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setPositions(computeLayout(filteredNodes, filteredEdges));
    setSelectedNode(null);
  }

  function fitView() {
    setZoom(filteredNodes.length > 40 ? 0.78 : 1);
    setPan({ x: 0, y: 0 });
  }

  function toggleType(type: string) {
    setEnabledTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type]
    );
  }

  function toggleDocument(documentId: string) {
    if (!onDocumentSelectionChange) return;
    const nextIds = selectedDocumentIds.includes(documentId)
      ? selectedDocumentIds.filter((id) => id !== documentId)
      : [...selectedDocumentIds, documentId];
    onDocumentSelectionChange(nextIds);
  }

  function activateNode(node: KnowledgeGraphNode) {
    setSelectedNode(node);
  }

  function performPrimaryNodeAction(node: KnowledgeGraphNode) {
    const type = normalizeType(node.type);
    if (type === 'document') {
      onOpenDocument(String(node.properties?.document_id || node.id.replace(/^document:/, '')));
      return;
    }
    if (type === 'entity' || type === 'concept' || type === 'keyword' || type === 'chunk') {
      onSearchKnowledge(node.label);
      return;
    }
    if (type === 'question' || type === 'qa') {
      onOpenQuestion();
    }
  }

  const disabled = graph && graph.enabled === false;
  const unavailable = graph?.status === 'unavailable' || graph?.status === 'permission_denied';
  const empty = !loading && !disabled && !unavailable && filteredNodes.length === 0;
  const sourceLabel =
    graph?.mode === 'neo4j'
        ? 'Neo4j 文件实体图谱'
      : graph?.mode === 'database'
        ? '数据库文件实体图谱'
        : '知识图谱';
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    nodes.forEach((node) => {
      const type = semanticTypeOfNode(node);
      counts.set(type, (counts.get(type) ?? 0) + 1);
    });
    return counts;
  }, [nodes]);
  const relationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    edges.forEach((edge) => {
      const label = edge.label || '关联';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [edges]);
  const searchResultNodes = useMemo(
    () =>
      [...filteredNodes]
        .sort((a, b) => {
          const aScore = Number(a.properties?.match_score ?? 0) || 0;
          const bScore = Number(b.properties?.match_score ?? 0) || 0;
          return bScore - aScore || (b.weight ?? 1) - (a.weight ?? 1) || a.label.localeCompare(b.label);
        })
        .slice(0, 9),
    [filteredNodes]
  );
  const selectedRelations = useMemo(
    () =>
      selectedNode
        ? edges
            .filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
            .slice(0, 10)
        : [],
    [edges, selectedNode]
  );
  const selectedDocumentId = selectedNode
    ? String(selectedNode.properties?.last_document_id || selectedNode.properties?.document_id || '')
    : '';
  const selectedFilename = selectedNode
    ? String(selectedNode.properties?.last_filename || selectedNode.properties?.filename || '暂无来源文件')
    : '';

  return (
    <section className="graph-explorer neo4j-workbench" aria-label={`${workspaceLabel}知识图谱`}>
      <div className="graph-browser-shell">
        <div className="graph-command-bar">
          <div className="graph-command-title">
            <Network size={22} aria-hidden="true" />
            <div>
              <h3>知识图谱工作台</h3>
              <span>
                {sourceLabel} · {graph?.stats?.node_count ?? nodes.length} 个节点 / {graph?.stats?.edge_count ?? edges.length} 条关系
                {graph?.partial ? ' · 已截取部分数据' : ''}
              </span>
            </div>
          </div>
          <label className="graph-command-input">
            <Search size={18} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索实体名、别名、API、文件名或证据片段"
            />
          </label>
          <div className="graph-command-actions">
            <button type="button" onClick={onRefresh} disabled={loading}>
              <RefreshCw size={16} aria-hidden="true" />
              刷新
            </button>
            <button type="button" className="graph-rebuild-button" onClick={onRebuild ?? onRefresh} disabled={loading}>
              <Sparkles size={16} aria-hidden="true" />
              重建
            </button>
          </div>
        </div>

        {documents.length > 0 && (
          <div className="graph-library-filter" aria-label="知识库图谱筛选">
            <button
              type="button"
              className={selectedDocumentIds.length === 0 ? 'active' : ''}
              onClick={() => onDocumentSelectionChange?.([])}
              disabled={loading}
            >
              全部知识库
            </button>
            {documents.slice(0, 12).map((document) => (
              <label
                key={document.id}
                className={selectedDocumentIds.includes(document.id) ? 'enabled' : ''}
                title={document.filename}
              >
                <input
                  type="checkbox"
                  checked={selectedDocumentIds.includes(document.id)}
                  onChange={() => toggleDocument(document.id)}
                  disabled={loading}
                />
                {trimLabel(document.filename, 18)}
              </label>
            ))}
            <span>{selectedDocumentIds.length ? `已组合 ${selectedDocumentIds.length} 个知识库` : '当前组合：全部文件'}</span>
          </div>
        )}

        {graph?.message && (
          <div className={`graph-state ${disabled || unavailable ? 'warning' : 'info'}`}>
            {graph.message}
          </div>
        )}

        <div className="graph-workbench-grid">
          <aside className="graph-left-panel" aria-label="图谱图例与搜索结果">
            <div className="graph-panel-card graph-scene-card">
              <div className="graph-panel-heading">
                <Database size={16} aria-hidden="true" />
                <span>Scene</span>
              </div>
              <strong>{filteredNodes.length}</strong>
              <p>当前可见节点</p>
              <small>{filteredEdges.length} 条关系 · {workspaceLabel}</small>
            </div>

            <div className="graph-panel-card">
              <div className="graph-panel-heading">
                <Filter size={16} aria-hidden="true" />
                <span>实体类型</span>
              </div>
              <div className="graph-type-list">
                {availableTypes.length === 0 ? (
                  <span className="graph-muted">暂无类型</span>
                ) : (
                  availableTypes.map((type) => (
                    <label key={type} className={enabledTypes.includes(type) ? 'enabled' : ''}>
                      <input
                        type="checkbox"
                        checked={enabledTypes.includes(type)}
                        onChange={() => toggleType(type)}
                      />
                      <i style={{ backgroundColor: colorForType(type) }} />
                      <span>{semanticTypeLabels[type] ?? type}</span>
                      <b>{typeCounts.get(type) ?? 0}</b>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="graph-panel-card">
              <div className="graph-panel-heading">
                <GitBranch size={16} aria-hidden="true" />
                <span>关系类型</span>
              </div>
              <div className="graph-relation-list">
                {relationCounts.length === 0 ? (
                  <span className="graph-muted">暂无关系</span>
                ) : (
                  relationCounts.map(([label, count]) => (
                    <button type="button" key={label} onClick={() => setQuery(label)}>
                      <i style={{ backgroundColor: colorForRelation(label) }} />
                      <span>{label}</span>
                      <b>{count}</b>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="graph-panel-card graph-search-results">
              <div className="graph-panel-heading">
                <Search size={16} aria-hidden="true" />
                <span>检索结果</span>
              </div>
              {searchResultNodes.length === 0 ? (
                <p className="graph-muted">{query.trim() ? '没有找到相关实体。' : '输入关键词后在当前图谱中定位实体。'}</p>
              ) : (
                searchResultNodes.map((node) => (
                  <button
                    type="button"
                    key={node.id}
                    className={selectedNode?.id === node.id ? 'active' : ''}
                    onClick={() => activateNode(node)}
                  >
                    <i style={{ backgroundColor: colorForType(semanticTypeOfNode(node)) }} />
                    <span>
                      <strong>{node.label}</strong>
                      <small>{semanticTypeLabels[semanticTypeOfNode(node)] ?? semanticTypeOfNode(node)}</small>
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          <div className="graph-canvas-column">
            <div className="graph-canvas-toolbar" aria-label="图谱场景控制">
              <div className="segmented-control" role="group" aria-label="图谱模式">
                <button
                  type="button"
                  className={mode === '2d' && resultView === 'graph' ? 'active' : ''}
                  onClick={() => {
                    setResultView('graph');
                    setMode('2d');
                  }}
                >
                  <Share2 size={16} aria-hidden="true" />
                  2D
                </button>
                <button
                  type="button"
                  className={mode === '3d' && resultView === 'graph' ? 'active' : ''}
                  onClick={() => {
                    setResultView('graph');
                    setMode('3d');
                  }}
                >
                  <Box size={16} aria-hidden="true" />
                  3D
                </button>
              </div>
              <button type="button" onClick={fitView} disabled={loading || !!disabled || resultView !== 'graph'}>
                <Maximize2 size={16} aria-hidden="true" />
                适配
              </button>
              <button type="button" onClick={() => setZoom((value) => Math.min(1.8, value + 0.1))} disabled={mode !== '2d' || resultView !== 'graph'}>
                +
              </button>
              <button type="button" onClick={() => setZoom((value) => Math.max(0.55, value - 0.1))} disabled={mode !== '2d' || resultView !== 'graph'}>
                -
              </button>
              <button type="button" onClick={resetView}>
                <RotateCcw size={16} aria-hidden="true" />
                重置
              </button>
              <span>
                <MousePointer2 size={14} aria-hidden="true" />
                拖拽节点，Ctrl + 滚轮缩放
              </span>
            </div>

            <div className="graph-result-frame">
              <div className="graph-result-rail" role="tablist" aria-label="图谱结果视图">
                {[
                  ['graph', 'Graph'],
                  ['table', 'Table'],
                  ['text', 'Text'],
                  ['code', 'Code']
                ].map(([view, label]) => (
                  <button
                    type="button"
                    key={view}
                    role="tab"
                    aria-selected={resultView === view}
                    className={resultView === view ? 'active' : ''}
                    onClick={() => setResultView(view as ResultView)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="graph-result-body">
                {resultView === 'graph' ? (
                  <div className="graph-stage">
                    {loading && <div className="graph-overlay">知识图谱加载中...</div>}
                    {empty && (
                      <div className="graph-overlay empty">
                        {query.trim() ? '没有找到相关文件实体，请更换关键词或重置筛选。' : '当前工作区暂无可展示的文件实体关系图谱。'}
                      </div>
                    )}
                    {disabled || unavailable ? (
                      <div className="graph-disabled">
                        <Network size={40} aria-hidden="true" />
                        <strong>{graph?.status === 'permission_denied' ? '暂无权限查看图谱' : 'Neo4j 图谱不可用'}</strong>
                        <span>{graph?.message ?? '当前无法展示真实知识图谱。'}</span>
                      </div>
                    ) : mode === '2d' ? (
                      <Graph2D
                        svgRef={svgRef}
                        nodes={filteredNodes}
                        edges={filteredEdges}
                        positions={positions}
                        zoom={zoom}
                        pan={pan}
                        draggingNodeId={draggingNodeId}
                        selectedNodeId={selectedNode?.id ?? null}
                        onZoom={setZoom}
                        onPan={setPan}
                        onDragStart={setDraggingNodeId}
                        onDragEnd={() => setDraggingNodeId(null)}
                        onMoveNode={(nodeId, point) =>
                          setPositions((items) => ({
                            ...items,
                            [nodeId]: point
                          }))
                        }
                        onSelect={activateNode}
                      />
                    ) : (
                      <Graph3D
                        nodes={filteredNodes}
                        edges={filteredEdges}
                        selectedNodeId={selectedNode?.id ?? null}
                        onSelect={activateNode}
                      />
                    )}
                  </div>
                ) : resultView === 'table' ? (
                  <GraphTableView nodes={filteredNodes} edges={filteredEdges} nodeById={filteredNodeById} />
                ) : resultView === 'text' ? (
                  <GraphTextView edges={filteredEdges} nodeById={filteredNodeById} />
                ) : (
                  <GraphRawView nodes={filteredNodes} edges={filteredEdges} />
                )}
                {(loading || empty || disabled || unavailable) && resultView !== 'graph' && (
                  <div className="graph-result-overlay">
                    {loading
                      ? '知识图谱加载中...'
                      : empty
                        ? '当前没有可展示的图谱结果。'
                        : graph?.message ?? '当前无法展示真实知识图谱。'}
                  </div>
                )}
                </div>
            </div>
          </div>

          <aside className="graph-right-panel" aria-label="图谱节点详情">
            <div className="graph-inspector-heading">
              <PanelRightOpen size={17} aria-hidden="true" />
              <span>实体检查器</span>
              {selectedNode && (
                <button type="button" onClick={() => setSelectedNode(null)} aria-label="关闭节点详情">
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>
            {selectedNode ? (
              <>
                <span className="status-badge indexed">
                  {semanticTypeLabels[semanticTypeOfNode(selectedNode)] ?? semanticTypeOfNode(selectedNode)}
                </span>
                <h4>{selectedNode.label}</h4>
                <dl className="definition-list graph-definition-list">
                  <div>
                    <dt>所属空间</dt>
                    <dd>{workspaceLabel}</dd>
                  </div>
                  <div>
                    <dt>权重 / 置信度</dt>
                    <dd>
                      {selectedNode.weight ?? 1}
                      {selectedNode.properties?.confidence ? ` / ${selectedNode.properties.confidence}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>来源文件</dt>
                    <dd>{selectedFilename}</dd>
                  </div>
                  <div>
                    <dt>命中字段</dt>
                    <dd>{selectedNode.properties?.match_field ? String(selectedNode.properties.match_field) : '当前视图'}</dd>
                  </div>
                </dl>
                {selectedNode.properties?.content_preview && (
                  <div className="graph-evidence-box">
                    <strong>证据片段</strong>
                    <p>{String(selectedNode.properties.content_preview)}</p>
                  </div>
                )}
                <div className="graph-neighbor-list">
                  <strong>相邻关系</strong>
                  {selectedRelations.length === 0 ? (
                    <span className="graph-muted">暂无相邻关系。</span>
                  ) : (
                    selectedRelations.map((edge) => (
                      <button type="button" key={edge.id} onClick={() => setQuery(edge.label)}>
                        <i style={{ backgroundColor: colorForRelation(edge.label) }} />
                        <span>{edge.label}</span>
                        <small>{edge.source === selectedNode.id ? '出边' : '入边'}</small>
                      </button>
                    ))
                  )}
                </div>
                <div className="graph-property-list">
                  {Object.entries(selectedNode.properties ?? {})
                    .filter(([key]) => !['content_preview'].includes(key))
                    .slice(0, 10)
                    .map(([key, value]) => (
                      <span key={key}>
                        <strong>{key}</strong>
                        {String(value)}
                      </span>
                    ))}
                </div>
                <div className="graph-inspector-actions">
                  {selectedDocumentId && (
                    <button type="button" onClick={() => onOpenDocument(selectedDocumentId)}>
                      <FileText size={16} aria-hidden="true" />
                      打开来源文档
                    </button>
                  )}
                  <button type="button" onClick={() => performPrimaryNodeAction(selectedNode)}>
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
                <strong>选择一个节点查看详情</strong>
                <span>节点、关系和证据均来自当前知识库文档，不写入问答记录节点。</span>
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}

function GraphTableView({
  nodes,
  edges,
  nodeById
}: {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  nodeById: Map<string, KnowledgeGraphNode>;
}) {
  return (
    <div className="graph-table-view" aria-label="知识图谱表格结果">
      <div className="graph-table-section">
        <h4>Nodes</h4>
        <div className="graph-result-table-wrap">
          <table className="graph-result-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Type</th>
                <th>Weight</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {nodes.slice(0, 120).map((node) => (
                <tr key={node.id}>
                  <td>{node.label}</td>
                  <td>{semanticTypeLabels[semanticTypeOfNode(node)] ?? semanticTypeOfNode(node)}</td>
                  <td>{node.weight ?? 1}</td>
                  <td>{formatGraphValue(node.properties?.last_filename || node.properties?.filename || '暂无')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="graph-table-section">
        <h4>Relationships</h4>
        <div className="graph-result-table-wrap">
          <table className="graph-result-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Relationship</th>
                <th>Target</th>
                <th>Weight</th>
              </tr>
            </thead>
            <tbody>
              {edges.slice(0, 160).map((edge) => (
                <tr key={edge.id}>
                  <td>{nodeById.get(edge.source)?.label ?? edge.source}</td>
                  <td>{edge.label || '关联'}</td>
                  <td>{nodeById.get(edge.target)?.label ?? edge.target}</td>
                  <td>{edge.weight ?? 1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GraphTextView({
  edges,
  nodeById
}: {
  edges: KnowledgeGraphEdge[];
  nodeById: Map<string, KnowledgeGraphNode>;
}) {
  return (
    <div className="graph-text-view" aria-label="知识图谱文本结果">
      {edges.length === 0 ? (
        <p className="graph-muted">当前没有可转换为三元组的关系。</p>
      ) : (
        edges.slice(0, 180).map((edge) => (
          <article key={edge.id}>
            <strong>
              {nodeById.get(edge.source)?.label ?? edge.source}
              <span>{edge.label || '关联'}</span>
              {nodeById.get(edge.target)?.label ?? edge.target}
            </strong>
            <p>{formatGraphValue(edge.properties?.evidence || edge.properties?.relation_type || '来自当前知识库文档的实体关系。')}</p>
          </article>
        ))
      )}
    </div>
  );
}

function GraphRawView({ nodes, edges }: { nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] }) {
  return (
    <pre className="graph-code-view" aria-label="知识图谱原始结果">
      {JSON.stringify(
        {
          nodes: nodes.slice(0, 120),
          relationships: edges.slice(0, 180)
        },
        null,
        2
      )}
    </pre>
  );
}

function formatGraphValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '暂无';
  if (Array.isArray(value)) return value.join('、');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function Graph2D({
  svgRef,
  nodes,
  edges,
  positions,
  zoom,
  pan,
  draggingNodeId,
  selectedNodeId,
  onZoom,
  onPan,
  onDragStart,
  onDragEnd,
  onMoveNode,
  onSelect
}: {
  svgRef: React.MutableRefObject<SVGSVGElement | null>;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  positions: Record<string, { x: number; y: number }>;
  zoom: number;
  pan: { x: number; y: number };
  draggingNodeId: string | null;
  selectedNodeId: string | null;
  onZoom: (zoom: number) => void;
  onPan: (pan: { x: number; y: number }) => void;
  onDragStart: (nodeId: string) => void;
  onDragEnd: () => void;
  onMoveNode: (nodeId: string, point: { x: number; y: number }) => void;
  onSelect: (node: KnowledgeGraphNode) => void;
}) {
  const [draggingCanvas, setDraggingCanvas] = useState(false);
  const interactionRef = useRef<{
    mode: 'canvas' | 'node' | null;
    pointerId: number | null;
    nodeId: string | null;
    lastClient: { x: number; y: number } | null;
    nodeOffset: { x: number; y: number } | null;
    moved: boolean;
  }>({
    mode: null,
    pointerId: null,
    nodeId: null,
    lastClient: null,
    nodeOffset: null,
    moved: false
  });
  const suppressClickRef = useRef(false);
  const panRef = useRef(pan);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  const connectedNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (!selectedNodeId) return ids;
    edges.forEach((edge) => {
      if (edge.source === selectedNodeId) ids.add(edge.target);
      if (edge.target === selectedNodeId) ids.add(edge.source);
    });
    return ids;
  }, [edges, selectedNodeId]);

  function svgPoint(event: React.PointerEvent<SVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const rawPoint = {
      x: ((event.clientX - rect.left) / rect.width) * GRAPH_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * GRAPH_HEIGHT
    };
    return {
      x: (rawPoint.x - pan.x) / zoom,
      y: (rawPoint.y - pan.y) / zoom
    };
  }

  function svgDelta(event: React.PointerEvent<SVGSVGElement>, lastClient: { x: number; y: number }) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - lastClient.x) / rect.width) * GRAPH_WIDTH,
      y: ((event.clientY - lastClient.y) / rect.height) * GRAPH_HEIGHT
    };
  }

  function finishInteraction(pointerId?: number) {
    if (pointerId !== undefined && svgRef.current?.hasPointerCapture(pointerId)) {
      svgRef.current.releasePointerCapture(pointerId);
    }
    const wasNodeDrag = interactionRef.current.mode === 'node';
    suppressClickRef.current = wasNodeDrag && interactionRef.current.moved;
    interactionRef.current = {
      mode: null,
      pointerId: null,
      nodeId: null,
      lastClient: null,
      nodeOffset: null,
      moved: false
    };
    onDragEnd();
    setDraggingCanvas(false);
  }

  return (
    <svg
      ref={svgRef}
      className={`graph-svg ${draggingNodeId ? 'dragging-node' : ''} ${draggingCanvas ? 'dragging-canvas' : ''}`}
      viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
      role="img"
      aria-label="2D 知识图谱"
      onWheel={(event) => {
        if (!event.ctrlKey) return;
        event.preventDefault();
        event.stopPropagation();
        const nextZoom = Math.min(1.8, Math.max(0.55, zoom + (event.deltaY > 0 ? -0.08 : 0.08)));
        onZoom(nextZoom);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const target = event.target as SVGElement;
        if (target === event.currentTarget || target.classList.contains('graph-stage-hitbox')) {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          interactionRef.current = {
            mode: 'canvas',
            pointerId: event.pointerId,
            nodeId: null,
            lastClient: { x: event.clientX, y: event.clientY },
            nodeOffset: null,
            moved: false
          };
          setDraggingCanvas(true);
        }
      }}
      onPointerMove={(event) => {
        const interaction = interactionRef.current;
        if (interaction.pointerId !== event.pointerId || !interaction.mode) return;
        event.preventDefault();
        event.stopPropagation();
        if (interaction.lastClient) {
          const distance = Math.hypot(event.clientX - interaction.lastClient.x, event.clientY - interaction.lastClient.y);
          if (distance > 2) interaction.moved = true;
        }
        if (interaction.mode === 'node' && interaction.nodeId) {
          const point = svgPoint(event);
          const offset = interaction.nodeOffset ?? { x: 0, y: 0 };
          onMoveNode(interaction.nodeId, {
            x: point.x + offset.x,
            y: point.y + offset.y
          });
          interaction.lastClient = { x: event.clientX, y: event.clientY };
          return;
        }
        if (interaction.mode === 'canvas' && interaction.lastClient) {
          const delta = svgDelta(event, interaction.lastClient);
          const nextPan = {
            x: panRef.current.x + delta.x,
            y: panRef.current.y + delta.y
          };
          panRef.current = nextPan;
          onPan(nextPan);
          interaction.lastClient = { x: event.clientX, y: event.clientY };
        }
      }}
      onPointerUp={(event) => finishInteraction(event.pointerId)}
      onPointerCancel={(event) => finishInteraction(event.pointerId)}
    >
      <defs>
        <marker
          id="graph-arrow"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L9,3 L0,6 Z" className="graph-arrow-head" />
        </marker>
      </defs>
      <rect className="graph-stage-hitbox" width={GRAPH_WIDTH} height={GRAPH_HEIGHT} />
      <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
        <g className="graph-edge-layer">
          {edges.map((edge, index) => {
          const source = positions[edge.source];
          const target = positions[edge.target];
          if (!source || !target) return null;
          const labelPoint = edgeLabelPoint(source, target, index);
          const relationColor = colorForRelation(edge.label);
          const connected = selectedNodeId ? edge.source === selectedNodeId || edge.target === selectedNodeId : false;
          const dimmed = !!selectedNodeId && !connected;
          const label = trimLabel(edge.label || '关联', 10);
          const labelWidth = Math.min(92, Math.max(42, label.length * 10 + 18));
          const showLabel = connected || nodes.length <= 80 || (edge.weight ?? 1) >= 45;
          return (
            <g
              className={`graph-edge-group ${connected ? 'connected' : ''} ${dimmed ? 'dimmed' : ''}`}
              key={edge.id}
              style={
                {
                  '--edge-color': relationColor,
                  '--edge-weight': String(Math.max(1, Math.min(edge.weight ?? 1, 100)))
                } as React.CSSProperties
              }
            >
              <path
                className="graph-edge-path"
                d={edgePath(source, target, index)}
                markerEnd="url(#graph-arrow)"
              />
              {showLabel && (
                <g className="graph-edge-label-wrap" transform={`translate(${labelPoint.x} ${labelPoint.y})`}>
                  <rect className="graph-edge-label-pill" x={-labelWidth / 2} y="-11" width={labelWidth} height="22" rx="11" />
                  <text className="graph-edge-label" y="4">
                    {label}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        </g>
        <g className="graph-node-layer">
        {nodes.map((node) => {
          const point = positions[node.id] ?? { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 };
          const radius = nodeRadius(node);
          const type = semanticTypeOfNode(node);
          const connected = selectedNodeId ? connectedNodeIds.has(node.id) : false;
          const selected = selectedNodeId === node.id;
          const dimmed = !!selectedNodeId && !selected && !connected;
          return (
            <g
              className={`graph-svg-node ${selected ? 'selected' : ''} ${connected ? 'connected' : ''} ${dimmed ? 'dimmed' : ''}`}
              key={node.id}
              transform={`translate(${point.x} ${point.y})`}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                const pointerPoint = svgPoint(event);
                const currentPoint = positions[node.id] ?? { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 };
                svgRef.current?.setPointerCapture(event.pointerId);
                interactionRef.current = {
                  mode: 'node',
                  pointerId: event.pointerId,
                  nodeId: node.id,
                  lastClient: { x: event.clientX, y: event.clientY },
                  nodeOffset: {
                    x: currentPoint.x - pointerPoint.x,
                    y: currentPoint.y - pointerPoint.y
                  },
                  moved: false
                };
                onDragStart(node.id);
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                onSelect(node);
              }}
            >
              <circle className="graph-node-hit-area" r={radius + 18} />
              <circle className="graph-node-halo" r={radius + 12} fill={colorForType(type)} />
              <circle className="graph-node-core" r={radius} fill={colorForType(type)} />
              <circle className="graph-node-shine" r={Math.max(6, radius * 0.38)} cx={-radius * 0.28} cy={-radius * 0.32} />
              <text className="graph-node-initial" y="5">{nodeInitial(node)}</text>
              <text className="graph-node-label" y={radius + 20}>{trimLabel(node.label, 16)}</text>
              <text className="graph-node-type" y={radius + 36}>{semanticTypeLabels[type] ?? type}</text>
            </g>
          );
        })}
        </g>
      </g>
    </svg>
  );
}

function Graph3D({
  nodes,
  edges,
  selectedNodeId,
  onSelect
}: {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  selectedNodeId: string | null;
  onSelect: (node: KnowledgeGraphNode) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.replaceChildren();

    const width = Math.max(container.clientWidth, 760);
    const height = Math.max(container.clientHeight || 810, 560);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f8fbff');
    scene.fog = new THREE.Fog('#f8fbff', 760, 1580);

    const camera = new THREE.PerspectiveCamera(36, width / height, 1, 2600);
    camera.position.set(0, 48, nodes.length <= 3 ? 520 : 920);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = false;
    controls.enableZoom = false;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = 320;
    controls.maxDistance = 1320;

    function handleGraphWheel(event: WheelEvent) {
      if (!event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      const direction = event.deltaY > 0 ? 1 : -1;
      const distance = camera.position.length();
      const nextDistance = Math.min(1320, Math.max(320, distance + direction * 46));
      camera.position.setLength(nextDistance);
    }
    renderer.domElement.addEventListener('wheel', handleGraphWheel, { passive: false });

    scene.add(new THREE.HemisphereLight(0xffffff, 0xdbeafe, 1.25));
    scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    const pointLight = new THREE.PointLight(0xffffff, 1.8);
    pointLight.position.set(260, 240, 380);
    scene.add(pointLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(-180, 260, 320);
    scene.add(directionalLight);
    const accentLight = new THREE.PointLight(0x14b8a6, 1.1);
    accentLight.position.set(-260, -120, 260);
    scene.add(accentLight);
    const grid = new THREE.GridHelper(900, 22, '#99f6e4', '#d7eef0');
    grid.position.y = -260;
    scene.add(grid);

    const positions = compute3DLayout(nodes, edges);
    const meshById = new Map<string, THREE.Mesh>();
    const nodeByMesh = new Map<THREE.Object3D, KnowledgeGraphNode>();

    nodes.forEach((node) => {
      const position = positions[node.id] ?? new THREE.Vector3();
      const sparseBoost = nodes.length <= 3 ? 7 : 0;
      const normalizedWeight = Math.max(1, Math.min(node.weight || 1, 100));
      const size = Math.min(22, 7 + sparseBoost + Math.sqrt(normalizedWeight) * 1.25);
      const semanticType = semanticTypeOfNode(node);
      const color = new THREE.Color(colorForType(semanticType));
      const geometry = new THREE.SphereGeometry(size, 36, 22);
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: selectedNodeId === node.id ? 0.2 : 0.07,
        roughness: 0.36,
        metalness: selectedNodeId === node.id ? 0.28 : 0.08
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      mesh.userData.nodeId = node.id;
      scene.add(mesh);
      meshById.set(node.id, mesh);
      nodeByMesh.set(mesh, node);

      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(size * 1.52, 32, 18),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: selectedNodeId === node.id ? 0.2 : 0.08,
          depthWrite: false
        })
      );
      halo.position.copy(position);
      scene.add(halo);

      if (nodes.length <= 36 || normalizedWeight >= 55 || selectedNodeId === node.id) {
        const label = makeTextSprite(node.label, semanticTypeLabels[semanticType] ?? semanticType, colorForType(semanticType));
        label.position.copy(position.clone().add(new THREE.Vector3(0, size + 22, 0)));
        scene.add(label);
      }
    });

    edges.forEach((edge) => {
      const source = meshById.get(edge.source);
      const target = meshById.get(edge.target);
      if (!source || !target) return;
      const midPoint = source.position.clone().add(target.position).multiplyScalar(0.5);
      midPoint.z += 28;
      const curve = new THREE.QuadraticBezierCurve3(source.position, midPoint, target.position);
      const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(28));
      const connected = selectedNodeId ? edge.source === selectedNodeId || edge.target === selectedNodeId : false;
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color(connected ? colorForRelation(edge.label) : '#94a3b8'),
        transparent: true,
        opacity: connected ? 0.9 : 0.46
      });
      scene.add(new THREE.Line(geometry, material));
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    function handleClick(event: MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(Array.from(meshById.values()), false)[0];
      if (hit) {
        const node = nodeByMesh.get(hit.object);
        if (node) onSelect(node);
      }
    }
    renderer.domElement.addEventListener('click', handleClick);

    let active = true;
    function animate() {
      if (!active) return;
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();

    return () => {
      active = false;
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.domElement.removeEventListener('wheel', handleGraphWheel);
      controls.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else {
          material?.dispose?.();
        }
      });
      container.replaceChildren();
    };
  }, [edges, nodes, onSelect, selectedNodeId]);

  return <div ref={containerRef} className="graph-3d-canvas" aria-label="3D 知识图谱" />;
}

function normalizeEdges(graph: KnowledgeGraph | null): KnowledgeGraphEdge[] {
  if (!graph) return [];
  return graph.links?.length ? graph.links : graph.edges ?? [];
}

function normalizeType(type: string) {
  return type.toLowerCase();
}

function colorForType(type: string) {
  return semanticTypeColors[type] ?? typeColors[normalizeType(type)] ?? typeColors.node;
}

function semanticTypeOfNode(node: KnowledgeGraphNode) {
  const entityType = String(node.properties?.entity_type ?? '').trim();
  if (entityType && semanticTypeLabels[entityType]) return entityType;
  const semanticType = String(node.properties?.semantic_type ?? '').trim();
  if (semanticType && semanticTypeLabels[semanticType]) return semanticType;
  const nodeType = String(node.type ?? '').trim();
  if (nodeType && semanticTypeLabels[nodeType]) return nodeType;
  return semanticType || entityType || nodeType || '其他';
}

function colorForRelation(label?: string) {
  const key = (label || '').toLowerCase();
  const matched = Object.keys(relationColors).find((item) => key.includes(item));
  return matched ? relationColors[matched] : '#94a3b8';
}

function computeLayout(nodes: KnowledgeGraphNode[], edges: KnowledgeGraphEdge[] = []) {
  const center = { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 };
  if (nodes.length === 0) return {};
  const nodeIds = new Set(nodes.map((node) => node.id));
  const degree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return;
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
    adjacency.set(edge.target, [...(adjacency.get(edge.target) ?? []), edge.source]);
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const score = (node: KnowledgeGraphNode) => (node.weight ?? 1) + (degree.get(node.id) ?? 0) * 18;
  const sorted = [...nodes].sort((a, b) => score(b) - score(a));
  const root = sorted[0];
  const others = sorted.slice(1);
  const positions: Record<string, { x: number; y: number }> = {};
  const placed = new Set<string>();
  positions[root.id] = center;
  placed.add(root.id);

  const rootNeighbors = (adjacency.get(root.id) ?? [])
    .map((id) => byId.get(id))
    .filter((node): node is KnowledgeGraphNode => !!node)
    .sort((a, b) => score(b) - score(a));

  const firstRingCount = Math.min(rootNeighbors.length, 18);
  rootNeighbors.slice(0, firstRingCount).forEach((node, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(firstRingCount, 1);
    const radiusX = 420 + Math.min(firstRingCount, 12) * 8;
    const radiusY = 255 + Math.min(firstRingCount, 12) * 4;
    positions[node.id] = {
      x: center.x + Math.cos(angle) * radiusX,
      y: center.y + Math.sin(angle) * radiusY
    };
    placed.add(node.id);
  });

  const remainingConnected = others.filter((node) => !placed.has(node.id) && (adjacency.get(node.id) ?? []).some((id) => placed.has(id)));
  remainingConnected.forEach((node, index) => {
    const anchorId = (adjacency.get(node.id) ?? []).find((id) => placed.has(id));
    const anchor = anchorId ? positions[anchorId] : center;
    const angle = index * 2.399963229728653;
    const distance = 92 + ((index % 5) * 24);
    positions[node.id] = {
      x: Math.max(70, Math.min(GRAPH_WIDTH - 70, anchor.x + Math.cos(angle) * distance)),
      y: Math.max(70, Math.min(GRAPH_HEIGHT - 70, anchor.y + Math.sin(angle) * distance))
    };
    placed.add(node.id);
  });

  const groups = groupNodesBySemanticType(others.filter((node) => !placed.has(node.id)));
  const activeTypes = semanticTypeOrder.filter((type) => groups.get(type)?.length);
  const fallbackTypes = Array.from(groups.keys()).filter((type) => !activeTypes.includes(type));
  const orderedTypes = [...activeTypes, ...fallbackTypes];

  orderedTypes.forEach((type, groupIndex) => {
    const groupNodes = groups.get(type) ?? [];
    const groupAngle = -Math.PI / 2 + (Math.PI * 2 * groupIndex) / Math.max(orderedTypes.length, 1);
    const groupSizeBoost = Math.min(groupNodes.length, 44);
    const groupCenter = {
      x: center.x + Math.cos(groupAngle) * (390 + groupSizeBoost * 3.4),
      y: center.y + Math.sin(groupAngle) * (225 + groupSizeBoost * 1.8)
    };
    groupNodes.forEach((node, index) => {
      const localIndex = index + 1;
      const localAngle = groupAngle + Math.PI + localIndex * 2.399963229728653;
      const localRadiusX = Math.min(335, 48 + Math.sqrt(localIndex) * 43 + groupNodes.length * 1.6);
      const localRadiusY = Math.min(215, 34 + Math.sqrt(localIndex) * 29 + groupNodes.length * 1.15);
      const isHub = index === 0;
      positions[node.id] = isHub
        ? groupCenter
        : {
            x: groupCenter.x + Math.cos(localAngle) * localRadiusX,
            y: groupCenter.y + Math.sin(localAngle) * localRadiusY
          };
    });
  });
  return positions;
}

function compute3DLayout(nodes: KnowledgeGraphNode[], edges: KnowledgeGraphEdge[] = []) {
  const result: Record<string, THREE.Vector3> = {};
  const nodeIds = new Set(nodes.map((node) => node.id));
  const degree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return;
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
    adjacency.set(edge.target, [...(adjacency.get(edge.target) ?? []), edge.source]);
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const score = (node: KnowledgeGraphNode) => (node.weight ?? 1) + (degree.get(node.id) ?? 0) * 18;
  const sorted = [...nodes].sort((a, b) => score(b) - score(a));
  const root = sorted[0];
  if (root) result[root.id] = new THREE.Vector3(0, 0, 0);
  const placed = new Set<string>(root ? [root.id] : []);
  const others = sorted.slice(1);

  const rootNeighbors = root
    ? (adjacency.get(root.id) ?? [])
        .map((id) => byId.get(id))
        .filter((node): node is KnowledgeGraphNode => !!node)
        .sort((a, b) => score(b) - score(a))
    : [];
  const firstRingCount = Math.min(rootNeighbors.length, 18);
  rootNeighbors.slice(0, firstRingCount).forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(firstRingCount, 1);
    const radius = 430 + Math.min(firstRingCount, 12) * 8;
    result[node.id] = new THREE.Vector3(
      Math.cos(angle) * radius,
      ((index % 5) - 2) * 45,
      Math.sin(angle) * radius
    );
    placed.add(node.id);
  });

  others
    .filter((node) => !placed.has(node.id) && (adjacency.get(node.id) ?? []).some((id) => placed.has(id)))
    .forEach((node, index) => {
      const anchorId = (adjacency.get(node.id) ?? []).find((id) => placed.has(id));
      const anchor = anchorId ? result[anchorId] : new THREE.Vector3();
      const angle = index * 2.399963229728653;
      const distance = 120 + (index % 5) * 24;
      result[node.id] = anchor.clone().add(
        new THREE.Vector3(
          Math.cos(angle) * distance,
          ((index % 7) - 3) * 24,
          Math.sin(angle) * distance
        )
      );
      placed.add(node.id);
    });

  const groups = groupNodesBySemanticType(others.filter((node) => !placed.has(node.id)));
  const activeTypes = semanticTypeOrder.filter((type) => groups.get(type)?.length);
  const fallbackTypes = Array.from(groups.keys()).filter((type) => !activeTypes.includes(type));
  const orderedTypes = [...activeTypes, ...fallbackTypes];

  orderedTypes.forEach((type, groupIndex) => {
    const groupNodes = groups.get(type) ?? [];
    const groupAngle = (Math.PI * 2 * groupIndex) / Math.max(orderedTypes.length, 1);
    const groupSizeBoost = Math.min(groupNodes.length, 44);
    const groupCenter = new THREE.Vector3(
      Math.cos(groupAngle) * (390 + groupSizeBoost * 2.6),
      ((groupIndex % 3) - 1) * 105,
      Math.sin(groupAngle) * (390 + groupSizeBoost * 2.6)
    );
    groupNodes.forEach((node, index) => {
      if (index === 0) {
        result[node.id] = groupCenter;
        return;
      }
      const count = Math.max(groupNodes.length - 1, 1);
      const localAngle = index * 2.399963229728653;
      const localRadius = Math.min(245, 52 + Math.sqrt(index) * 34 + count * 1.2);
      result[node.id] = groupCenter.clone().add(
        new THREE.Vector3(
          Math.cos(localAngle) * localRadius,
          ((index % 7) - 3) * 24,
          Math.sin(localAngle) * localRadius
        )
      );
    });
  });
  return result;
}

function groupNodesBySemanticType(nodes: KnowledgeGraphNode[]) {
  const groups = new Map<string, KnowledgeGraphNode[]>();
  nodes.forEach((node) => {
    const type = semanticTypeOfNode(node);
    const group = groups.get(type) ?? [];
    group.push(node);
    groups.set(type, group);
  });
  groups.forEach((group) => {
    group.sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1));
  });
  return groups;
}

function edgePath(source: { x: number; y: number }, target: { x: number; y: number }, index: number) {
  const control = edgeControlPoint(source, target, index);
  return `M ${source.x} ${source.y} Q ${control.x} ${control.y} ${target.x} ${target.y}`;
}

function edgeLabelPoint(source: { x: number; y: number }, target: { x: number; y: number }, index: number) {
  const control = edgeControlPoint(source, target, index);
  return {
    x: (source.x + 2 * control.x + target.x) / 4,
    y: (source.y + 2 * control.y + target.y) / 4
  };
}

function edgeControlPoint(source: { x: number; y: number }, target: { x: number; y: number }, index: number) {
  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
  const offset = ((index % 7) - 3) * 15;
  return {
    x: midX - (dy / length) * offset,
    y: midY + (dx / length) * offset
  };
}

function nodeRadius(node: KnowledgeGraphNode) {
  const weight = Math.max(1, Math.min(node.weight ?? 1, 100));
  return Math.min(30, 11 + Math.sqrt(weight) * 1.75);
}

function nodeInitial(node: KnowledgeGraphNode) {
  const type = semanticTypeOfNode(node);
  if (type === 'file') return 'F';
  if (type === 'api') return 'A';
  if (type === 'technology') return 'T';
  if (type === 'knowledge_base') return 'K';
  if (type === 'workspace') return 'W';
  if (type === 'module') return 'M';
  if (type === 'process') return 'P';
  if (type === 'config') return 'C';
  if (type === 'permission') return 'S';
  if (type === '技术组件') return 'T';
  if (type === '功能模块') return 'M';
  if (type === '数据对象') return 'D';
  if (type === '配置权限') return 'S';
  if (type === '流程动作') return 'P';
  if (type === '指标状态') return 'I';
  if (type === '文档章节') return 'H';
  return trimLabel(node.label, 1).toUpperCase();
}

function makeTextSprite(text: string, typeLabel: string, color: string) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 128;
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(255,255,255,0.9)';
    roundRect(context, 26, 18, 460, 86, 22);
    context.fill();
    context.strokeStyle = color;
    context.lineWidth = 3;
    roundRect(context, 26, 18, 460, 86, 22);
    context.stroke();
    context.fillStyle = '#0f172a';
    context.font = '700 28px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(trimLabel(text, 18), canvas.width / 2, 56);
    context.fillStyle = '#64748b';
    context.font = '700 18px Arial, sans-serif';
    context.fillText(typeLabel, canvas.width / 2, 86);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(152, 38, 1);
  return sprite;
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function trimLabel(text: string, maxLength = 18) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}
