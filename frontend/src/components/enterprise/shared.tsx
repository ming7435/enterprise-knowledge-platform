import { ShieldCheck } from 'lucide-react';

import { getActorName, getDisplayName, getMemberDisplayName } from '../../display';
import { dateValue, formatBeijingDateTime } from '../../time';
import type {
  AdvancedNotification,
  AuditLogRecord,
  DocumentRecord,
  KnowledgeBaseStatus,
  KnowledgeChunk,
  User,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from '../../types';
import { StatusBadge } from '../ui/StatusBadge';
import type { EnterpriseChatMessage, EnterpriseProfile } from './types';

export {
  AnalysisBlock,
  ChunkDetailModal,
  copyText,
  DefinitionList,
  EmptyInline,
  Feedback,
  MetricStrip,
  SectionHeader,
  statusText,
  summarize,
} from '../personal/shared';

export function EnterpriseIsolationNotice() {
  return (
    <div className="personal-isolation-notice" role="note">
      <ShieldCheck size={17} aria-hidden="true" />
      <span>当前空间：企业工作区，数据仅当前企业成员在权限范围内可见，不与个人工作区同步。</span>
    </div>
  );
}

export function buildEnterpriseProfile(
  workspace: Workspace,
  documents: DocumentRecord[],
  knowledgeBase: KnowledgeBaseStatus | null,
  chunks: KnowledgeChunk[],
  members: WorkspaceMember[],
  auditLogs: AuditLogRecord[],
  chatMessages: EnterpriseChatMessage[],
  notifications: AdvancedNotification[],
  canManageMembers: boolean
): EnterpriseProfile {
  const role = (workspace.role || 'member') as WorkspaceRole;
  const parsedCount = documents.filter((item) => item.parse_status === 'parsed').length;
  const indexedCount = documents.filter((item) => item.index_status === 'indexed').length;
  const failedCount = documents.filter(
    (item) => item.parse_status === 'failed' || item.index_status === 'failed'
  ).length;
  const chunkCount = knowledgeBase?.chunk_count ?? chunks.length;
  const knowledgeStatus = resolveKnowledgeStatus(knowledgeBase, documents, chunkCount);
  const latestUpdatedAt = latestDate([
    ...documents.map((item) => item.created_at),
    ...auditLogs.map((item) => item.created_at),
    ...notifications.map((item) => item.created_at),
    ...chatMessages.map((item) => item.createdAt || ''),
  ]);

  return {
    role,
    documentCount: knowledgeBase?.document_count ?? documents.length,
    parsedCount,
    indexedCount,
    failedCount,
    pendingParseCount: documents.filter((item) => item.parse_status !== 'parsed').length,
    pendingIndexCount: documents.filter((item) => item.index_status !== 'indexed').length,
    chunkCount,
    memberCount: members.length,
    auditCount: auditLogs.length,
    qaCount: chatMessages.filter((item) => item.role === 'user').length,
    latestUpdatedAt,
    knowledgeStatus,
    knowledgeStatusText: knowledgeStatusLabel(knowledgeStatus),
    knowledgeReady: chunkCount > 0 && knowledgeStatus !== 'empty',
    canUpload: role !== 'viewer',
    canManageDocs: role !== 'viewer',
    canManageMembers,
    canManageSettings: role === 'owner' || role === 'admin',
  };
}

export function enterpriseMetrics(profile: EnterpriseProfile, memberCount?: number) {
  return [
    { label: '企业文档', value: String(profile.documentCount) },
    { label: '知识片段', value: String(profile.chunkCount) },
    { label: '知识库状态', value: profile.knowledgeStatusText },
    { label: '企业成员', value: String(memberCount ?? profile.memberCount) },
    { label: '问答次数', value: String(profile.qaCount), hint: '当前会话' },
    { label: '最近更新', value: profile.latestUpdatedAt ? formatDate(profile.latestUpdatedAt) : '未开始' },
  ];
}

export function enterpriseDocumentMetrics(profile: EnterpriseProfile) {
  return [
    { label: '文档总数', value: String(profile.documentCount) },
    { label: '已解析', value: String(profile.parsedCount) },
    { label: '已入库', value: String(profile.indexedCount) },
    { label: '知识片段', value: String(profile.chunkCount) },
    { label: '失败', value: String(profile.failedCount), tone: profile.failedCount ? 'danger' as const : 'normal' as const },
  ];
}

export function enterpriseKnowledgeMetrics(profile: EnterpriseProfile) {
  return [
    { label: '知识库状态', value: profile.knowledgeStatusText },
    { label: '文件知识库', value: String(profile.documentCount) },
    { label: '知识片段', value: String(profile.chunkCount) },
    { label: '已入库文档', value: String(profile.indexedCount) },
    { label: 'RAG 状态', value: profile.knowledgeReady ? '可用于问答' : '暂不可用' },
  ];
}

export function enterpriseUploaderName(
  document: DocumentRecord | undefined,
  user: User,
  members: WorkspaceMember[]
) {
  if (!document) return getDisplayName(user);
  const member = members.find((item) => item.user_id === document.user_id);
  if (member) return getMemberDisplayName(member);
  return document.user_id === user.id ? getDisplayName(user) : '未知上传人';
}

export function getEnterpriseQuestionTurns(messages: EnterpriseChatMessage[]) {
  return messages
    .filter((item) => item.role === 'user')
    .map((item, index) => ({
      id: item.id,
      question: item.content,
      timeLabel: item.createdAt ? formatDate(item.createdAt) : `第 ${index + 1} 轮`,
    }))
    .reverse();
}

export function buildEnterpriseActivity(
  documents: DocumentRecord[],
  auditLogs: AuditLogRecord[],
  chatMessages: EnterpriseChatMessage[],
  notifications: AdvancedNotification[],
  user: User,
  members: WorkspaceMember[]
) {
  const audits = auditLogs.map((item) => ({
    id: `audit-${item.id}`,
    type: auditActionLabel(item.action),
    title: auditActionLabel(item.action),
    description: auditDetail(item.detail),
    actor: getActorName(item.user_id, members, user),
    createdAt: item.created_at,
    status: auditStatus(item),
  }));
  const docs = documents.map((item) => ({
    id: `document-${item.id}`,
    type: '文档已上传',
    title: item.filename,
    description: `${item.chunk_count ?? 0} 个片段 · ${item.processing_stage || '等待处理'}`,
    actor: enterpriseUploaderName(item, user, members),
    createdAt: item.created_at,
    status: item.parse_status === 'failed' || item.index_status === 'failed' ? 'failed' : 'ready',
  }));
  const chats = chatMessages.filter((item) => item.role === 'user').map((item) => ({
    id: `chat-${item.id}`,
    type: '企业问答',
    title: item.content,
    description: item.useKnowledgeBase ? 'RAG 知识库问答' : '普通模型对话',
    actor: getDisplayName(user),
    createdAt: item.createdAt || '',
    status: 'ready',
  }));
  const notices = notifications.map((item) => ({
    id: `notice-${item.id}`,
    type: notificationLabel(item.action),
    title: item.title,
    description: item.message,
    actor: '系统',
    createdAt: item.created_at,
    status: item.level === 'error' ? 'failed' : 'ready',
  }));
  return [...audits, ...docs, ...chats, ...notices]
    .filter((item) => item.createdAt)
    .sort((left, right) => dateValue(right.createdAt) - dateValue(left.createdAt));
}

export function buildEnterpriseReminders(profile: EnterpriseProfile) {
  const items: Array<{ title: string; description: string; action: string; page: 'documents' | 'knowledge' | 'chat' }> = [];
  if (profile.pendingParseCount) items.push({
    title: '有文档未解析', description: `${profile.pendingParseCount} 个企业文档尚未完成解析。`, action: '去文档管理', page: 'documents',
  });
  if (profile.pendingIndexCount) items.push({
    title: '有文档未入库', description: `${profile.pendingIndexCount} 个企业文档尚未完成入库。`, action: '去知识库', page: 'knowledge',
  });
  if (!profile.knowledgeReady) items.push({
    title: '企业知识库暂无可检索内容', description: '先上传并解析企业文档，或使用普通模型对话。', action: '去文档管理', page: 'documents',
  });
  if (!profile.qaCount) items.push({
    title: '还没有企业问答记录', description: '可先发起普通模型对话，或开启 RAG。', action: '去问答', page: 'chat',
  });
  return items;
}

export function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    'workspace.created': '创建工作区',
    'workspace.deleted': '删除工作区',
    'workspace.setting_updated': '更新企业设置',
    'workspace.model_api_tested': '测试模型 API',
    'member.added': '添加成员',
    'member.updated': '更新成员',
    'member.role_updated': '修改成员角色',
    'member.removed': '移除成员',
    'document.created': '创建文档记录',
    'document.uploaded': '上传文档',
    'document.asset_saved': '保存文件资产',
    'document.parsed': '解析文档',
    'document.deleted': '删除文档',
    'knowledge.searched': '检索知识片段',
    'rag.asked': '企业问答',
    'chat.asked': '企业问答',
    'system.error': '错误提醒',
  };
  return labels[action] ?? action;
}

