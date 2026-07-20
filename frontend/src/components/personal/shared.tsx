import type { ReactNode } from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';

import { getDisplayName } from '../../display';
import { formatBeijingDateTime } from '../../time';
import type {
  AdvancedNotification,
  DocumentRecord,
  KnowledgeBaseStatus,
  KnowledgeChunk,
  User,
} from '../../types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Overlay';
import { StatusBadge } from '../ui/StatusBadge';
import type {
  PersonalChatMessage,
  PersonalMetric,
  PersonalPageKey,
  PersonalProfile,
} from './types';

export function PersonalIsolationNotice() {
  return (
    <div className="personal-isolation-notice" role="note">
      <ShieldCheck size={17} aria-hidden="true" />
      <span>当前空间：个人工作区，数据仅个人可见，不与企业工作区同步。</span>
    </div>
  );
}

export function Feedback({ error, notice }: { error: string | null; notice: string | null }) {
  if (!error && !notice) return null;
  return (
    <div className="personal-feedback" aria-live="polite">
      {error ? <p className="personal-feedback-error" role="alert">{error}</p> : null}
      {notice ? <p className="personal-feedback-success">{notice}</p> : null}
    </div>
  );
}

export function MetricStrip({ metrics }: { metrics: PersonalMetric[] }) {
  return (
    <div className="personal-stat-strip">
      {metrics.map((metric) => (
        <div className={`personal-stat-item ${metric.tone ?? 'normal'}`} key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          {metric.hint ? <small>{metric.hint}</small> : null}
        </div>
      ))}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="personal-section-header">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="personal-section-action">{action}</div> : null}
    </div>
  );
}

export function DefinitionList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="personal-definition-list">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ChunkDetailModal({
  chunk,
  open,
  onClose,
  onAsk,
  onCopy,
}: {
  chunk: KnowledgeChunk | null;
  open: boolean;
  onClose: () => void;
  onAsk: (chunk: KnowledgeChunk) => void;
  onCopy: (chunk: KnowledgeChunk) => void | Promise<void>;
}) {
  if (!chunk) return null;
  const keywords = extractKeywords(chunk.content);
  return (
    <Modal
      open={open}
      title="知识片段详情"
      description={`${chunk.filename} · 片段 #${chunk.chunk_index + 1}`}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button onClick={() => void onCopy(chunk)}>复制内容</Button>
          <Button variant="primary" onClick={() => onAsk(chunk)}>基于此片段提问</Button>
        </>
      }
    >
      <DefinitionList
        items={[
          ['来源文档', chunk.filename],
          ['片段编号', `#${chunk.chunk_index + 1}`],
          ['相关关键词', keywords.length ? keywords.join('、') : '暂无'],
          ['所属空间', '个人工作区'],
        ]}
      />
      <div className="personal-full-content">{chunk.content}</div>
    </Modal>
  );
}

