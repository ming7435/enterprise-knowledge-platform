import { AlertTriangle, BarChart3, Bot, Database, FileText, RefreshCw, ShieldCheck, Upload, Users } from 'lucide-react';

import { getDisplayName } from '../../display';
import type { AdvancedOverview, DocumentRecord } from '../../types';
import { Button } from '../ui/Button';
import { DataTable } from '../ui/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../ui/AsyncState';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge } from '../ui/StatusBadge';
import {
  buildEnterpriseActivity,
  buildEnterpriseReminders,
  EnterpriseActivityBadge,
  EnterpriseIsolationNotice,
  enterpriseMetrics,
  enterpriseUploaderName,
  Feedback,
  formatDate,
  getEnterpriseQuestionTurns,
  MetricStrip,
  roleLabel,
  SectionHeader,
} from './shared';
import type { EnterpriseSharedProps } from './types';

export interface EnterpriseHomeProps extends EnterpriseSharedProps {
  overview: AdvancedOverview | null;
  onRefresh: () => void;
  onKnowledgeDocumentFilterChange: (documentId: string) => void;
}

export function EnterpriseHome({
  user,
  workspace,
  documents,
  members,
  auditLogs,
  chatMessages,
  notifications,
  profile,
  overview,
  loading,
  error,
  notice,
  onNavigate,
  onPrepareQuestion,
  onRefresh,
  onKnowledgeDocumentFilterChange,
}: EnterpriseHomeProps) {
  const questions = getEnterpriseQuestionTurns(chatMessages).slice(0, 5);
  const activities = buildEnterpriseActivity(
    documents,
    auditLogs,
    chatMessages,
    notifications,
    user,
    members
  ).slice(0, 6);
  const reminders = buildEnterpriseReminders(profile);

  return (
    <section className="personal-workbench-v2 enterprise-workbench-v2 personal-page-home">
      <PageHeader
        eyebrow="企业工作区"
        title={`${workspace.name} 知识工作台`}
        description={`当前用户：${getDisplayName(user)} · ${roleLabel(profile.role)}。集中管理企业知识资产与协作记录。`}
        actions={<Button icon={RefreshCw} loading={loading} onClick={onRefresh}>刷新数据</Button>}
      />
      <EnterpriseIsolationNotice />
      <Feedback error={error} notice={notice} />
      {error && documents.length === 0 ? <ErrorState title="企业工作台加载失败" description={error} onRetry={onRefresh} /> : null}
      {loading && documents.length === 0 ? <LoadingState label="正在加载企业知识工作台" /> : null}

      <MetricStrip metrics={enterpriseMetrics(profile, overview?.member_count)} />

      <section className="personal-primary-entry">
        <div>
          <span className="personal-entry-icon"><Bot size={22} aria-hidden="true" /></span>
          <div>
            <strong>开始企业知识问答</strong>
            <p>默认可进行普通模型对话；开启知识库后，回答和引用只使用当前企业工作区。</p>
          </div>
        </div>
        <Button variant="primary" icon={Bot} onClick={() => onNavigate('chat')}>开始问答</Button>
      </section>

      <div className="personal-quick-actions" aria-label="企业快捷操作">
        <Button icon={Upload} disabled={!profile.canUpload} title={!profile.canUpload ? '只读角色不能上传文档' : undefined} onClick={() => onNavigate('documents')}>上传文档</Button>
        <Button icon={Database} onClick={() => onNavigate('knowledge')}>查看知识库</Button>
        <Button icon={Bot} onClick={() => onNavigate('chat')}>智能问答</Button>
        {profile.canManageMembers ? <Button icon={Users} onClick={() => onNavigate('members')}>成员与权限</Button> : null}
        {profile.canManageMembers ? <Button icon={ShieldCheck} onClick={() => onNavigate('audit')}>审计日志</Button> : null}
        <Button icon={BarChart3} onClick={() => onNavigate('advanced')}>高级驾驶舱</Button>
      </div>

      <div className="personal-home-grid">
        <section className="personal-section personal-home-documents">
          <SectionHeader title="最近企业文档" description="最近上传和处理的企业知识资产" />
          <DataTable<DocumentRecord>
            rows={documents.slice(0, 5)}
            rowKey={(item) => item.id}
            emptyText="当前企业工作区还没有文档"
            columns={[
              {
                key: 'name', label: '文档', render: (item) => (
                  <button className="personal-file-link" type="button" onClick={() => {
                    onKnowledgeDocumentFilterChange(item.id);
                    onNavigate('knowledge');
                  }}>
                    <FileText size={16} aria-hidden="true" /><span title={item.filename}>{item.filename}</span>
                  </button>
                ),
              },
              { key: 'uploader', label: '上传人', width: '110px', render: (item) => enterpriseUploaderName(item, user, members) },
              { key: 'parse', label: '解析', width: '90px', render: (item) => <StatusBadge status={item.parse_status} /> },
              { key: 'index', label: '入库', width: '90px', render: (item) => <StatusBadge status={item.index_status} /> },
              { key: 'chunks', label: '片段', width: '70px', render: (item) => item.chunk_count ?? 0 },
              { key: 'time', label: '上传时间', width: '170px', render: (item) => formatDate(item.created_at) },
              {
                key: 'action', label: '操作', width: '150px', render: (item) => (
                  <div className="personal-row-actions">
                    <Button size="sm" variant="ghost" onClick={() => onNavigate('documents')}>查看</Button>
                    <Button size="sm" variant="ghost" onClick={() => onPrepareQuestion(`请基于《${item.filename}》回答：`, [item.id])}>问答</Button>
                  </div>
                ),
              },
            ]}
          />
          {!documents.length ? (
            <div className="personal-empty-action">
              <p>上传企业文档后即可构建独立知识库。</p>
              <Button size="sm" variant="primary" icon={Upload} disabled={!profile.canUpload} onClick={() => onNavigate('documents')}>上传文档</Button>
            </div>
          ) : null}
        </section>

        <section className="personal-section">
          <SectionHeader title="最近问答" description="当前企业会话中的问题记录" />
          {questions.length ? (
            <div className="personal-activity-list">
              {questions.map((item) => (
                <article key={item.id}>
                  <div><strong>{item.question}</strong><span>{item.timeLabel}</span></div>
                  <Button size="sm" variant="ghost" onClick={() => onPrepareQuestion(item.question)}>继续问答</Button>
                </article>
              ))}
            </div>
          ) : <EmptyState compact title="暂无问答记录" action={{ label: '开始问答', onClick: () => onNavigate('chat'), icon: Bot }} />}
        </section>

        <section className="personal-section">
          <SectionHeader title="最近动态" description={profile.canManageMembers ? '企业审计、文档、问答与系统通知合并展示' : '文档、问答与系统通知合并展示'} />
          {activities.length ? (
            <div className="personal-operation-list">
              {activities.map((item) => (
                <article key={item.id}>
                  <EnterpriseActivityBadge status={item.status} label={item.type} />
                  <div><strong>{item.title}</strong><span>{item.description}</span><small>{item.actor} · {formatDate(item.createdAt)}</small></div>
                </article>
              ))}
            </div>
          ) : <EmptyState compact title="暂无最近动态" />}
          {profile.canManageMembers ? <Button size="sm" variant="ghost" onClick={() => onNavigate('audit')}>查看全部审计日志</Button> : null}
        </section>

        <section className="personal-section">
          <SectionHeader title="待处理提醒" description="根据当前企业知识库状态生成" />
          {reminders.length ? (
            <div className="personal-reminder-list">
              {reminders.map((item) => (
                <article key={item.title}>
                  <AlertTriangle size={17} aria-hidden="true" />
                  <div><strong>{item.title}</strong><span>{item.description}</span></div>
                  <Button size="sm" variant="ghost" onClick={() => onNavigate(item.page)}>{item.action}</Button>
                </article>
              ))}
            </div>
          ) : <EmptyState compact title="当前没有待处理提醒" />}
        </section>
      </div>
    </section>
  );
}