export function auditStatus(log: AuditLogRecord) {
  const text = `${log.action} ${JSON.stringify(log.detail || {})}`.toLowerCase();
  return text.includes('fail') || text.includes('error') || text.includes('失败') ? 'failed' : 'ready';
}

export function auditDetail(detail: Record<string, unknown>) {
  if (!detail || Object.keys(detail).length === 0) return '无详情';
  return Object.entries(detail)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}

export function roleLabel(role?: string | null) {
  const labels: Record<string, string> = {
    owner: '所有者', admin: '管理员', member: '成员', viewer: '只读',
  };
  return labels[role || 'member'] ?? role ?? '成员';
}

export function formatDate(value?: string | null) {
  return formatBeijingDateTime(value);
}

export function notificationLabel(action: string) {
  if (action.includes('upload')) return '文档已上传';
  if (action.includes('parsed')) return '文档解析完成';
  if (action.includes('index') || action.includes('knowledge')) return '知识库已更新';
  if (action.includes('member')) return '成员变更';
  if (action.includes('chat') || action.includes('rag')) return '问答已完成';
  if (action.includes('error')) return '错误提醒';
  return '系统提醒';
}

export function EnterpriseActivityBadge({ status, label }: { status: string; label: string }) {
  return <StatusBadge status={status} label={label} />;
}

