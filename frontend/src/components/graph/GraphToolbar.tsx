import {
  Box,
  Database,
  Eye,
  Filter,
  Fullscreen,
  Maximize2,
  Minus,
  PanelRightOpen,
  Plus,
  RefreshCw,
  RotateCcw,
  Share2
} from 'lucide-react';

export type GraphMode = '2d' | '3d';

interface GraphToolbarProps {
  mode: GraphMode;
  loading: boolean;
  graphDisabled: boolean;
  filterVisible: boolean;
  inspectorVisible: boolean;
  resultRailVisible: boolean;
  statusVisible: boolean;
  onModeChange: (mode: GraphMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
  onRefresh: () => void;
  onToggleFilter: () => void;
  onToggleInspector: () => void;
  onToggleResultRail: () => void;
  onToggleStatus: () => void;
  onToggleFullscreen: () => void;
}

export function GraphToolbar({
  mode,
  loading,
  graphDisabled,
  filterVisible,
  inspectorVisible,
  resultRailVisible,
  statusVisible,
  onModeChange,
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
  onRefresh,
  onToggleFilter,
  onToggleInspector,
  onToggleResultRail,
  onToggleStatus,
  onToggleFullscreen
}: GraphToolbarProps) {
  const unavailable = loading || graphDisabled;

  return (
    <div className="graph-page-toolbar" aria-label="知识图谱页面控制">
      <div className="graph-toolbar-group" role="group" aria-label="图谱视图">
        <button
          type="button"
          className={mode === '2d' ? 'active' : ''}
          aria-pressed={mode === '2d'}
          onClick={() => onModeChange('2d')}
        >
          <Share2 size={16} aria-hidden="true" />
          2D
        </button>
        <button
          type="button"
          className={mode === '3d' ? 'active' : ''}
          aria-pressed={mode === '3d'}
          onClick={() => onModeChange('3d')}
        >
          <Box size={16} aria-hidden="true" />
          3D
        </button>
      </div>

      <div className="graph-toolbar-group" role="group" aria-label="画布控制">
        <button type="button" onClick={onZoomOut} disabled={unavailable || mode !== '2d'} title="缩小">
          <Minus size={16} aria-hidden="true" />
          <span className="sr-only">缩小</span>
        </button>
        <button type="button" onClick={onZoomIn} disabled={unavailable || mode !== '2d'} title="放大">
          <Plus size={16} aria-hidden="true" />
          <span className="sr-only">放大</span>
        </button>
        <button type="button" onClick={onFit} disabled={unavailable} title="适配画布">
          <Maximize2 size={16} aria-hidden="true" />
          适配
        </button>
        <button type="button" onClick={onReset} disabled={loading} title="重置视图与筛选">
          <RotateCcw size={16} aria-hidden="true" />
          重置
        </button>
        <button type="button" onClick={onRefresh} disabled={loading} title="刷新图谱数据">
          <RefreshCw size={16} aria-hidden="true" />
          刷新
        </button>
      </div>

      <div className="graph-toolbar-group graph-toolbar-panels" role="group" aria-label="面板控制">
        <button type="button" className={filterVisible ? 'active' : ''} aria-pressed={filterVisible} onClick={onToggleFilter}>
          <Filter size={16} aria-hidden="true" />
          筛选
        </button>
        <button type="button" className={inspectorVisible ? 'active' : ''} aria-pressed={inspectorVisible} onClick={onToggleInspector}>
          <PanelRightOpen size={16} aria-hidden="true" />
          详情
        </button>
        <button type="button" className={resultRailVisible ? 'active' : ''} aria-pressed={resultRailVisible} onClick={onToggleResultRail} title="结果视图">
          <Database size={16} aria-hidden="true" />
          结果
        </button>
        <button type="button" className={statusVisible ? 'active' : ''} aria-pressed={statusVisible} onClick={onToggleStatus} title="画布状态">
          <Eye size={16} aria-hidden="true" />
          状态
        </button>
        <button type="button" onClick={onToggleFullscreen} title="全屏查看">
          <Fullscreen size={16} aria-hidden="true" />
          <span className="sr-only">全屏查看</span>
        </button>
      </div>
    </div>
  );
}
