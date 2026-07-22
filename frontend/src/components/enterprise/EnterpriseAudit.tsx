import { useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';

import { getActorName } from '../../display';
import type { AuditLogRecord } from '../../types';
import { Button } from '../ui/Button';
import { DataTable } from '../ui/DataTable';
import { EmptyState, ErrorState, LoadingState, PermissionDenied } from '../ui/AsyncState';
import { SearchInput, SelectField } from '../ui/FormControls';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge } from '../ui/StatusBadge';
import {
  auditActionLabel,
  auditDetail,
  auditStatus,
  EnterpriseIsolationNotice,
  Feedback,
  formatDate,
  SectionHeader,
} from './shared';
import type { EnterpriseSharedProps } from './types';

export interface EnterpriseAuditProps extends EnterpriseSharedProps {
  canManageMembers: boolean;
  deletingAuditLogId: string | null;
  auditBulkDeleting: boolean;
  auditRetentionDeleting: boolean;
  onRefresh: () => void;
  onDeleteAuditLog: (log: AuditLogRecord) => void | Promise<void>;
  onDeleteAllAuditLogs: () => void | Promise<void>;
  onDeleteAuditLogsByRetention: (days: number) => void | Promise<void>;
}

export function EnterpriseAudit({
  user,
  workspace,
  members,
  auditLogs,
  loading,
  error,
  notice,
  canManageMembers,
  deletingAuditLogId,
  auditBulkDeleting,
  auditRetentionDeleting,
  onRefresh,
  onDeleteAuditLog,
  onDeleteAllAuditLogs,
  onDeleteAuditLogsByRetention,
}: EnterpriseAuditProps) {
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [retentionDays, setRetentionDays] = useState('30');

  const actions = useMemo(
    () => Array.from(new Set(auditLogs.map((item) => item.action))).sort(),
    [auditLogs]
  );
  const filteredLogs = useMemo(() => auditLogs.filter((item) => {
    const actor = getActorName(item.user_id, members, user);
    const haystack = `${auditActionLabel(item.action)} ${actor} ${auditDetail(item.detail)}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase())
      && (actionFilter === 'all' || item.action === actionFilter)
      && (statusFilter === 'all' || auditStatus(item) === statusFilter);
  }), [actionFilter, auditLogs, members, query, statusFilter, user]);

  if (!canManageMembers) {
    return (
      <section className="personal-workbench-v2 enterprise-workbench-v2">
        <PageHeader eyebrow="企业工作区" title="审计日志" description="查看当前企业工作区中的安全与操作记录。" />
        <EnterpriseIsolationNotice />
        <PermissionDenied title="无权查看企业审计日志" description="只有企业所有者和管理员可以访问审计记录。" />
      </section>
    );
  }

  return (
    <section className="personal-workbench-v2 enterprise-workbench-v2 personal-page-audit">
      <PageHeader
        eyebrow="企业工作区"
        title="审计日志"
        description={`${workspace.name} · 所有时间均按北京时间精确到秒显示。`}
        actions={
          <div className="enterprise-audit-actions">
            <SelectField value={retentionDays} onChange={(event) => setRetentionDays(event.target.value)} aria-label="审计日志保留期限" options={[
              { value: '7', label: '保留 7 天' }, { value: '30', label: '保留 30 天' },
              { value: '90', label: '保留 90 天' }, { value: '180', label: '保留 180 天' },
            ]} />
            <Button variant="danger" icon={Trash2} loading={auditRetentionDeleting} disabled={!auditLogs.length || auditBulkDeleting} onClick={() => void onDeleteAuditLogsByRetention(Number(retentionDays))}>按保留期清理</Button>
            <Button variant="danger" icon={Trash2} loading={auditBulkDeleting} disabled={!auditLogs.length || auditRetentionDeleting} onClick={() => void onDeleteAllAuditLogs()}>删除全部</Button>
            <Button icon={RefreshCw} loading={loading} onClick={onRefresh}>刷新</Button>
          </div>
        }
      />
      <EnterpriseIsolationNotice />
      <Feedback error={error} notice={notice} />
      {error && !auditLogs.length ? <ErrorState title="审计日志加载失败" description={error} onRetry={onRefresh} /> : null}
      {loading && !auditLogs.length ? <LoadingState label="正在加载企业审计日志" /> : null}

      <section className="personal-section">
        <SectionHeader title="审计日志列表" description={`${auditLogs.length} 条事件 · 当前筛选结果 ${filteredLogs.length} 条`} />
        <div className="personal-filter-toolbar">
          <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery('')} placeholder="搜索操作、执行人或详情" />
          <SelectField value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} options={[
            { value: 'all', label: '全部操作类型' }, ...actions.map((action) => ({ value: action, label: auditActionLabel(action) })),
          ]} />
          <SelectField value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} options={[
            { value: 'all', label: '全部状态' }, { value: 'ready', label: '成功' }, { value: 'failed', label: '失败' },
          ]} />
          <Button size="sm" variant="ghost" onClick={() => { setQuery(''); setActionFilter('all'); setStatusFilter('all'); }}>重置</Button>
        </div>
        {auditLogs.length ? (
          <DataTable<AuditLogRecord>
            rows={filteredLogs}
            rowKey={(item) => item.id}
            emptyText="没有找到相关内容，请尝试更换关键词"
            columns={[
              { key: 'action', label: '操作类型', width: '150px', render: (item) => <strong>{auditActionLabel(item.action)}</strong> },
              { key: 'actor', label: '执行人', width: '130px', render: (item) => getActorName(item.user_id, members, user) },
              { key: 'target', label: '操作对象', width: '170px', render: (item) => `${item.target_type || '对象'}${item.target_id ? ` · ${item.target_id.slice(0, 8)}` : ''}` },
              { key: 'detail', label: '详情', render: (item) => <span title={auditDetail(item.detail)}>{auditDetail(item.detail)}</span> },
              { key: 'time', label: '北京时间', width: '180px', render: (item) => formatDate(item.created_at) },
              { key: 'status', label: '状态', width: '90px', render: (item) => <StatusBadge status={auditStatus(item)} label={auditStatus(item) === 'failed' ? '失败' : '成功'} /> },
              { key: 'actions', label: '操作', width: '100px', render: (item) => <Button size="sm" variant="danger" icon={Trash2} loading={deletingAuditLogId === item.id} disabled={auditBulkDeleting || auditRetentionDeleting} onClick={() => void onDeleteAuditLog(item)}>删除</Button> },
            ]}
          />
        ) : <EmptyState title="当前企业暂无审计日志" description="文档、成员、设置和问答操作会在这里形成真实审计记录。" icon={ShieldCheck} />}
      </section>
    </section>
  );
}