export function buildEnterpriseAnalysis(
  documents: DocumentRecord[],
  chunks: KnowledgeChunk[],
  members: WorkspaceMember[],
  chatMessages: EnterpriseChatMessage[]
) {
  return {
    fileTypes: countPairs(documents.map((item) => item.file_type || '未知')),
    chunkSources: countPairs(chunks.map((item) => item.filename || '未知来源')).slice(0, 6),
    contributors: members.slice(0, 6).map((item) => [getMemberDisplayName(item), item.department || roleLabel(item.role)] as [string, string]),
    activity: [
      ['文档', `${documents.length} 个`],
      ['片段', `${chunks.length} 条`],
      ['问答', `${chatMessages.filter((item) => item.role === 'user').length} 次`],
    ] as Array<[string, string]>,
  };
}

function resolveKnowledgeStatus(
  knowledgeBase: KnowledgeBaseStatus | null,
  documents: DocumentRecord[],
  chunkCount: number
) {
  if (!documents.length || !chunkCount) return 'empty';
  if (documents.some((item) => ['queued', 'parsing'].includes(item.parse_status))) return 'building';
  if (documents.some((item) => item.index_status !== 'indexed')) return 'needs_update';
  return knowledgeBase?.status || 'ready';
}

function knowledgeStatusLabel(status: string) {
  if (status === 'empty') return '暂无数据';
  if (status === 'building') return '构建中';
  if (status === 'needs_update') return '需要更新';
  return '可检索';
}

function latestDate(values: string[]) {
  return values
    .filter(Boolean)
    .sort((left, right) => dateValue(right) - dateValue(left))[0] ?? null;
}

function countPairs(values: string[]) {
  const counts = values.reduce<Record<string, number>>((result, value) => {
    const key = value || '暂无';
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
  const pairs = Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .map(([label, count]) => [label, String(count)] as [string, string]);
  return pairs.length ? pairs : [['暂无', '0'] as [string, string]];
}
