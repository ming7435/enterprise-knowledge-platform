import { Network, Search, Sparkles } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';

import type { DocumentRecord, KnowledgeGraph, KnowledgeGraphEdge, KnowledgeGraphNode } from '../types';
import { GraphFilterDrawer } from './graph/GraphFilterDrawer';
import { GraphInspectorDrawer } from './graph/GraphInspectorDrawer';
import { GraphToolbar, type GraphMode } from './graph/GraphToolbar';

const KnowledgeGraph3D = lazy(() => import('./KnowledgeGraph3D'));

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
  onSearchGraphNodes?: (query: string, documentIds?: string[]) => Promise<KnowledgeGraphNode[]>;
  onLoadGraphNodeDetail?: (nodeId: string) => Promise<KnowledgeGraphNode | null>;
  onLoadGraphNeighbors?: (nodeId: string) => Promise<KnowledgeGraphNode[]>;
  onRefresh: () => void;
  onRebuild?: () => void;
}

const GRAPH_WIDTH = 1600;
const GRAPH_HEIGHT = 900;
const MIN_PANEL_WIDTH = 240;
const MAX_PANEL_WIDTH = 520;

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
  person: '人物实体',
  organization: '组织实体',
  location: '地点实体',
  product: '产品实体',
  position: '职位实体',
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
  person: '#f97316',
  organization: '#2563eb',
  location: '#14b8a6',
  product: '#8b5cf6',
  position: '#d97706',
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
  'person',
  'organization',
  'location',
  'product',
  'position',
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
  任职于: '#2563eb',
  担任: '#d97706',
  创立: '#7c3aed',
  位于: '#0891b2',
  发布: '#be123c',
  合作: '#0f766e',
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
  onSearchGraphNodes,
  onLoadGraphNodeDetail,
  onLoadGraphNeighbors,
  onRefresh,
  onRebuild
}: KnowledgeGraphExplorerProps) {
  const [mode, setMode] = useState<GraphMode>('2d');
  const [resultView, setResultView] = useState<ResultView>('graph');
  const [query, setQuery] = useState('');
  const [enabledTypes, setEnabledTypes] = useState<string[]>([]);
  const [enabledRelations, setEnabledRelations] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<KnowledgeGraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [leftPanelVisible, setLeftPanelVisible] = useState(false);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  const [leftPanelWidth, setLeftPanelWidth] = useState(260);
  const [rightPanelWidth, setRightPanelWidth] = useState(330);
  const [resultRailVisible, setResultRailVisible] = useState(false);
  const [stageStatusVisible, setStageStatusVisible] = useState(false);
  const [remoteSearchNodes, setRemoteSearchNodes] = useState<KnowledgeGraphNode[] | null>(null);
  const [graphSearchLoading, setGraphSearchLoading] = useState(false);
  const [graphSearchError, setGraphSearchError] = useState<string | null>(null);
  const [nodeDetailLoading, setNodeDetailLoading] = useState(false);
  const [nodeDetailError, setNodeDetailError] = useState<string | null>(null);
  const [remoteNeighborIds, setRemoteNeighborIds] = useState<string[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const explorerRef = useRef<HTMLElement | null>(null);
  const rightPanelRef = useRef<HTMLElement | null>(null);
  const detailRequestIdRef = useRef(0);
  const searchCallbackRef = useRef(onSearchGraphNodes);

  const nodes = graph?.nodes ?? [];
  const edges = useMemo(() => normalizeEdges(graph), [graph]);
  const availableTypes = useMemo(
    () => Array.from(new Set(nodes.map((node) => semanticTypeOfNode(node)))),
    [nodes]
  );
  const availableRelations = useMemo(
    () => Array.from(new Set(edges.map((edge) => edge.label || '关联'))),
    [edges]
  );

  useEffect(() => {
    setEnabledTypes((current) => {
      const currentValid = current.filter((type) => availableTypes.includes(type));
      return currentValid.length ? currentValid : availableTypes;
    });
  }, [availableTypes]);

  useEffect(() => {
    setEnabledRelations((current) => {
      const currentValid = current.filter((relation) => availableRelations.includes(relation));
      return currentValid.length ? currentValid : availableRelations;
    });
  }, [availableRelations]);

  useEffect(() => {
    searchCallbackRef.current = onSearchGraphNodes;
  }, [onSearchGraphNodes]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    const searchGraph = searchCallbackRef.current;
    if (!normalizedQuery || !searchGraph) {
      setRemoteSearchNodes(null);
      setGraphSearchLoading(false);
      setGraphSearchError(null);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setGraphSearchLoading(true);
      setGraphSearchError(null);
      try {
        const results = await searchGraph(normalizedQuery, selectedDocumentIds);
        if (!cancelled) setRemoteSearchNodes(results);
      } catch (error) {
        if (!cancelled) {
          setRemoteSearchNodes([]);
          setGraphSearchError(error instanceof Error ? error.message : '图谱搜索失败');
        }
      } finally {
        if (!cancelled) setGraphSearchLoading(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [query, selectedDocumentIds]);

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
    () => edges.filter((edge) => {
      const relation = edge.label || '关联';
      const matchesRelation = enabledRelations.length === 0 || enabledRelations.includes(relation);
      return matchesRelation && visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target);
    }),
    [edges, enabledRelations, visibleNodeIds]
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
    setEnabledRelations(availableRelations);
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

  async function activateNode(node: KnowledgeGraphNode) {
    setSelectedNode(node);
    setRightPanelVisible(true);
    setNodeDetailError(null);
    setRemoteNeighborIds([]);
    window.setTimeout(() => rightPanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 0);
    if (!onLoadGraphNodeDetail && !onLoadGraphNeighbors) return;

    const requestId = detailRequestIdRef.current + 1;
    detailRequestIdRef.current = requestId;
    setNodeDetailLoading(true);
    const [detailResult, neighborsResult] = await Promise.allSettled([
      onLoadGraphNodeDetail ? onLoadGraphNodeDetail(node.id) : Promise.resolve(node),
      onLoadGraphNeighbors ? onLoadGraphNeighbors(node.id) : Promise.resolve([])
    ]);
    if (detailRequestIdRef.current !== requestId) return;

    let requestError: string | null = null;
    if (detailResult.status === 'fulfilled' && detailResult.value) {
      setSelectedNode(detailResult.value);
    } else if (detailResult.status === 'rejected') {
      requestError = detailResult.reason instanceof Error ? detailResult.reason.message : '节点详情加载失败';
    }
    if (neighborsResult.status === 'fulfilled') {
      setRemoteNeighborIds(neighborsResult.value.map((item) => item.id));
    } else if (!requestError) {
      requestError = neighborsResult.reason instanceof Error ? neighborsResult.reason.message : '邻居节点加载失败';
    }
    setNodeDetailError(requestError);
    setNodeDetailLoading(false);
  }

  function toggleRelation(relation: string) {
    setEnabledRelations((current) =>
      current.includes(relation) ? current.filter((item) => item !== relation) : [...current, relation]
    );
  }

  function toggleFullscreen() {
    const element = explorerRef.current;
    if (!element) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void element.requestFullscreen?.();
  }

  function startLeftPanelResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = leftPanelWidth;
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + (moveEvent.clientX - startX);
      setLeftPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, nextWidth)));
    };
    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.classList.remove('graph-resizing-panel');
    };
    document.body.classList.add('graph-resizing-panel');
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }

  function startInspectorResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = rightPanelWidth;
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth - (moveEvent.clientX - startX);
      setRightPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, nextWidth)));
    };
    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.classList.remove('graph-resizing-inspector');
    };
    document.body.classList.add('graph-resizing-inspector');
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
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
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [edges]);
  const localSearchResultNodes = useMemo(
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
  const searchResultNodes = query.trim() && remoteSearchNodes !== null ? remoteSearchNodes.slice(0, 20) : localSearchResultNodes;
  const selectedRelations = useMemo(
    () =>
      selectedNode
        ? edges
            .filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
            .slice(0, 10)
        : [],
    [edges, selectedNode]
  );
  const workbenchColumns = [
    leftPanelVisible ? 'var(--graph-left-panel-width, 260px)' : '',
    leftPanelVisible ? '8px' : '',
    'minmax(0, 1fr)',
    rightPanelVisible ? '8px' : '',
    rightPanelVisible ? 'var(--graph-inspector-width, 360px)' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section ref={explorerRef} className="graph-explorer neo4j-workbench" aria-label={`${workspaceLabel}知识图谱`}>
      <div className="graph-browser-shell">
        <div className="graph-command-bar">
          <div className="graph-command-title">
            <Network size={22} aria-hidden="true" />
            <div>
              <h3>知识引擎</h3>
              <span>
                {sourceLabel} · {graph?.stats?.node_count ?? nodes.length} 个实体 / {graph?.stats?.edge_count ?? edges.length} 条关系
                {graph?.partial ? ' · 已截取部分数据' : ''}
              </span>
            </div>
          </div>
          <label className="graph-command-input">
            <Search size={18} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索实体、关系、文件或证据片段"
            />
          </label>
          <div className="graph-command-actions">
            <button type="button" className="graph-rebuild-button" onClick={onRebuild ?? onRefresh} disabled={loading}>
              <Sparkles size={16} aria-hidden="true" />
              重建
            </button>
          </div>
        </div>

        {graph?.message && (
          <div className={`graph-state ${disabled || unavailable ? 'warning' : 'info'}`}>
            {graph.message}
          </div>
        )}

        <div className="graph-cypher-strip" aria-label="Neo4j Browser 查询条">
          <span>$</span>
          <code>
            MATCH p=(source:Entity)-[r:FILE_RELATION]-&gt;(target:Entity)
            {selectedDocumentIds.length ? ' WHERE source.document_id IN $selectedKnowledgeBases' : ''}
            {' RETURN p LIMIT 100'}
          </code>
          <small>{filteredNodes.length} rows</small>
        </div>

        <GraphToolbar
          mode={mode}
          loading={loading}
          graphDisabled={!!disabled || !!unavailable}
          filterVisible={leftPanelVisible}
          inspectorVisible={rightPanelVisible}
          resultRailVisible={resultRailVisible}
          statusVisible={stageStatusVisible}
          onModeChange={(nextMode) => {
            setResultView('graph');
            setMode(nextMode);
          }}
          onZoomIn={() => setZoom((value) => Math.min(1.8, value + 0.1))}
          onZoomOut={() => setZoom((value) => Math.max(0.55, value - 0.1))}
          onFit={fitView}
          onReset={resetView}
          onRefresh={onRefresh}
          onToggleFilter={() => setLeftPanelVisible((value) => !value)}
          onToggleInspector={() => setRightPanelVisible((value) => !value)}
          onToggleResultRail={() => setResultRailVisible((value) => !value)}
          onToggleStatus={() => setStageStatusVisible((value) => !value)}
          onToggleFullscreen={toggleFullscreen}
        />

        <div
          className={`graph-workbench-grid ${leftPanelVisible ? '' : 'left-panel-hidden'} ${rightPanelVisible ? '' : 'right-panel-hidden'}`}
          style={
            {
              '--graph-left-panel-width': `${leftPanelWidth}px`,
              '--graph-inspector-width': `${rightPanelWidth}px`,
              gridTemplateColumns: workbenchColumns
            } as React.CSSProperties
          }
        >
          <GraphFilterDrawer
            visible={leftPanelVisible}
            workspaceLabel={workspaceLabel}
            nodeCount={filteredNodes.length}
            edgeCount={filteredEdges.length}
            documents={documents}
            selectedDocumentIds={selectedDocumentIds}
            loading={loading}
            availableTypes={availableTypes}
            enabledTypes={enabledTypes}
            typeCounts={typeCounts}
            relationCounts={relationCounts}
            enabledRelations={enabledRelations}
            searchLoading={graphSearchLoading}
            searchError={graphSearchError}
            query={query}
            searchResults={searchResultNodes}
            selectedNodeId={selectedNode?.id ?? null}
            getNodeType={semanticTypeOfNode}
            getTypeLabel={(type) => semanticTypeLabels[type] ?? type}
            getTypeColor={colorForType}
            getRelationColor={colorForRelation}
            onClose={() => setLeftPanelVisible(false)}
            onClearDocuments={() => onDocumentSelectionChange?.([])}
            onToggleDocument={toggleDocument}
            onToggleType={toggleType}
            onToggleRelation={toggleRelation}
            onSelectNode={activateNode}
          />

          {leftPanelVisible && (
            <div
              className="graph-panel-resizer"
              role="separator"
              aria-label="调整图谱图例宽度"
              aria-orientation="vertical"
              onPointerDown={startLeftPanelResize}
              title="拖动调整图谱图例宽度"
            />
          )}

          <div className="graph-canvas-column">
            <div className={`graph-result-frame ${resultRailVisible ? '' : 'rail-hidden'}`}>
              {resultRailVisible && <div className="graph-result-rail" role="tablist" aria-label="图谱结果视图">
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
              </div>}
              <div className="graph-result-body">
                {resultView === 'graph' ? (
                  <div className={`graph-stage ${stageStatusVisible ? 'show-stage-status' : ''}`}>
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
                        highlightedNodeIds={remoteNeighborIds}
                        onZoom={setZoom}
                        onPan={setPan}
                        onDragStart={setDraggingNodeId}
                        onDragEnd={() => setDraggingNodeId(null)}
                        onMoveNode={(nodeId, point) =>
                          setPositions((items) => ({
                            ...items,
                            [nodeId]: clampGraphPoint(point)
                          }))
                        }
                        onSelect={activateNode}
                      />
                    ) : (
                      <Suspense fallback={<div className="graph-overlay">正在加载 3D 图谱引擎...</div>}>
                        <KnowledgeGraph3D
                          nodes={filteredNodes}
                          edges={filteredEdges}
                          selectedNodeId={selectedNode?.id ?? null}
                          typeLabels={semanticTypeLabels}
                          typeOrder={semanticTypeOrder}
                          getNodeType={semanticTypeOfNode}
                          getNodeColor={colorForType}
                          getRelationColor={colorForRelation}
                          trimLabel={trimLabel}
                          onSelect={activateNode}
                        />
                      </Suspense>
                    )}
                    {stageStatusVisible && !loading && !empty && !disabled && !unavailable && (
                      <>
                        <div className="graph-result-status">
                          Displaying {filteredNodes.length} nodes, {filteredEdges.length} relationships.
                        </div>
                        <div className="graph-viewport-controls" aria-label="图谱视口控制">
                          <button type="button" onClick={fitView} title="Fit to screen">
                            ⛶
                          </button>
                          <button
                            type="button"
                            onClick={() => setZoom((value) => Math.min(1.8, value + 0.1))}
                            disabled={mode !== '2d'}
                            title="Zoom in"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => setZoom((value) => Math.max(0.55, value - 0.1))}
                            disabled={mode !== '2d'}
                            title="Zoom out"
                          >
                            −
                          </button>
                          <button type="button" onClick={resetView} title="Reset graph">
                            ↺
                          </button>
                        </div>
                      </>
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

          {rightPanelVisible && (
          <div
            className="graph-inspector-resizer"
            role="separator"
            aria-label="调整实体检查器宽度"
            aria-orientation="vertical"
            onPointerDown={startInspectorResize}
            title="拖动调整检查器宽度"
          />
          )}
          {rightPanelVisible && (
          <GraphInspectorDrawer
            ref={rightPanelRef}
            visible={rightPanelVisible}
            node={selectedNode}
            nodeById={new Map(nodes.map((node) => [node.id, node]))}
            relations={selectedRelations}
            workspaceLabel={workspaceLabel}
            loading={nodeDetailLoading}
            error={nodeDetailError}
            getNodeType={semanticTypeOfNode}
            getTypeLabel={(type) => semanticTypeLabels[type] ?? type}
            getRelationColor={colorForRelation}
            onClose={() => setRightPanelVisible(false)}
            onClear={() => setSelectedNode(null)}
            onSelectNode={activateNode}
            onOpenDocument={onOpenDocument}
            onSearchKnowledge={onSearchKnowledge}
            onOpenQuestion={onOpenQuestion}
          />
          )}
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
  highlightedNodeIds,
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
  highlightedNodeIds: string[];
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
    originClient: { x: number; y: number } | null;
    lastClient: { x: number; y: number } | null;
    nodeOffset: { x: number; y: number } | null;
    moved: boolean;
  }>({
    mode: null,
    pointerId: null,
    nodeId: null,
    originClient: null,
    lastClient: null,
    nodeOffset: null,
    moved: false
  });
  const panRef = useRef(pan);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const connectedNodeIds = useMemo(() => {
    const ids = new Set<string>(highlightedNodeIds);
    if (!selectedNodeId) return ids;
    edges.forEach((edge) => {
      if (edge.source === selectedNodeId) ids.add(edge.target);
      if (edge.target === selectedNodeId) ids.add(edge.source);
    });
    return ids;
  }, [edges, highlightedNodeIds, selectedNodeId]);

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
    const interaction = interactionRef.current;
    if (interaction.mode === 'node' && interaction.nodeId && !interaction.moved) {
      const node = nodeById.get(interaction.nodeId);
      if (node) onSelect(node);
    }
    interactionRef.current = {
      mode: null,
      pointerId: null,
      nodeId: null,
      originClient: null,
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
            originClient: { x: event.clientX, y: event.clientY },
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
        if (interaction.originClient) {
          const distance = Math.hypot(event.clientX - interaction.originClient.x, event.clientY - interaction.originClient.y);
          if (distance > 5) interaction.moved = true;
        }
        if (!interaction.moved) {
          return;
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
          const sourceNode = nodeById.get(edge.source);
          const targetNode = nodeById.get(edge.target);
          if (!sourceNode || !targetNode) return null;
          const geometry = clippedEdgeGeometry(
            source,
            target,
            index,
            nodeRadius(sourceNode),
            nodeRadius(targetNode)
          );
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
                d={geometry.path}
                markerEnd="url(#graph-arrow)"
              />
              {showLabel && (
                <g className="graph-edge-label-wrap" transform={`translate(${geometry.label.x} ${geometry.label.y})`}>
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
              role="button"
              tabIndex={0}
              aria-label={`${node.label}，${semanticTypeLabels[type] ?? type}`}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(node);
                }
              }}
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
                  originClient: { x: event.clientX, y: event.clientY },
                  lastClient: { x: event.clientX, y: event.clientY },
                  nodeOffset: {
                    x: currentPoint.x - pointerPoint.x,
                    y: currentPoint.y - pointerPoint.y
                  },
                  moved: false
                };
                onDragStart(node.id);
              }}
            >
              <circle className="graph-node-hit-area" r={Math.max(radius + 10, 30)} />
              <circle className="graph-node-selection-ring" r={radius + 8} fill="none" />
              <circle className="graph-node-halo" r={radius + 5} fill={colorForType(type)} />
              <circle className="graph-node-core" r={radius} fill={colorForType(type)} />
              <text className="graph-node-label" y="4">{trimLabel(node.label, radius > 25 ? 8 : 5)}</text>
              <text className="graph-node-caption" y={radius + 19}>{semanticTypeLabels[type] ?? type}</text>
            </g>
          );
        })}
        </g>
      </g>
    </svg>
  );
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

