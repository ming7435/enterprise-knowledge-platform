import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Database,
  FileText,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';

import { getDisplayName } from '../../display';
import type { DocumentRecord } from '../../types';
import { Button } from '../ui/Button';
import { DataTable } from '../ui/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../ui/AsyncState';
import { ConfirmDialog } from '../ui/Overlay';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge } from '../ui/StatusBadge';
import {
  buildRecentOperations,
  buildReminders,
  Feedback,
  formatDate,
  getQuestionTurns,
  homeMetrics,
  MetricStrip,
  PersonalIsolationNotice,
  SectionHeader,
} from './shared';
import type { PersonalSharedProps } from './types';

export interface PersonalHomeProps extends PersonalSharedProps {
  loading: boolean;
  onKnowledgeDocumentFilterChange: (documentId: string) => void;
  onRefresh: () => void;
}

export function PersonalHome({
  user,
  documents,
  chatMessages,
  profile,
  error,
  notice,
  loading,
  onNavigate,
  onPrepareQuestion,
  onKnowledgeDocumentFilterChange,
  onRefresh,
}: PersonalHomeProps) {
  const [hiddenOperationIds, setHiddenOperationIds] = useState<string[]>([]);
  const [pendingOperationId, setPendingOperationId] = useState<string | null>(null);
  const recentDocuments = documents.slice(0, 5);
  const recentQuestions = getQuestionTurns(chatMessages).slice(0, 5);
  const reminders = buildReminders(profile);
  const operations = useMemo(
    () => buildRecentOperations(documents, chatMessages, profile)
      .filter((operation) => !hiddenOperationIds.includes(operation.id))
      .slice(0, 6),
    [chatMessages, documents, hiddenOperationIds, profile]
  );

  return (
    <section className="personal-workbench-v2 personal-page-home">
      <PageHeader
        eyebrow="个人工作区"
        title={`${getDisplayName(user)} 的个人知识工作台`}
        description="统一管理个人文档、知识库、模型问答与知识资产。"
        actions={<Button icon={RefreshCw} loading={loading} onClick={onRefresh}>刷新数据</Button>}
      />
      <PersonalIsolationNotice />
      <Feedback error={error} notice={notice} />
      {error && documents.length === 0 ? (
        <ErrorState title="个人工作台加载失败" description={error} onRetry={onRefresh} />
      ) : null}
      {loading && documents.length === 0 && chatMessages.length === 0 ? (
        <LoadingState label="正在加载个人知识工作台" />
      ) : null}

      <MetricStrip metrics={homeMetrics(profile)} />

      <section className="personal-primary-entry">
        <div>
          <span className="personal-entry-icon"><Bot size={22} aria-hidden="true" /></span>
          <div>
            <strong>开始一次知识工作</strong>
            <p>默认可直接与大模型对话，需要引用个人文档时再开启知识库。</p>
          </div>
        </div>
        <Button variant="primary" icon={Bot} onClick={() => onNavigate('chat')}>开始问答</Button>
      </section>

      <div className="personal-quick-actions" aria-label="快捷操作">
        <Button icon={Upload} onClick={() => onNavigate('documents')}>上传文档</Button>
        <Button icon={Database} onClick={() => onNavigate('knowledge')}>查看知识库</Button>
        <Button icon={Bot} onClick={() => onNavigate('chat')}>智能问答</Button>
        <Button icon={BarChart3} onClick={() => onNavigate('advanced')}>高级驾驶舱</Button>
      </div>

      <div className="personal-home-grid">
        <section className="personal-section personal-home-documents">
          <SectionHeader title="最近文档" description="最近上传和处理的个人文档" />
          <DataTable<DocumentRecord>
            rows={recentDocuments}
            rowKey={(document) => document.id}
            emptyText="你还没有上传文档"
            columns={[
              {
                key: 'name',
                label: '文档',
                render: (document) => (
                  <button
                    type="button"
                    className="personal-file-link"
                    onClick={() => {
                      onKnowledgeDocumentFilterChange(document.id);
                      onNavigate('knowledge');
                    }}
                  >
                    <FileText size={16} aria-hidden="true" />
                    <span title={document.filename}>{document.filename}</span>
                  </button>
                ),
              },
              { key: 'parse', label: '解析', width: '92px', render: (document) => <StatusBadge status={document.parse_status} /> },
              { key: 'index', label: '入库', width: '92px', render: (document) => <StatusBadge status={document.index_status} /> },
              { key: 'chunks', label: '片段', width: '72px', render: (document) => document.chunk_count ?? 0 },
              { key: 'time', label: '上传时间', width: '170px', render: (document) => formatDate(document.created_at) },
              {
                key: 'action',
                label: '操作',
                width: '160px',
                render: (document) => (
                  <div className="personal-row-actions">
                    <Button size="sm" variant="ghost" onClick={() => onNavigate('documents')}>查看</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onPrepareQuestion(`请基于《${document.filename}》回答我的问题：`, [document.id])}
                    >
                      去问答
                    </Button>
                  </div>
                ),
              },
            ]}
          />
          {recentDocuments.length === 0 ? (
            <div className="personal-empty-action">
              <p>上传第一个文档后，可以构建个人知识库并进行智能问答。</p>
              <Button size="sm" variant="primary" icon={Upload} onClick={() => onNavigate('documents')}>上传文档</Button>
            </div>
          ) : null}
        </section>

        <section className="personal-section">
          <SectionHeader title="最近问答" description="当前会话中的问题记录" />
          {recentQuestions.length === 0 ? (
            <EmptyState
              compact
              title="暂无问答记录"
              description="可直接开始普通大模型对话。"
              action={{ label: '开始问答', onClick: () => onNavigate('chat'), icon: Bot }}
            />
          ) : (
            <div className="personal-activity-list">
              {recentQuestions.map((item) => (
                <article key={item.id}>
                  <div><strong>{item.question}</strong><span>{item.timeLabel}</span></div>
                  <Button size="sm" variant="ghost" onClick={() => onPrepareQuestion(item.question)}>继续问答</Button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="personal-section">
          <SectionHeader title="最近操作" description="由个人文档、知识库和问答数据推导" />
          {operations.length === 0 ? (
            <EmptyState compact title="暂无最近操作" />
          ) : (
            <div className="personal-operation-list">
              {operations.map((operation) => (
                <article key={operation.id}>
                  <StatusBadge status={operation.status} />
                  <div>
                    <strong>{operation.title}</strong>
                    <span>{operation.description}</span>
                    <small>{operation.timeLabel}</small>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    aria-label={`删除最近操作：${operation.title}`}
                    onClick={() => setPendingOperationId(operation.id)}
                  >
                    删除
                  </Button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="personal-section">
          <SectionHeader title="待处理提醒" description="根据当前个人知识库状态生成" />
          {reminders.length === 0 ? (
            <EmptyState compact title="当前没有待处理提醒" />
          ) : (
            <div className="personal-reminder-list">
              {reminders.map((reminder) => (
                <article key={reminder.title}>
                  <AlertTriangle size={17} aria-hidden="true" />
                  <div><strong>{reminder.title}</strong><span>{reminder.description}</span></div>
                  <Button size="sm" variant="ghost" onClick={() => onNavigate(reminder.target)}>{reminder.action}</Button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(pendingOperationId)}
        title="删除最近操作"
        description="这只会隐藏当前页面推导出的操作记录，不会删除文档、知识片段或问答数据。"
        confirmLabel="删除记录"
        danger
        onClose={() => setPendingOperationId(null)}
        onConfirm={() => {
          if (pendingOperationId) setHiddenOperationIds((ids) => [...ids, pendingOperationId]);
          setPendingOperationId(null);
        }}
      />
    </section>
  );
}
