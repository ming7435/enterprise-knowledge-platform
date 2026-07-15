export type KnownStatusBadgeStatus =
  | 'uploaded'
  | 'queued'
  | 'pending'
  | 'parsing'
  | 'parsed'
  | 'indexing'
  | 'indexed'
  | 'unsupported'
  | 'asset_only'
  | 'configured'
  | 'ready'
  | 'building'
  | 'needs_update'
  | 'success'
  | 'failed'
  | 'disabled'
  | 'empty'
  | 'missing';

export type StatusBadgeStatus = KnownStatusBadgeStatus | (string & {});
export type StatusBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface StatusBadgeMeta {
  label: string;
  tone: StatusBadgeTone;
}

const STATUS_META: Record<string, StatusBadgeMeta> = {
  uploaded: { label: '已上传', tone: 'info' },
  queued: { label: '排队中', tone: 'warning' },
  pending: { label: '待处理', tone: 'warning' },
  parsing: { label: '解析中', tone: 'warning' },
  parsed: { label: '已解析', tone: 'success' },
  indexing: { label: '入库中', tone: 'warning' },
  indexed: { label: '已入库', tone: 'success' },
  unsupported: { label: '暂不支持解析', tone: 'neutral' },
  asset_only: { label: '仅保存', tone: 'neutral' },
  configured: { label: '已配置', tone: 'success' },
  ready: { label: '可用', tone: 'success' },
  building: { label: '构建中', tone: 'warning' },
  needs_update: { label: '需要更新', tone: 'warning' },
  success: { label: '成功', tone: 'success' },
  failed: { label: '失败', tone: 'danger' },
  disabled: { label: '已停用', tone: 'neutral' },
  empty: { label: '暂无数据', tone: 'neutral' },
  missing: { label: '待配置', tone: 'warning' },
  documents_uploaded: { label: '已上传文档', tone: 'info' },
  'milvus-configured': { label: 'Milvus 已配置', tone: 'success' },
  'milvus-ready': { label: 'Milvus 就绪', tone: 'success' },
  'neo4j-ready': { label: 'Neo4j 就绪', tone: 'success' },
  'sqlite-ready': { label: 'SQLite 就绪', tone: 'success' },
  owner: { label: '所有者', tone: 'info' },
  admin: { label: '管理员', tone: 'info' },
  member: { label: '成员', tone: 'neutral' },
  viewer: { label: '只读', tone: 'neutral' },
};

export interface StatusBadgeProps {
  status: StatusBadgeStatus;
  label?: string;
  tone?: StatusBadgeTone;
  className?: string;
}

function fallbackStatusLabel(status: string) {
  const value = status.trim();
  if (!value) return '未知状态';
  return value.replace(/[_-]+/g, ' ');
}

export function StatusBadge({ status, label, tone, className = '' }: StatusBadgeProps) {
  const normalizedStatus = String(status).trim().toLowerCase();
  const meta = STATUS_META[normalizedStatus] ?? {
    label: fallbackStatusLabel(String(status)),
    tone: 'neutral' as const,
  };
  return <span className={`ui-status-badge ${tone ?? meta.tone} ${className}`.trim()}>{label ?? meta.label}</span>;
}
