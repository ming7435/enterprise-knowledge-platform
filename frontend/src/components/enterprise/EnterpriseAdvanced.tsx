import { BarChart3, RefreshCw, Route } from 'lucide-react';

import type { AdvancedOverview, KnowledgeGraph } from '../../types';
import { KnowledgeGraphExplorer } from '../KnowledgeGraphExplorer';
import { Button } from '../ui/Button';
import { DataTable } from '../ui/DataTable';
import { EmptyState, ErrorState } from '../ui/AsyncState';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge } from '../ui/StatusBadge';
import {
  AnalysisBlock,
  buildEnterpriseActivity,
  buildEnterpriseAnalysis,
  EnterpriseActivityBadge,
  EnterpriseIsolationNotice,
  Feedback,
  formatDate,
  MetricStrip,
  SectionHeader,
} from './shared';
import type { EnterpriseSharedProps } from './types';

interface ActivityRow {
  id: string;
  type: string;
  title: string;
  description: string;
  actor: string;
  createdAt: string;
  status: string;
}

export interface EnterpriseAdvancedProps extends EnterpriseSharedProps {
  overview: AdvancedOverview | null;
  graph: KnowledgeGraph | null;
  onRefresh: () => void;
  onRebuildGraph: () => void;
  onSearchQueryChange: (value: string) => void;
  onKnowledgeDocumentFilterChange: (documentId: string) => void;
}

export function EnterpriseAdvanced({
  user,
  documents,
  chunks,
  members,
  auditLogs,
  chatMessages,
  notifications,
  profile,
  overview,
  graph,
  selectedGraphDocumentIds,
  loading,
  error,
  notice,
  onNavigate,
  onRefresh,
  onRebuildGraph,
  onSearchQueryChange,
  onKnowledgeDocumentFilterChange,
  onSelectedGraphDocumentIdsChange,
  onSearchGraphNodes,
  onLoadGraphNodeDetail,
  onLoadGraphNeighbors,
}: EnterpriseAdvancedProps) {
  const activities: ActivityRow[] = buildEnterpriseActivity(
    documents,
    auditLogs,
    chatMessages,
    notifications,
    user,
    members
  ).slice(0, 10);
  const analysis = buildEnterpriseAnalysis(documents, chunks, members, chatMessages);

  return (
    <section className="personal-workbench-v2 enterprise-workbench-v2 personal-page-advanced">
      <PageHeader eyebrow="企业工作区" title="高级驾驶舱" description="集中查看企业知识资产、真实知识图谱、问答动态和运行状态。" actions={<Button icon={RefreshCw} loading={loading} onClick={onRefresh}>刷新驾驶舱</Button>} />
      <EnterpriseIsolationNotice />
      <Feedback error={error} notice={notice} />
      {error && !overview && !graph ? <ErrorState title="高级驾驶舱加载失败" description={error} onRetry={onRefresh} /> : null}

      <MetricStrip metrics={[
        { label: '企业文档', value: String(overview?.document_count ?? profile.documentCount) },
        { label: '知识片段', value: String(overview?.chunk_count ?? profile.chunkCount) },
        { label: '问答次数', value: String(profile.qaCount) },
        { label: '最近动态', value: String(activities.length) },
        { label: '知识库状态', value: profile.knowledgeStatusText },
      ]} />

      <section className="personal-graph-surface enterprise-graph-surface">
        <SectionHeader
          title="企业知识图谱"
          description="实体、关系和证据仅来自当前所选企业文件知识库。"
          action={<Button size="sm" icon={Route} loading={loading} disabled={!profile.canManageSettings} title={!profile.canManageSettings ? '只有所有者或管理员可以重建图谱' : undefined} onClick={onRebuildGraph}>重建图谱</Button>}
        />
        <KnowledgeGraphExplorer
          graph={graph}
          loading={loading}
          documents={documents}
          selectedDocumentIds={selectedGraphDocumentIds}
          workspaceLabel="企业工作区"
          onOpenDocument={(documentId) => { onKnowledgeDocumentFilterChange(documentId); onNavigate('documents'); }}
          onSearchKnowledge={(keyword) => { onSearchQueryChange(keyword); onNavigate('knowledge'); }}
          onOpenQuestion={() => onNavigate('chat')}
          onDocumentSelectionChange={onSelectedGraphDocumentIdsChange}
          onSearchGraphNodes={onSearchGraphNodes}
          onLoadGraphNodeDetail={onLoadGraphNodeDetail}
          onLoadGraphNeighbors={onLoadGraphNeighbors}
          onRefresh={onRefresh}
          onRebuild={onRebuildGraph}
        />
      </section>

      <div className="personal-advanced-grid">
        <section className="personal-section">
          <SectionHeader title="最近状态与操作记录" description="企业通知、审计、文档和问答动态合并展示" />
          {activities.length ? (
            <DataTable<ActivityRow>
              rows={activities}
              rowKey={(item) => item.id}
              emptyText="暂无最近动态"
              columns={[
                { key: 'type', label: '类型', width: '130px', render: (item) => <EnterpriseActivityBadge status={item.status} label={item.type} /> },
                { key: 'title', label: '标题', width: '190px', render: (item) => item.title },
                { key: 'description', label: '描述', render: (item) => item.description },
                { key: 'actor', label: '执行人', width: '110px', render: (item) => item.actor },
                { key: 'time', label: '北京时间', width: '180px', render: (item) => formatDate(item.createdAt) },
                { key: 'status', label: '状态', width: '90px', render: (item) => <StatusBadge status={item.status} /> },
              ]}
            />
          ) : <EmptyState compact title="暂无最近状态和操作记录" />}
        </section>

        <section className="personal-section">
          <SectionHeader title="知识资产分析" description="使用当前企业真实文档、片段和成员数据推导" />
          <div className="personal-analysis-grid">
            <AnalysisBlock title="文档类型分布" items={analysis.fileTypes} />
            <AnalysisBlock title="知识片段来源" items={analysis.chunkSources} />
            <AnalysisBlock title="知识贡献者" items={analysis.contributors} />
            <AnalysisBlock title="活跃趋势" items={analysis.activity} />
          </div>
          <Button size="sm" variant="ghost" icon={BarChart3} onClick={() => onNavigate('knowledge')}>查看企业知识资产</Button>
        </section>
      </div>
    </section>
  );
}
