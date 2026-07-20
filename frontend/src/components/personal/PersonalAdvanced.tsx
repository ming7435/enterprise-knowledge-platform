import { BarChart3, RefreshCw, Route } from 'lucide-react';

import { KnowledgeGraphExplorer } from '../KnowledgeGraphExplorer';
import { Button } from '../ui/Button';
import { DataTable } from '../ui/DataTable';
import { EmptyState, ErrorState } from '../ui/AsyncState';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge } from '../ui/StatusBadge';
import {
  AnalysisBlock,
  buildAssetAnalysis,
  buildRecentOperations,
  Feedback,
  formatDate,
  MetricStrip,
  NotificationBadge,
  PersonalIsolationNotice,
  SectionHeader,
} from './shared';
import type { PersonalSharedProps } from './types';
import type { AdvancedNotification, AdvancedOverview, KnowledgeGraph } from '../../types';

interface ActivityRow {
  id: string;
  kind: 'notification' | 'operation';
  action: string;
  title: string;
  description: string;
  timeLabel: string;
  status: string;
}

export interface PersonalAdvancedProps extends PersonalSharedProps {
  overview: AdvancedOverview | null;
  graph: KnowledgeGraph | null;
  notifications: AdvancedNotification[];
  loading: boolean;
  onRefresh: () => void;
  onRebuildGraph: () => void;
  onSearchQueryChange: (value: string) => void;
  onKnowledgeDocumentFilterChange: (documentId: string) => void;
}

export function PersonalAdvanced({
  documents,
  chunks,
  chatMessages,
  overview,
  graph,
  selectedGraphDocumentIds,
  notifications,
  loading,
  error,
  notice,
  profile,
  onNavigate,
  onRefresh,
  onRebuildGraph,
  onSearchQueryChange,
  onKnowledgeDocumentFilterChange,
  onSelectedGraphDocumentIdsChange,
  onSearchGraphNodes,
  onLoadGraphNodeDetail,
  onLoadGraphNeighbors,
}: PersonalAdvancedProps) {
  const operations = buildRecentOperations(documents, chatMessages, profile).slice(0, 8);
  const analysis = buildAssetAnalysis(documents, chunks, chatMessages);
  const activityRows: ActivityRow[] = [
    ...notifications.slice(0, 6).map((item) => ({
      id: `notification-${item.id}`,
      kind: 'notification' as const,
      action: item.action,
      title: item.title,
      description: item.message,
      timeLabel: formatDate(item.created_at),
      status: item.level === 'error' ? 'failed' : 'ready',
    })),
    ...operations.slice(0, 6).map((item) => ({
      id: `operation-${item.id}`,
      kind: 'operation' as const,
      action: item.type,
      title: item.title,
      description: item.description,
      timeLabel: item.timeLabel,
      status: item.status,
    })),
  ].slice(0, 10);

  return (
    <section className="personal-workbench-v2 personal-page-advanced">
      <PageHeader
        eyebrow="个人工作区"
        title="高级驾驶舱"
        description="集中查看个人知识资产、真实知识图谱、问答动态和运行状态。"
        actions={<Button icon={RefreshCw} loading={loading} onClick={onRefresh}>刷新驾驶舱</Button>}
      />
      <PersonalIsolationNotice />
      <Feedback error={error} notice={notice} />
      {error && !overview && !graph ? <ErrorState title="高级驾驶舱加载失败" description={error} onRetry={onRefresh} /> : null}

      <MetricStrip metrics={[
        { label: '文档数量', value: String(overview?.document_count ?? profile.documentCount) },
        { label: '知识片段', value: String(overview?.chunk_count ?? profile.chunkCount) },
        { label: '问答次数', value: String(profile.chatQuestionCount) },
        { label: '最近操作', value: String(operations.length) },
        { label: '知识库状态', value: profile.knowledgeStatusText },
      ]} />

      <section className="personal-graph-surface">
        <SectionHeader
          title="个人知识图谱"
          description="节点和关系来自当前所选文件知识库，不读取企业工作区数据。"
          action={<Button size="sm" icon={Route} loading={loading} onClick={onRebuildGraph}>重建图谱</Button>}
        />
        <KnowledgeGraphExplorer
          graph={graph}
          loading={loading}
          documents={documents}
          selectedDocumentIds={selectedGraphDocumentIds}
          workspaceLabel="个人工作区"
          onOpenDocument={(documentId) => {
            onKnowledgeDocumentFilterChange(documentId);
            onNavigate('documents');
          }}
          onSearchKnowledge={(keyword) => {
            onSearchQueryChange(keyword);
            onNavigate('knowledge');
          }}
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
          <SectionHeader title="最近状态与操作记录" description="通知与个人操作合并展示" />
          {activityRows.length === 0 ? (
            <EmptyState compact title="暂无最近状态和操作记录" />
          ) : (
            <DataTable<ActivityRow>
              rows={activityRows}
              rowKey={(item) => item.id}
              emptyText="暂无最近状态和操作记录"
              columns={[
                {
                  key: 'type', label: '类型', width: '120px', render: (item) => item.kind === 'notification'
                    ? <NotificationBadge action={item.action} />
                    : <StatusBadge status={item.status} label={item.action} />,
                },
                { key: 'title', label: '标题', width: '180px', render: (item) => item.title },
                { key: 'description', label: '描述', render: (item) => item.description },
                { key: 'time', label: '时间', width: '170px', render: (item) => item.timeLabel },
                { key: 'status', label: '状态', width: '90px', render: (item) => <StatusBadge status={item.status} /> },
              ]}
            />
          )}
        </section>

        <section className="personal-section">
          <SectionHeader title="知识资产分析" description="使用当前个人文档和知识片段实时推导" />
          <div className="personal-analysis-grid">
            <AnalysisBlock title="文档类型分布" items={analysis.fileTypes} />
            <AnalysisBlock title="知识片段来源" items={analysis.chunkSources} />
            <AnalysisBlock title="高频关键词" items={analysis.keywords} />
            <AnalysisBlock title="最近活跃趋势" items={analysis.trends} />
          </div>
          <Button size="sm" variant="ghost" icon={BarChart3} onClick={() => onNavigate('knowledge')}>查看知识资产</Button>
        </section>
      </div>
    </section>
  );
}