function clippedEdgeGeometry(
  source: { x: number; y: number },
  target: { x: number; y: number },
  index: number,
  sourceRadius: number,
  targetRadius: number
) {
  const control = edgeControlPoint(source, target, index);
  const startDirection = normalizedVector(control.x - source.x, control.y - source.y);
  const endDirection = normalizedVector(control.x - target.x, control.y - target.y);
  const start = {
    x: source.x + startDirection.x * (sourceRadius + 3),
    y: source.y + startDirection.y * (sourceRadius + 3)
  };
  const end = {
    x: target.x + endDirection.x * (targetRadius + 8),
    y: target.y + endDirection.y * (targetRadius + 8)
  };
  return {
    path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
    label: {
      x: (start.x + 2 * control.x + end.x) / 4,
      y: (start.y + 2 * control.y + end.y) / 4
    }
  };
}

function normalizedVector(x: number, y: number) {
  const length = Math.max(Math.hypot(x, y), 0.001);
  return { x: x / length, y: y / length };
}

function clampGraphPoint(point: { x: number; y: number }) {
  const padding = 44;
  return {
    x: Math.min(GRAPH_WIDTH - padding, Math.max(padding, point.x)),
    y: Math.min(GRAPH_HEIGHT - padding, Math.max(padding, point.y))
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
  const normalized = (weight - 1) / 99;
  return 18 + Math.sqrt(normalized) * 24;
}

function trimLabel(text: string, maxLength = 18) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}