export function EmptyInline({ children }: { children: ReactNode }) {
  return (
    <div className="personal-inline-empty">
      <Sparkles size={18} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function buildPersonalProfile(
  documents: DocumentRecord[],
  knowledgeBase: KnowledgeBaseStatus | null,
  chunks: KnowledgeChunk[],
  chatMessages: PersonalChatMessage[],
  notifications: AdvancedNotification[]
): PersonalProfile {
  const documentCount = knowledgeBase?.document_count ?? documents.length;
  const chunkCount = knowledgeBase?.chunk_count ?? chunks.length;
  const parsedDocumentCount = documents.filter((item) => item.parse_status === 'parsed').length;
  const indexedDocumentCount = documents.filter((item) => item.index_status === 'indexed').length;
  const failedDocumentCount = documents.filter(
    (item) => item.parse_status === 'failed' || item.index_status === 'failed'
  ).length;
  const pendingParseCount = documents.filter((item) => item.parse_status !== 'parsed').length;
  const pendingIndexCount = documents.filter((item) => item.index_status !== 'indexed').length;
  const chatQuestionCount = chatMessages.filter((item) => item.role === 'user').length;
  const latestActivityAt = notifications[0]?.created_at ?? documents[0]?.created_at ?? null;
  const knowledgeStatus = resolveKnowledgeStatus(knowledgeBase, documents, chunkCount);

  return {
    documentCount,
    parsedDocumentCount,
    indexedDocumentCount,
    failedDocumentCount,
    pendingParseCount,
    pendingIndexCount,
    chunkCount,
    chatQuestionCount,
    knowledgeStatus,
    knowledgeStatusText: statusText(knowledgeStatus),
    knowledgeReady: chunkCount > 0 && knowledgeStatus !== 'empty',
    latestActivityText: latestActivityAt ? formatDate(latestActivityAt) : '未开始',
    latestActivityAt,
    vectorType: 'Milvus',
    rerankStatus: 'ready',
  };
}

export function homeMetrics(profile: PersonalProfile): PersonalMetric[] {
  return [
    { label: '文档数量', value: String(profile.documentCount) },
    { label: '知识片段', value: String(profile.chunkCount) },
    { label: '知识库状态', value: profile.knowledgeStatusText },
    { label: '问答次数', value: String(profile.chatQuestionCount), hint: '当前会话' },
    { label: '最近更新', value: profile.latestActivityText },
  ];
}

export function documentMetrics(profile: PersonalProfile): PersonalMetric[] {
  return [
    { label: '文档总数', value: String(profile.documentCount) },
    { label: '已解析', value: String(profile.parsedDocumentCount) },
    { label: '已入库', value: String(profile.indexedDocumentCount) },
    { label: '知识片段', value: String(profile.chunkCount) },
    {
      label: '失败',
      value: String(profile.failedDocumentCount),
      tone: profile.failedDocumentCount ? 'danger' : 'normal',
    },
  ];
}

export function knowledgeMetrics(profile: PersonalProfile): PersonalMetric[] {
  return [
    { label: '知识库状态', value: profile.knowledgeStatusText },
    { label: '文件知识库', value: String(profile.documentCount) },
    { label: '知识片段', value: String(profile.chunkCount) },
    { label: '最近更新', value: profile.latestActivityText },
    { label: 'RAG 状态', value: profile.knowledgeReady ? '可用于问答' : '暂不可用' },
  ];
}

export function getQuestionTurns(messages: PersonalChatMessage[]) {
  return messages
    .filter((message) => message.role === 'user')
    .map((message, index) => ({
      id: message.id,
      question: message.content,
      timeLabel: `第 ${index + 1} 轮`,
    }))
    .reverse();
}

export function buildRecentOperations(
  documents: DocumentRecord[],
  chatMessages: PersonalChatMessage[],
  profile: PersonalProfile
) {
  const documentOperations = documents.flatMap((document) => [
    {
      id: `upload-${document.id}`,
      type: '上传文档',
      title: '上传文档',
      description: document.filename,
      status: document.parse_status,
      timeLabel: formatDate(document.created_at),
    },
    {
      id: `index-${document.id}`,
      type: '文档入库',
      title: document.index_status === 'indexed' ? '文档已入库' : '文档待入库',
      description: `${document.filename} · ${document.chunk_count ?? 0} 个片段`,
      status: document.index_status,
      timeLabel: formatDate(document.created_at),
    },
  ]);
  const chatOperations = getQuestionTurns(chatMessages).map((item) => ({
    id: `chat-${item.id}`,
    type: '发起问答',
    title: '发起问答',
    description: item.question,
    status: 'ready',
    timeLabel: item.timeLabel,
  }));
  const knowledgeOperation = profile.chunkCount > 0 ? [{
    id: 'knowledge-searchable',
    type: '知识库更新',
    title: '知识库已更新',
    description: `${profile.chunkCount} 个片段可用于检索`,
    status: 'indexed',
    timeLabel: profile.latestActivityText,
  }] : [];
  return [...chatOperations, ...documentOperations, ...knowledgeOperation];
}

export function buildReminders(profile: PersonalProfile) {
  const reminders: Array<{
    title: string;
    description: string;
    action: string;
    target: PersonalPageKey;
  }> = [];
  if (profile.pendingParseCount > 0) reminders.push({
    title: '有文档未解析',
    description: `${profile.pendingParseCount} 个文档还未完成解析。`,
    action: '去文档管理',
    target: 'documents',
  });
  if (profile.pendingIndexCount > 0) reminders.push({
    title: '有文档未入库',
    description: `${profile.pendingIndexCount} 个文档还未完成入库。`,
    action: '去知识库',
    target: 'knowledge',
  });
  if (profile.chunkCount === 0) reminders.push({
    title: '知识库暂无可检索内容',
    description: '请先上传并解析文档。',
    action: '去上传文档',
    target: 'documents',
  });
  if (profile.chatQuestionCount === 0) reminders.push({
    title: '还没有进行过问答',
    description: '可先使用普通大模型对话，或在入库后使用 RAG。',
    action: '去问答',
    target: 'chat',
  });
  if (profile.pendingIndexCount > 0 && profile.chunkCount > 0) reminders.push({
    title: '向量库需要更新',
    description: '部分文档尚未入库，知识库问答结果可能不完整。',
    action: '去知识库',
    target: 'knowledge',
  });
  return reminders;
}

export function buildAssetAnalysis(
  documents: DocumentRecord[],
  chunks: KnowledgeChunk[],
  chatMessages: PersonalChatMessage[]
) {
  const countBy = (values: string[]) => values.reduce<Record<string, number>>((acc, value) => {
    const key = value || '暂无';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const toItems = (record: Record<string, number>) => {
    const entries = Object.entries(record)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([label, count]) => [label, String(count)] as [string, string]);
    return entries.length ? entries : [['暂无', '0'] as [string, string]];
  };
  return {
    fileTypes: toItems(countBy(documents.map((item) => item.file_type || '未知'))),
    chunkSources: toItems(countBy(chunks.map((item) => item.filename))),
    keywords: toItems(countBy(chunks.flatMap((item) => extractKeywords(item.content)).slice(0, 80))),
    trends: [
      ['文档', `${documents.length} 个`],
      ['片段', `${chunks.length} 个`],
      ['问答', `${chatMessages.filter((item) => item.role === 'user').length} 次`],
    ] as Array<[string, string]>,
  };
}

export function AnalysisBlock({ title, items }: { title: string; items: Array<[string, string]> }) {
  return (
    <div className="personal-analysis-block">
      <strong>{title}</strong>
      <div>{items.map(([label, value]) => <span key={`${title}-${label}`}>{label} · {value}</span>)}</div>
    </div>
  );
}

export function statusText(value: string) {
  const map: Record<string, string> = {
    empty: '暂无数据',
    building: '构建中',
    needs_update: '需要更新',
    documents_uploaded: '已上传文档',
    ready: '可检索',
    uploaded: '已上传',
    queued: '排队中',
    pending: '待处理',
    parsing: '解析中',
    parsed: '已解析',
    indexing: '入库中',
    indexed: '已入库',
    unsupported: '暂不支持解析',
    asset_only: '仅保存',
    failed: '失败',
    configured: '已配置',
  };
  return map[value] ?? value;
}

export function formatDate(value?: string | null) {
  return formatBeijingDateTime(value);
}

export function documentUploaderName(document: DocumentRecord | undefined, user: User) {
  if (!document) return getDisplayName(user);
  return document.user_id === user.id ? getDisplayName(user) : '其他用户';
}

export function summarize(content: string, maxLength: number) {
  if (!content) return '暂无内容';
  const cleaned = content.replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}...` : cleaned;
}

export function extractKeywords(content: string) {
  const chinese = Array.from(content.matchAll(/[\u4e00-\u9fa5]{2,6}/g)).map((item) => item[0]);
  const english = Array.from(content.matchAll(/[A-Za-z][A-Za-z0-9_-]{2,24}/g)).map((item) => item[0]);
  return Array.from(new Set([...chinese, ...english])).slice(0, 8);
}

export async function copyText(text: string) {
  if (navigator.clipboard) await navigator.clipboard.writeText(text);
}

export function NotificationBadge({ action }: { action: string }) {
  let label = '系统提醒';
  if (action.includes('uploaded')) label = '文档已上传';
  else if (action.includes('asset')) label = '文件已保存';
  else if (action.includes('deleted')) label = '删除文档';
  else if (action.includes('chat')) label = '问答已完成';
  else if (action.includes('failed')) label = '错误提醒';
  return <StatusBadge status={action.includes('failed') ? 'failed' : 'ready'} label={label} />;
}

function resolveKnowledgeStatus(
  knowledgeBase: KnowledgeBaseStatus | null,
  documents: DocumentRecord[],
  chunkCount: number
) {
  if (!knowledgeBase || chunkCount === 0) return 'empty';
  if (documents.some((item) => item.parse_status === 'parsing' || item.index_status === 'indexing')) {
    return 'building';
  }
  if (documents.some((item) => item.parse_status !== 'parsed' || item.index_status !== 'indexed')) {
    return 'needs_update';
  }
  return knowledgeBase.status || 'ready';
}
