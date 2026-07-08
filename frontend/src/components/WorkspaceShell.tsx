import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Bot,
  Database,
  FileText,
  Home,
  LogOut,
  Network,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Workflow
} from 'lucide-react';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';

import { api } from '../api';
import { getDisplayName, maskEmail, shortId } from '../display';
import { formatBeijingDateTime } from '../time';
import { EnterpriseWorkspacePanel } from './EnterpriseWorkspace';
import { PersonalWorkspacePanel } from './PersonalWorkspace';
import type {
  AdvancedNotification,
  AdvancedOverview,
  AuditLogRecord,
  ChatAskResponse,
  DocumentContent,
  DocumentRecord,
  KnowledgeGraph,
  KnowledgeBaseStatus,
  KnowledgeChunk,
  User,
  Workspace,
  WorkspaceModelConnectionTestResult,
  WorkspaceMember,
  WorkspaceRole,
  WorkspaceSettingRecord
} from '../types';
import type { PersonalPageKey } from './PersonalWorkspace';
import type { EnterprisePageKey } from './EnterpriseWorkspace';

interface ChatMessageView {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: KnowledgeChunk[];
  modelName?: string;
  useKnowledgeBase?: boolean;
  createdAt: string;
}

interface WorkspaceShellProps {
  token: string;
  user: User;
  workspace: Workspace;
  onBackToWorkspaces: () => void;
  onLogout: () => void;
}

type PageKey =
  | 'dashboard'
  | 'documents'
  | 'knowledge'
  | 'chat'
  | 'settings'
  | 'advanced'
  | 'members'
  | 'audit';

const MEMBER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const baseNav: Array<{ key: PageKey; label: string; icon: typeof Home }> = [
  { key: 'dashboard', label: '首页', icon: Home },
  { key: 'documents', label: '文档', icon: FileText },
  { key: 'knowledge', label: '知识库', icon: Workflow },
  { key: 'chat', label: '问答', icon: Bot },
  { key: 'settings', label: '设置', icon: Settings },
  { key: 'advanced', label: '高级', icon: BarChart3 }
];

const personalNav: Array<{ key: PageKey; label: string; icon: typeof Home }> = [
  { key: 'dashboard', label: '首页', icon: Home },
  { key: 'documents', label: '文档管理', icon: FileText },
  { key: 'knowledge', label: '知识库', icon: Workflow },
  { key: 'chat', label: '智能问答', icon: Bot },
  { key: 'settings', label: '个人设置', icon: Settings },
  { key: 'advanced', label: '高级驾驶舱', icon: BarChart3 }
];

const enterpriseNav: Array<{ key: PageKey; label: string; icon: typeof Home }> = [
  { key: 'dashboard', label: '首页', icon: Home },
  { key: 'documents', label: '文档管理', icon: FileText },
  { key: 'knowledge', label: '企业知识库', icon: Workflow },
  { key: 'chat', label: '企业问答', icon: Bot },
  { key: 'settings', label: '企业设置', icon: Settings },
  { key: 'advanced', label: '高级驾驶舱', icon: BarChart3 },
  { key: 'members', label: '成员管理', icon: Users },
  { key: 'audit', label: '审计日志', icon: ShieldCheck }
];

const memberRoleOptions: Array<{ value: WorkspaceRole; label: string }> = [
  { value: 'admin', label: '管理员' },
  { value: 'member', label: '成员' },
  { value: 'viewer', label: '只读' }
];

export function WorkspaceShell({
  token,
  user,
  workspace,
  onBackToWorkspaces,
  onLogout
}: WorkspaceShellProps) {
  const [activePage, setActivePage] = useState<PageKey>('dashboard');
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseStatus | null>(null);
  const [knowledgeChunks, setKnowledgeChunks] = useState<KnowledgeChunk[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [advancedOverview, setAdvancedOverview] = useState<AdvancedOverview | null>(null);
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraph | null>(null);
  const [advancedNotifications, setAdvancedNotifications] = useState<AdvancedNotification[]>([]);
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettingRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeChunk[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documentContents, setDocumentContents] = useState<Record<string, DocumentContent>>({});
  const [memberEmail, setMemberEmail] = useState('');
  const [memberDepartment, setMemberDepartment] = useState('');
  const [memberRole, setMemberRole] = useState<WorkspaceRole>('member');
  const [knowledgeDocumentFilter, setKnowledgeDocumentFilter] = useState('all');
  const [moduleNotice, setModuleNotice] = useState<string | null>(null);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [memberSaving, setMemberSaving] = useState(false);
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageView[]>([]);
  const [selectedKnowledgeDocumentIds, setSelectedKnowledgeDocumentIds] = useState<string[]>([]);
  const [selectedGraphDocumentIds, setSelectedGraphDocumentIds] = useState<string[]>([]);
  const [useKnowledgeBaseForChat, setUseKnowledgeBaseForChat] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [deletingDocumentIds, setDeletingDocumentIds] = useState<string[]>([]);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);
  const [deletingAuditLogId, setDeletingAuditLogId] = useState<string | null>(null);
  const [auditBulkDeleting, setAuditBulkDeleting] = useState(false);
  const [auditRetentionDeleting, setAuditRetentionDeleting] = useState(false);
  const [settingSavingKey, setSettingSavingKey] = useState<string | null>(null);
  const [settingTestingKey, setSettingTestingKey] = useState<string | null>(null);
  const [moduleError, setModuleError] = useState<string | null>(null);

  const navItems = workspace.type === 'enterprise' ? enterpriseNav : personalNav;
  const currentNav = navItems.find((item) => item.key === activePage) ?? navItems[0];
  const workspaceLabel = workspace.type === 'enterprise' ? '企业工作区' : '个人工作区';
  const latestDocuments = useMemo(() => documents.slice(0, 3), [documents]);
  const canManageMembers = workspace.role === 'owner' || workspace.role === 'admin';
  const activeChatModelName = getActiveChatModelName(workspace.type, workspaceSettings);
  const currentUserName = getDisplayName(user);

  useEffect(() => {
    setDocuments([]);
    setKnowledgeBase(null);
    setKnowledgeChunks([]);
    setMembers([]);
    setAuditLogs([]);
    setAdvancedOverview(null);
    setKnowledgeGraph(null);
    setAdvancedNotifications([]);
    setWorkspaceSettings([]);
    setSearchQuery('');
    setSearchResults([]);
    setKnowledgeDocumentFilter('all');
    setSelectedFiles([]);
    setDocumentContents({});
    setMemberEmail('');
    setMemberDepartment('');
    setMemberRole('member');
    setChatQuestion('');
    setChatSessionId(null);
    setChatMessages([]);
    setSelectedKnowledgeDocumentIds([]);
    setSelectedGraphDocumentIds([]);
    setUseKnowledgeBaseForChat(false);
    setChatLoading(false);
    setDeletingDocumentId(null);
    setDeletingDocumentIds([]);
    setMemberActionId(null);
    setDeletingAuditLogId(null);
    setAuditBulkDeleting(false);
    setAuditRetentionDeleting(false);
    setSettingSavingKey(null);
    setSettingTestingKey(null);
    setModuleError(null);
    setModuleNotice(null);
    setActivePage('dashboard');
  }, [workspace.id]);

  useEffect(() => {
    if (activePage === 'dashboard') {
      if (workspace.type === 'enterprise') {
        void loadEnterpriseDashboard();
      } else {
        void loadWorkspaceModules();
      }
    }
    if (
      activePage === 'documents' ||
      activePage === 'knowledge' ||
      activePage === 'chat' ||
      activePage === 'settings'
    ) {
      void loadWorkspaceModules();
    }
    if (activePage === 'settings' || activePage === 'chat') {
      void loadWorkspaceSettings();
    }
  }, [activePage, workspace.id]);

  useEffect(() => {
    if (activePage === 'members') {
      void loadMembers();
    }
    if (activePage === 'audit') {
      void loadAuditLogs();
    }
  }, [activePage, workspace.id]);

  useEffect(() => {
    if (activePage === 'advanced') {
      void loadAdvancedDashboard();
    }
  }, [activePage, workspace.id]);

  async function loadWorkspaceModules() {
    try {
      setModuleLoading(true);
      setModuleError(null);
      setModuleNotice(null);
      const [nextDocuments, nextKnowledgeBase, nextChunks] = await Promise.all([
        api.documents(token, workspace.id),
        api.knowledgeBase(token, workspace.id),
        api.knowledgeChunks(token, workspace.id, 8)
      ]);
      setDocuments(nextDocuments);
      setKnowledgeBase(nextKnowledgeBase);
      setKnowledgeChunks(nextChunks);
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '模块数据加载失败');
    } finally {
      setModuleLoading(false);
    }
  }

  async function loadWorkspaceSettings() {
    try {
      setModuleError(null);
      const nextSettings = await api.workspaceSettings(token, workspace.id);
      setWorkspaceSettings(nextSettings);
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '配置数据加载失败');
    }
  }

  async function handleSaveWorkspaceSetting(
    settingKey: string,
    settingValue: Record<string, unknown>
  ) {
    try {
      setSettingSavingKey(settingKey);
      setModuleError(null);
      setModuleNotice(null);
      const saved = await api.saveWorkspaceSetting(token, workspace.id, settingKey, settingValue);
      setWorkspaceSettings((items) => {
        const exists = items.some((item) => item.setting_key === settingKey);
        if (!exists) return [...items, saved];
        return items.map((item) => (item.setting_key === settingKey ? saved : item));
      });
      setModuleNotice('配置已保存，后续问答会使用新的工作区配置。');
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '配置保存失败');
    } finally {
      setSettingSavingKey(null);
    }
  }

  async function handleTestWorkspaceModelConnection(
    settingKey: string,
    settingValue: Record<string, unknown>
  ): Promise<WorkspaceModelConnectionTestResult | null> {
    try {
      setSettingTestingKey(settingKey);
      setModuleError(null);
      setModuleNotice(null);
      const result = await api.testWorkspaceModelConnection(
        token,
        workspace.id,
        settingKey,
        settingValue
      );
      if (result.ok) {
        setModuleNotice(`${result.message}，当前模型：${result.model_name}`);
      } else {
        setModuleError(result.message);
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : '模型 API 连接测试失败';
      setModuleError(message);
      return null;
    } finally {
      setSettingTestingKey(null);
    }
  }

  async function loadEnterpriseDashboard() {
    try {
      setModuleLoading(true);
      setModuleError(null);
      setModuleNotice(null);
      const [
        nextDocuments,
        nextKnowledgeBase,
        nextChunks,
        nextMembers,
        nextLogs,
        overview,
        graph,
        notifications
      ] = await Promise.all([
        api.documents(token, workspace.id),
        api.knowledgeBase(token, workspace.id),
        api.knowledgeChunks(token, workspace.id, 8),
        api.workspaceMembers(token, workspace.id),
        api.auditLogs(token, workspace.id),
        api.advancedOverview(token, workspace.id),
        api.knowledgeGraph(token, workspace.id),
        api.advancedNotifications(token, workspace.id)
      ]);
      setDocuments(nextDocuments);
      setKnowledgeBase(nextKnowledgeBase);
      setKnowledgeChunks(nextChunks);
      setMembers(nextMembers);
      setAuditLogs(nextLogs);
      setAdvancedOverview(overview);
      setKnowledgeGraph(graph);
      setAdvancedNotifications(notifications);
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '企业首页数据加载失败');
    } finally {
      setModuleLoading(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFiles(Array.from(event.target.files ?? []));
  }

  async function handleUpload() {
    if (selectedFiles.length === 0) return;
    try {
      setUploading(true);
      setModuleError(null);
      setModuleNotice(null);
      await Promise.all(
        selectedFiles.map((file) => api.uploadDocument(token, workspace.id, file))
      );
      const uploadedCount = selectedFiles.length;
      setSelectedFiles([]);
      setModuleNotice(
        workspace.type === 'personal'
          ? `已上传 ${uploadedCount} 个文档，均已进入当前个人工作区。`
          : `已上传 ${uploadedCount} 个企业文档，均已进入当前企业工作区。`
      );
      await loadWorkspaceModules();
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '文档上传失败');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDocument(document: DocumentRecord) {
    const confirmed = window.confirm(`确认删除“${document.filename}”吗？对应知识片段也会同步移除。`);
    if (!confirmed) return;
    try {
      setDeletingDocumentId(document.id);
      setDeletingDocumentIds([document.id]);
      setModuleError(null);
      setModuleNotice(null);
      await api.deleteDocument(token, workspace.id, document.id);
      setSearchResults([]);
      setSelectedKnowledgeDocumentIds((ids) => ids.filter((id) => id !== document.id));
      setModuleNotice(
        workspace.type === 'enterprise'
          ? '企业文档已删除，对应知识片段已在当前企业工作区内清理。'
          : '文档已删除，对应知识片段已同步清理。'
      );
      await loadWorkspaceModules();
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '文档删除失败');
    } finally {
      setDeletingDocumentId(null);
      setDeletingDocumentIds([]);
    }
  }

  async function handleDeleteDocuments(selectedDocuments: DocumentRecord[]) {
    if (selectedDocuments.length === 0) return;
    const confirmed = window.confirm(`确认同时删除选中的 ${selectedDocuments.length} 个文件知识库吗？对应知识片段也会同步移除。`);
    if (!confirmed) return;
    try {
      const ids = selectedDocuments.map((document) => document.id);
      setDeletingDocumentIds(ids);
      setDeletingDocumentId(ids[0] ?? null);
      setModuleError(null);
      setModuleNotice(null);
      await Promise.all(
        selectedDocuments.map((document) => api.deleteDocument(token, workspace.id, document.id))
      );
      setSearchResults([]);
      setSelectedKnowledgeDocumentIds((currentIds) =>
        currentIds.filter((id) => !ids.includes(id))
      );
      setModuleNotice(`已同时删除 ${selectedDocuments.length} 个文件知识库。`);
      await loadWorkspaceModules();
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '批量删除文件失败');
    } finally {
      setDeletingDocumentId(null);
      setDeletingDocumentIds([]);
    }
  }

  async function handleSearch() {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    try {
      setSearching(true);
      setModuleError(null);
      setModuleNotice(null);
      const filterDocumentIds =
        knowledgeDocumentFilter === 'all' ? undefined : [knowledgeDocumentFilter];
      const results = await api.searchKnowledge(
        token,
        workspace.id,
        query,
        20,
        filterDocumentIds
      );
      setSearchResults(results);
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '知识库检索失败');
    } finally {
      setSearching(false);
    }
  }

  function handleClearSearch() {
    setSearchQuery('');
    setSearchResults([]);
    setModuleNotice(null);
  }

  async function handleLoadDocumentContent(document: DocumentRecord) {
    if (documentContents[document.id]) return;
    try {
      setModuleError(null);
      const content = await api.documentContent(token, workspace.id, document.id);
      setDocumentContents((items) => ({ ...items, [document.id]: content }));
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '文档全文加载失败');
    }
  }

  async function loadMembers() {
    try {
      setModuleLoading(true);
      setModuleError(null);
      setModuleNotice(null);
      const nextMembers = await api.workspaceMembers(token, workspace.id);
      setMembers(nextMembers);
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '成员数据加载失败');
    } finally {
      setModuleLoading(false);
    }
  }

  async function loadAuditLogs() {
    try {
      setModuleLoading(true);
      setModuleError(null);
      setModuleNotice(null);
      const nextLogs = await api.auditLogs(token, workspace.id);
      setAuditLogs(nextLogs);
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '审计日志加载失败');
    } finally {
      setModuleLoading(false);
    }
  }

  async function handleDeleteAuditLog(log: AuditLogRecord) {
    const confirmed = window.confirm('确认删除这条审计日志吗？删除后仅从当前企业工作区审计日志中移除。');
    if (!confirmed) return;
    try {
      setDeletingAuditLogId(log.id);
      setModuleError(null);
      setModuleNotice(null);
      await api.deleteAuditLog(token, workspace.id, log.id);
      setAuditLogs((logs) => logs.filter((item) => item.id !== log.id));
      setModuleNotice('审计日志已删除，仅影响当前企业工作区。');
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '审计日志删除失败');
    } finally {
      setDeletingAuditLogId(null);
    }
  }

  async function handleDeleteAllAuditLogs() {
    const confirmed = window.confirm('确认统一删除当前企业工作区的全部审计日志吗？该操作不会影响个人工作区或其他企业工作区。');
    if (!confirmed) return;
    try {
      setAuditBulkDeleting(true);
      setModuleError(null);
      setModuleNotice(null);
      const result = await api.deleteAuditLogs(token, workspace.id);
      setAuditLogs([]);
      setModuleNotice(`已统一删除 ${result.deleted_count} 条审计日志，仅影响当前企业工作区。`);
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '审计日志统一删除失败');
    } finally {
      setAuditBulkDeleting(false);
    }
  }

  async function handleDeleteAuditLogsByRetention(retentionDays: number) {
    const confirmed = window.confirm(`确认定时删除当前企业工作区中超过 ${retentionDays} 天的审计日志吗？`);
    if (!confirmed) return;
    try {
      setAuditRetentionDeleting(true);
      setModuleError(null);
      setModuleNotice(null);
      const result = await api.deleteAuditLogs(token, workspace.id, retentionDays);
      await loadAuditLogs();
      setModuleNotice(`已删除超过 ${retentionDays} 天的审计日志 ${result.deleted_count} 条。`);
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '审计日志定时删除失败');
    } finally {
      setAuditRetentionDeleting(false);
    }
  }

  async function loadAdvancedDashboard(documentIds = selectedGraphDocumentIds) {
    try {
      setModuleLoading(true);
      setModuleError(null);
      setModuleNotice(null);
      const [overview, graph, notifications] = await Promise.all([
        api.advancedOverview(token, workspace.id),
        api.knowledgeGraph(token, workspace.id, documentIds),
        api.advancedNotifications(token, workspace.id)
      ]);
      setAdvancedOverview(overview);
      setKnowledgeGraph(graph);
      setAdvancedNotifications(notifications);
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '高级驾驶舱加载失败');
    } finally {
      setModuleLoading(false);
    }
  }

  async function handleRebuildKnowledgeGraph() {
    const confirmed = window.confirm('确认重建当前工作区知识图谱吗？系统会清理旧的 Neo4j 图谱节点和关系，并根据当前文档重新抽取实体关系。');
    if (!confirmed) return;
    try {
      setModuleLoading(true);
      setModuleError(null);
      setModuleNotice(null);
      await api.rebuildKnowledgeGraph(token, workspace.id);
      const [overview, graph, notifications] = await Promise.all([
        api.advancedOverview(token, workspace.id),
        api.knowledgeGraph(token, workspace.id, selectedGraphDocumentIds),
        api.advancedNotifications(token, workspace.id)
      ]);
      setAdvancedOverview(overview);
      setKnowledgeGraph(graph);
      setAdvancedNotifications(notifications);
      setModuleNotice('已按当前工作区文档重新生成 Neo4j 知识图谱。');
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '知识图谱重建失败');
    } finally {
      setModuleLoading(false);
    }
  }

  function handleGraphDocumentSelectionChange(documentIds: string[]) {
    setSelectedGraphDocumentIds(documentIds);
    void loadAdvancedDashboard(documentIds);
  }

  async function handleAddMember() {
    const email = memberEmail.trim();
    if (!email) {
      setModuleError('请输入成员邮箱。');
      return;
    }
    if (!MEMBER_EMAIL_PATTERN.test(email)) {
      setModuleError('请输入正确的成员邮箱。');
      return;
    }
    try {
      setMemberSaving(true);
      setModuleError(null);
      setModuleNotice(null);
      await api.addWorkspaceMember(
        token,
        workspace.id,
        email,
        memberRole,
        memberDepartment
      );
      setMemberEmail('');
      setMemberDepartment('');
      setMemberRole('member');
      setModuleNotice('成员添加成功，权限仅作用于当前企业工作区。');
      await loadMembers();
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '成员添加失败');
    } finally {
      setMemberSaving(false);
    }
  }

  async function handleUpdateMemberRole(member: WorkspaceMember, role: WorkspaceRole) {
    try {
      setMemberActionId(member.id);
      setModuleError(null);
      setModuleNotice(null);
      await api.updateWorkspaceMember(
        token,
        workspace.id,
        member.id,
        role,
        member.department
      );
      setModuleNotice('成员角色已更新。');
      await loadMembers();
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '角色更新失败');
    } finally {
      setMemberActionId(null);
    }
  }

  async function handleUpdateMemberDepartment(member: WorkspaceMember, department: string) {
    try {
      setMemberActionId(member.id);
      setModuleError(null);
      setModuleNotice(null);
      await api.updateWorkspaceMember(
        token,
        workspace.id,
        member.id,
        member.role,
        department
      );
      setModuleNotice('成员部门已更新。');
      await loadMembers();
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '部门更新失败');
    } finally {
      setMemberActionId(null);
    }
  }

  async function handleRemoveMember(member: WorkspaceMember) {
    const confirmed = window.confirm(`确认移除“${member.username}”吗？`);
    if (!confirmed) return;
    try {
      setMemberActionId(member.id);
      setModuleError(null);
      setModuleNotice(null);
      await api.removeWorkspaceMember(token, workspace.id, member.id);
      setModuleNotice('成员已从当前企业工作区移除，历史审计记录保留。');
      await loadMembers();
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '成员移除失败');
    } finally {
      setMemberActionId(null);
    }
  }

  async function handleAskChat() {
    const question = chatQuestion.trim();
    if (!question) return;
    const userMessage: ChatMessageView = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      useKnowledgeBase: useKnowledgeBaseForChat,
      createdAt: new Date().toISOString()
    };
    try {
      setChatLoading(true);
      setModuleError(null);
      setModuleNotice(null);
      setChatQuestion('');
      setChatMessages((messages) => [...messages, userMessage]);
      const response: ChatAskResponse = await api.askChat(
        token,
        workspace.id,
        question,
        chatSessionId,
        useKnowledgeBaseForChat ? selectedKnowledgeDocumentIds : [],
        useKnowledgeBaseForChat
      );
      setChatSessionId(response.session.id);
      setChatMessages((messages) => [
        ...messages,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.answer,
          sources: extractChatSources(response),
          modelName: response.model_name,
          useKnowledgeBase: response.use_knowledge_base,
          createdAt: new Date().toISOString()
        }
      ]);
      setModuleNotice(
        useKnowledgeBaseForChat
          ? workspace.type === 'enterprise'
            ? '企业 RAG 问答已完成，引用来源限定在当前企业工作区。'
            : '个人 RAG 问答已完成，引用来源限定在当前个人工作区。'
          : '普通大模型对话已完成，未使用知识库检索。'
      );
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : '问答失败');
    } finally {
      setChatLoading(false);
    }
  }

  function handlePrepareQuestion(question: string, documentIds?: string[]) {
    if (documentIds) {
      setSelectedKnowledgeDocumentIds(documentIds);
      setUseKnowledgeBaseForChat(documentIds.length > 0);
    }
    setChatQuestion(question);
    setActivePage('chat');
  }

  function handleDeleteChatTurn(messageId: string) {
    const confirmed = window.confirm(
      workspace.type === 'enterprise'
        ? '确认删除这条企业问答历史吗？'
        : '确认删除这条问答历史吗？'
    );
    if (!confirmed) return;
    setChatMessages((messages) => {
      const startIndex = messages.findIndex((message) => message.id === messageId);
      if (startIndex < 0) return messages;
      const nextUserIndex = messages.findIndex(
        (message, index) => index > startIndex && message.role === 'user'
      );
      const endIndex = nextUserIndex > -1 ? nextUserIndex : messages.length;
      return messages.filter((_, index) => index < startIndex || index >= endIndex);
    });
    setModuleNotice('当前会话中的问答记录已删除。');
  }

  function handleClearChatHistory() {
    const confirmed = window.confirm(
      workspace.type === 'enterprise'
        ? '确认清空当前企业问答历史吗？'
        : '确认清空当前会话历史吗？'
    );
    if (!confirmed) return;
    setChatMessages([]);
    setChatSessionId(null);
    setModuleNotice('当前会话历史已清空。');
  }

  return (
    <main className={`app-shell ${workspace.type === 'enterprise' ? 'enterprise-shell' : 'personal-shell'}`}>
      <aside className="sidebar">
        <div className="brand-block">
          <img className="brand-logo" src="/qizhiyun-logo.png" alt="企知云" />
          <div>
            <strong>企业知识平台</strong>
            <span>{workspace.type === 'enterprise' ? '企业空间' : '个人空间'}</span>
          </div>
        </div>
        <div className="sidebar-context">
          <span>{workspace.type === 'enterprise' ? 'Enterprise RAG' : 'Personal RAG'}</span>
          <strong>{workspace.name}</strong>
          <small>{workspace.type === 'enterprise' ? `角色 ${workspace.role || 'member'}` : 'owner · 私有空间'}</small>
        </div>

        <nav className="sidebar-nav" aria-label="工作区导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={item.key === activePage ? 'active' : ''}
                onClick={() => setActivePage(item.key)}
              >
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <span>Workspace ID</span>
          <strong>{workspace.id.slice(0, 8)}</strong>
        </div>
      </aside>

      <section className="workbench">
        <header className="workbench-header">
          <div className="workbench-title-block">
            <p className="eyebrow">{workspaceLabel}</p>
            <h1>{workspace.type === 'personal' ? `${currentUserName} 的个人工作区` : workspace.name}</h1>
            <span>
              {workspace.type === 'personal'
                ? `当前用户：${currentUserName}`
                : `当前用户：${currentUserName}｜角色：${workspace.role || 'member'}`}
            </span>
            <p className="workspace-scope-note">
              {workspace.type === 'personal'
                ? '当前空间：个人工作区，数据仅个人可见，不与企业工作区同步。'
                : '当前空间：企业工作区，数据仅在当前企业内部可见，不与个人工作区同步。'}
            </p>
          </div>
          <div className="header-actions">
            <span className="workspace-mode-chip">{workspace.type === 'enterprise' ? '企业版' : '个人版'}</span>
            <button className="ghost-button" onClick={onBackToWorkspaces}>
              <ArrowLeftRight size={18} aria-hidden="true" />
              切换工作区
            </button>
            <button className="ghost-button" onClick={onLogout}>
              <LogOut size={18} aria-hidden="true" />
              退出登录
            </button>
          </div>
        </header>

        {workspace.type === 'personal' ? (
          <PersonalWorkspacePanel
            activePage={activePage as PersonalPageKey}
            currentNavLabel={currentNav.label}
            user={user}
            workspace={workspace}
            documents={documents}
            knowledgeBase={knowledgeBase}
            chunks={knowledgeChunks}
            searchQuery={searchQuery}
            searchResults={searchResults}
            selectedFile={selectedFiles[0] ?? null}
            selectedFiles={selectedFiles}
            documentContents={documentContents}
            chatQuestion={chatQuestion}
            chatMessages={chatMessages}
            selectedKnowledgeDocumentIds={selectedKnowledgeDocumentIds}
            useKnowledgeBaseForChat={useKnowledgeBaseForChat}
            activeChatModelName={activeChatModelName}
            workspaceSettings={workspaceSettings}
            advancedOverview={advancedOverview}
            knowledgeGraph={knowledgeGraph}
            selectedGraphDocumentIds={selectedGraphDocumentIds}
            notifications={advancedNotifications}
            loading={moduleLoading}
            uploading={uploading}
            searching={searching}
            chatLoading={chatLoading}
            deletingDocumentId={deletingDocumentId}
            deletingDocumentIds={deletingDocumentIds}
            settingSavingKey={settingSavingKey}
            settingTestingKey={settingTestingKey}
            error={moduleError}
            notice={moduleNotice}
            knowledgeDocumentFilter={knowledgeDocumentFilter}
            onNavigate={(page) => setActivePage(page)}
            onFileChange={handleFileChange}
            onUpload={handleUpload}
            onDeleteDocument={handleDeleteDocument}
            onDeleteDocuments={handleDeleteDocuments}
            onLoadDocumentContent={handleLoadDocumentContent}
            onSaveWorkspaceSetting={handleSaveWorkspaceSetting}
            onTestWorkspaceModelConnection={handleTestWorkspaceModelConnection}
            onRefreshModules={loadWorkspaceModules}
            onRefreshAdvanced={loadAdvancedDashboard}
            onRebuildGraph={handleRebuildKnowledgeGraph}
            onSearchQueryChange={setSearchQuery}
            onKnowledgeDocumentFilterChange={setKnowledgeDocumentFilter}
            onSearch={handleSearch}
            onClearSearch={handleClearSearch}
            onQuestionChange={setChatQuestion}
            onSelectedKnowledgeDocumentIdsChange={setSelectedKnowledgeDocumentIds}
            onSelectedGraphDocumentIdsChange={handleGraphDocumentSelectionChange}
            onUseKnowledgeBaseForChatChange={setUseKnowledgeBaseForChat}
            onAsk={handleAskChat}
            onPrepareQuestion={handlePrepareQuestion}
            onDeleteChatTurn={handleDeleteChatTurn}
            onClearChatHistory={handleClearChatHistory}
          />
        ) : (
          <EnterpriseWorkspacePanel
            activePage={activePage as EnterprisePageKey}
            currentNavLabel={currentNav.label}
            user={user}
            workspace={workspace}
            documents={documents}
            knowledgeBase={knowledgeBase}
            chunks={knowledgeChunks}
            members={members}
            auditLogs={auditLogs}
            advancedOverview={advancedOverview}
            knowledgeGraph={knowledgeGraph}
            selectedGraphDocumentIds={selectedGraphDocumentIds}
            notifications={advancedNotifications}
            searchQuery={searchQuery}
            searchResults={searchResults}
            selectedFile={selectedFiles[0] ?? null}
            selectedFiles={selectedFiles}
            documentContents={documentContents}
            chatQuestion={chatQuestion}
            chatMessages={chatMessages}
            selectedKnowledgeDocumentIds={selectedKnowledgeDocumentIds}
            useKnowledgeBaseForChat={useKnowledgeBaseForChat}
            activeChatModelName={activeChatModelName}
            workspaceSettings={workspaceSettings}
            memberEmail={memberEmail}
            memberDepartment={memberDepartment}
            memberRole={memberRole}
            loading={moduleLoading}
            uploading={uploading}
            searching={searching}
            chatLoading={chatLoading}
            memberSaving={memberSaving}
            deletingDocumentId={deletingDocumentId}
            deletingDocumentIds={deletingDocumentIds}
            memberActionId={memberActionId}
            deletingAuditLogId={deletingAuditLogId}
            auditBulkDeleting={auditBulkDeleting}
            auditRetentionDeleting={auditRetentionDeleting}
            settingSavingKey={settingSavingKey}
            settingTestingKey={settingTestingKey}
            error={moduleError}
            notice={moduleNotice}
            knowledgeDocumentFilter={knowledgeDocumentFilter}
            canManageMembers={canManageMembers}
            canGrantAdmin={workspace.role === 'owner'}
            onNavigate={(page) => setActivePage(page)}
            onFileChange={handleFileChange}
            onUpload={handleUpload}
            onDeleteDocument={handleDeleteDocument}
            onDeleteDocuments={handleDeleteDocuments}
            onLoadDocumentContent={handleLoadDocumentContent}
            onSaveWorkspaceSetting={handleSaveWorkspaceSetting}
            onTestWorkspaceModelConnection={handleTestWorkspaceModelConnection}
            onRefreshModules={loadWorkspaceModules}
            onRefreshEnterpriseDashboard={loadEnterpriseDashboard}
            onRefreshAdvanced={loadAdvancedDashboard}
            onRebuildGraph={handleRebuildKnowledgeGraph}
            onRefreshMembers={loadMembers}
            onRefreshAuditLogs={loadAuditLogs}
            onDeleteAuditLog={handleDeleteAuditLog}
            onDeleteAllAuditLogs={handleDeleteAllAuditLogs}
            onDeleteAuditLogsByRetention={handleDeleteAuditLogsByRetention}
            onSearchQueryChange={setSearchQuery}
            onKnowledgeDocumentFilterChange={setKnowledgeDocumentFilter}
            onSearch={handleSearch}
            onClearSearch={handleClearSearch}
            onQuestionChange={setChatQuestion}
            onSelectedKnowledgeDocumentIdsChange={setSelectedKnowledgeDocumentIds}
            onSelectedGraphDocumentIdsChange={handleGraphDocumentSelectionChange}
            onUseKnowledgeBaseForChatChange={setUseKnowledgeBaseForChat}
            onAsk={handleAskChat}
            onPrepareQuestion={handlePrepareQuestion}
            onDeleteChatTurn={handleDeleteChatTurn}
            onClearChatHistory={handleClearChatHistory}
            onEmailChange={setMemberEmail}
            onDepartmentChange={setMemberDepartment}
            onRoleChange={setMemberRole}
            onAddMember={handleAddMember}
            onUpdateRole={handleUpdateMemberRole}
            onUpdateDepartment={handleUpdateMemberDepartment}
            onRemoveMember={handleRemoveMember}
          />
        )}
      </section>
    </main>
  );
}

function extractChatSources(response: ChatAskResponse): KnowledgeChunk[] {
  const candidates = [
    response.sources,
    response.references,
    response.chunks,
    response.citations,
    response.source_chunks,
    response.retrieved_chunks
  ];
  return candidates.find((items) => Array.isArray(items) && items.length > 0) ?? [];
}

function getActiveChatModelName(
  workspaceType: Workspace['type'],
  settings: WorkspaceSettingRecord[]
): string {
  const settingKey =
    workspaceType === 'enterprise' ? 'enterprise_model_api_config' : 'personal_model_config';
  const setting = settings.find((item) => item.setting_key === settingKey);
  const modelName = setting?.setting_value?.model_name;
  const displayName = typeof modelName === 'string' && modelName.trim() ? modelName : 'deepseek-v4-flash';
  return setting?.setting_value?.api_key_configured
    ? `${displayName}（API已配置）`
    : `${displayName}（未配置工作区API）`;
}

function DocumentsPanel({
  documents,
  currentNavLabel,
  loading,
  uploading,
  selectedFile,
  deletingDocumentId,
  error,
  onFileChange,
  onUpload,
  onDelete,
  onRefresh
}: {
  documents: DocumentRecord[];
  currentNavLabel: string;
  loading: boolean;
  uploading: boolean;
  selectedFile: File | null;
  deletingDocumentId: string | null;
  error: string | null;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onDelete: (document: DocumentRecord) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="content-panel module-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{currentNavLabel}</p>
          <h2>文档管理</h2>
          <p>文档上传后会进入当前工作区，后续版本继续解析、切片和向量化。</p>
        </div>
        <button className="ghost-button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={18} aria-hidden="true" />
          刷新
        </button>
      </div>

      <div className="upload-card">
        <div className="upload-copy">
          <Upload size={24} aria-hidden="true" />
          <div>
            <strong>{selectedFile ? selectedFile.name : '选择要上传的文档'}</strong>
            <span>{selectedFile ? formatFileSize(selectedFile.size) : '支持常见办公文档、文本文件和资产文件'}</span>
          </div>
        </div>
        <div className="upload-actions">
          <label className="file-picker">
            选择文件
            <input
              type="file"
              onChange={onFileChange}
              accept=".pdf,.docx,.txt,.md,.xlsx,.csv,.pptx,.jpg,.jpeg,.png,.mp3,.mp4,.zip"
            />
          </label>
          <button
            className="primary-action compact-action"
            type="button"
            disabled={!selectedFile || uploading}
            onClick={onUpload}
          >
            <Upload size={18} aria-hidden="true" />
            {uploading ? '上传中' : '上传'}
          </button>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="document-table">
        <div className="table-head">
          <span>文件名</span>
          <span>类型</span>
          <span>解析</span>
          <span>入库</span>
          <span>片段</span>
          <span>上传时间</span>
          <span>操作</span>
        </div>
        {documents.length === 0 ? (
          <div className="empty-row">当前工作区还没有文档。</div>
        ) : (
          documents.map((document) => (
            <div className="table-row" key={document.id}>
              <span className="file-name">{document.filename}</span>
              <span>{document.file_type}</span>
              <StatusBadge value={document.parse_status} kind="parse" />
              <StatusBadge value={document.index_status} kind="index" />
              <span>{document.chunk_count}</span>
              <span>{formatDate(document.created_at)}</span>
              <button
                className="icon-button danger"
                type="button"
                title="删除文档"
                aria-label={`删除 ${document.filename}`}
                disabled={deletingDocumentId === document.id}
                onClick={() => onDelete(document)}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function KnowledgePanel({
  currentNavLabel,
  knowledgeBase,
  documents,
  chunks,
  searchQuery,
  searchResults,
  loading,
  searching,
  error,
  onSearchQueryChange,
  onSearch,
  onClearSearch,
  onRefresh
}: {
  currentNavLabel: string;
  knowledgeBase: KnowledgeBaseStatus | null;
  documents: DocumentRecord[];
  chunks: KnowledgeChunk[];
  searchQuery: string;
  searchResults: KnowledgeChunk[];
  loading: boolean;
  searching: boolean;
  error: string | null;
  onSearchQueryChange: (value: string) => void;
  onSearch: () => void;
  onClearSearch: () => void;
  onRefresh: () => void;
}) {
  const hasSearchQuery = searchQuery.trim().length > 0;
  const visibleChunks = hasSearchQuery ? searchResults : chunks;

  return (
    <section className="content-panel module-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{currentNavLabel}</p>
          <h2>知识库状态</h2>
          <p>文档上传后自动解析为知识片段，当前版本提供工作区内关键词检索预览。</p>
        </div>
        <button className="ghost-button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={18} aria-hidden="true" />
          刷新
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="knowledge-grid">
        <MetricCard
          label="知识库状态"
          value={statusText(knowledgeBase?.status ?? 'empty')}
          icon={Database}
        />
        <MetricCard
          label="文档数量"
          value={String(knowledgeBase?.document_count ?? documents.length)}
          icon={FileText}
        />
        <MetricCard
          label="知识片段"
          value={String(knowledgeBase?.chunk_count ?? 0)}
          icon={Workflow}
        />
      </div>

      <form
        className="knowledge-search"
        onSubmit={(event) => {
          event.preventDefault();
          void onSearch();
        }}
      >
        <div className="input-row">
          <Search size={18} aria-hidden="true" />
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="输入关键词检索当前工作区知识片段"
          />
        </div>
        <button className="primary-action compact-action" type="submit" disabled={searching}>
          <Search size={18} aria-hidden="true" />
          {searching ? '检索中' : '检索'}
        </button>
        {hasSearchQuery && (
          <button className="ghost-button" type="button" onClick={onClearSearch}>
            清空
          </button>
        )}
      </form>

      <KnowledgeChunkList
        title={hasSearchQuery ? '检索结果' : '最近知识片段'}
        chunks={visibleChunks}
        showScore={hasSearchQuery}
        emptyText={hasSearchQuery ? '当前关键词没有命中片段。' : '上传并解析文档后这里会显示知识片段。'}
      />

      <div className="document-table compact-table">
        <div className="table-head">
          <span>最近文档</span>
          <span>解析</span>
          <span>入库</span>
        </div>
        {documents.length === 0 ? (
          <div className="empty-row">上传文档后这里会显示知识库来源。</div>
        ) : (
          documents.slice(0, 5).map((document) => (
            <div className="table-row compact-row" key={document.id}>
              <span className="file-name">{document.filename}</span>
              <StatusBadge value={document.parse_status} kind="parse" />
              <StatusBadge value={document.index_status} kind="index" />
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function KnowledgeChunkList({
  title,
  chunks,
  showScore,
  emptyText
}: {
  title: string;
  chunks: KnowledgeChunk[];
  showScore: boolean;
  emptyText: string;
}) {
  return (
    <div className="chunk-list">
      <div className="chunk-list-head">
        <h3>{title}</h3>
        <span>{chunks.length} 条</span>
      </div>
      {chunks.length === 0 ? (
        <div className="empty-row">{emptyText}</div>
      ) : (
        chunks.map((chunk) => (
          <article className="chunk-item" key={chunk.id}>
            <div>
              <strong>{chunk.filename}</strong>
              <span>片段 #{chunk.chunk_index + 1}</span>
              {showScore && <span>相关度 {chunk.score.toFixed(2)}</span>}
            </div>
            <p>{chunk.content}</p>
          </article>
        ))
      )}
    </div>
  );
}

function ChatPanel({
  currentNavLabel,
  messages,
  question,
  loading,
  error,
  onQuestionChange,
  onAsk
}: {
  currentNavLabel: string;
  messages: ChatMessageView[];
  question: string;
  loading: boolean;
  error: string | null;
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
}) {
  return (
    <section className="content-panel module-panel chat-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{currentNavLabel}</p>
          <h2>RAG 智能问答</h2>
          <p>基于当前工作区知识片段回答问题，并返回引用来源。</p>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="chat-thread" aria-live="polite">
        {messages.length === 0 ? (
          <div className="empty-row">上传并解析文档后，可以在这里提问。</div>
        ) : (
          messages.map((message) => (
            <article className={`chat-message ${message.role}`} key={message.id}>
              <div className="chat-bubble">
                <strong>{message.role === 'user' ? '你' : '知识助手'}</strong>
                {message.modelName && <span>{message.modelName}</span>}
                <p>{message.content}</p>
              </div>
              {message.sources && message.sources.length > 0 && (
                <div className="chat-sources">
                  <span>来源</span>
                  {message.sources.map((source) => (
                    <article key={source.id}>
                      <strong>{source.filename}</strong>
                      <small>片段 #{source.chunk_index + 1} · 相关度 {source.score.toFixed(2)}</small>
                      <p>{source.content}</p>
                    </article>
                  ))}
                </div>
              )}
            </article>
          ))
        )}
      </div>

      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void onAsk();
        }}
      >
        <textarea
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          placeholder="输入要向当前工作区知识库提问的问题"
        />
        <button className="primary-action compact-action" type="submit" disabled={loading || !question.trim()}>
          <Bot size={18} aria-hidden="true" />
          {loading ? '生成中' : '提问'}
        </button>
      </form>
    </section>
  );
}

function MembersPanel({
  currentNavLabel,
  members,
  currentUserId,
  canManage,
  canGrantAdmin,
  loading,
  saving,
  actionMemberId,
  error,
  email,
  department,
  role,
  onEmailChange,
  onDepartmentChange,
  onRoleChange,
  onAddMember,
  onUpdateRole,
  onRemoveMember,
  onRefresh
}: {
  currentNavLabel: string;
  members: WorkspaceMember[];
  currentUserId: string;
  canManage: boolean;
  canGrantAdmin: boolean;
  loading: boolean;
  saving: boolean;
  actionMemberId: string | null;
  error: string | null;
  email: string;
  department: string;
  role: WorkspaceRole;
  onEmailChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onRoleChange: (value: WorkspaceRole) => void;
  onAddMember: () => void;
  onUpdateRole: (member: WorkspaceMember, role: WorkspaceRole) => void;
  onRemoveMember: (member: WorkspaceMember) => void;
  onRefresh: () => void;
}) {
  const availableRoleOptions = canGrantAdmin
    ? memberRoleOptions
    : memberRoleOptions.filter((option) => option.value !== 'admin');

  return (
    <section className="content-panel module-panel collaboration-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{currentNavLabel}</p>
          <h2>企业成员</h2>
          <p>查看企业工作区成员，管理角色和协作权限。</p>
        </div>
        <button className="ghost-button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={18} aria-hidden="true" />
          刷新
        </button>
      </div>

      {canManage && (
        <form
          className="member-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onAddMember();
          }}
        >
          <label>
            邮箱
            <input
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="成员已注册邮箱"
            />
          </label>
          <label>
            角色
            <select
              value={role}
              onChange={(event) => onRoleChange(event.target.value as WorkspaceRole)}
            >
              {availableRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            部门
            <input
              value={department}
              onChange={(event) => onDepartmentChange(event.target.value)}
              placeholder="可选"
            />
          </label>
          <button className="primary-action compact-action" type="submit" disabled={saving || !email.trim()}>
            <UserPlus size={18} aria-hidden="true" />
            {saving ? '添加中' : '添加成员'}
          </button>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="member-table">
        <div className="member-row member-head">
          <span>成员</span>
          <span>角色</span>
          <span>部门</span>
          <span>加入时间</span>
          <span>操作</span>
        </div>
        {members.length === 0 ? (
          <div className="empty-row">当前企业工作区还没有成员。</div>
        ) : (
          members.map((member) => {
            const isOwner = member.role === 'owner';
            const isCurrentUser = member.user_id === currentUserId;
            const canEditRow =
              canManage && !isOwner && !isCurrentUser && (canGrantAdmin || member.role !== 'admin');
            return (
              <div className="member-row" key={member.id}>
                <span>
                  <strong>{member.username}</strong>
                  <small>{maskEmail(member.email)}</small>
                </span>
                <span>
                  {canEditRow ? (
                    <select
                      value={member.role}
                      disabled={actionMemberId === member.id}
                      onChange={(event) =>
                        onUpdateRole(member, event.target.value as WorkspaceRole)
                      }
                    >
                      {availableRoleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <StatusBadge value={member.role} />
                  )}
                </span>
                <span>{member.department || '未设置'}</span>
                <span>{formatDate(member.joined_at)}</span>
                <span>
                  <button
                    className="icon-button danger"
                    type="button"
                    title="移除成员"
                    aria-label={`移除 ${member.username}`}
                    disabled={!canEditRow || actionMemberId === member.id}
                    onClick={() => onRemoveMember(member)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function AuditPanel({
  currentNavLabel,
  logs,
  loading,
  error,
  onRefresh
}: {
  currentNavLabel: string;
  logs: AuditLogRecord[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <section className="content-panel module-panel collaboration-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{currentNavLabel}</p>
          <h2>审计日志</h2>
          <p>查看当前企业工作区最近的成员、文档、知识库和问答操作。</p>
        </div>
        <button className="ghost-button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={18} aria-hidden="true" />
          刷新
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="audit-list">
        {logs.length === 0 ? (
          <div className="empty-row">当前企业工作区还没有审计记录。</div>
        ) : (
          logs.map((log) => (
            <article className="audit-item" key={log.id}>
              <div>
                <strong>{actionText(log.action)}</strong>
                <span>{formatDate(log.created_at)}</span>
              </div>
              <p>
                操作者：{log.user_id ? '用户' : '系统'} · 目标：{log.target_type || '无'} /{' '}
                {shortId(log.target_id)}
              </p>
              <code>{formatAuditDetail(log.detail)}</code>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function AdvancedPanel({
  currentNavLabel,
  overview,
  graph,
  notifications,
  loading,
  error,
  onRefresh
}: {
  currentNavLabel: string;
  overview: AdvancedOverview | null;
  graph: KnowledgeGraph | null;
  notifications: AdvancedNotification[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const graphNodes = graph?.nodes ?? [];
  const graphEdges = graph?.edges ?? [];
  const conceptCount = graphNodes.filter((node) => node.type === 'concept').length;

  return (
    <section className="content-panel module-panel advanced-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{currentNavLabel}</p>
          <h2>V5 高级驾驶舱</h2>
          <p>集中查看知识资产、图谱预览和工作区动态。</p>
        </div>
        <button className="ghost-button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={18} aria-hidden="true" />
          刷新
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="knowledge-grid advanced-metrics">
        <MetricCard
          label="文档数量"
          value={String(overview?.document_count ?? 0)}
          icon={FileText}
        />
        <MetricCard
          label="知识片段"
          value={String(overview?.chunk_count ?? 0)}
          icon={Workflow}
        />
        <MetricCard
          label="成员数量"
          value={String(overview?.member_count ?? 0)}
          icon={Users}
        />
        <MetricCard
          label="审计事件"
          value={String(overview?.audit_log_count ?? 0)}
          icon={ShieldCheck}
        />
      </div>

      <div className="advanced-grid business">
        <section className="advanced-section graph-section">
          <div className="section-title">
            <Network size={20} aria-hidden="true" />
            <div>
              <h3>知识图谱预览</h3>
              <span>
                {graphNodes.length} 个节点 / {graphEdges.length} 条关系 / {conceptCount} 个概念
              </span>
            </div>
          </div>
          <div className="graph-board" aria-label="知识图谱节点">
            {graphNodes.slice(0, 12).map((node) => (
              <span className={`graph-node ${node.type}`} key={node.id}>
                {node.label}
              </span>
            ))}
            {graphNodes.length === 0 && <div className="empty-row">暂无图谱节点。</div>}
          </div>
          <div className="graph-relations">
            {graphEdges.slice(0, 6).map((edge) => (
              <article key={edge.id}>
                <strong>{edge.label}</strong>
                <span>{edge.source.replace(/^[^:]+:/, '')} → {edge.target.replace(/^[^:]+:/, '')}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="advanced-section">
          <div className="section-title">
            <Bell size={20} aria-hidden="true" />
            <div>
              <h3>通知中心</h3>
              <span>最近工作区动态</span>
            </div>
          </div>
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="empty-row">暂无通知动态。</div>
            ) : (
              notifications.slice(0, 8).map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                  <p>{item.message}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="advanced-health">
        <StatusBadge value={overview?.vector_status ?? 'pending'} />
        <StatusBadge value={overview?.graph_status ?? 'pending'} />
        <StatusBadge value={overview?.rerank_status ?? 'pending'} />
        <span>
          最近活动：
          {overview?.latest_activity_at ? formatDate(overview.latest_activity_at) : '暂无'}
        </span>
      </div>
    </section>
  );
}

function DefaultPanel({
  activePage,
  workspace,
  currentNavLabel,
  knowledgeBase,
  latestDocuments
}: {
  activePage: PageKey;
  workspace: Workspace;
  currentNavLabel: string;
  knowledgeBase: KnowledgeBaseStatus | null;
  latestDocuments: DocumentRecord[];
}) {
  return (
    <section className="content-panel">
      <p className="eyebrow">{currentNavLabel}</p>
      <h2>{pageTitle(activePage, workspace.type)}</h2>
      <p>{pageDescription(activePage, workspace.type)}</p>
      <div className="metric-grid">
        <div>
          <span>工作区标识</span>
          <strong>{shortId(workspace.id)}</strong>
        </div>
        <div>
          <span>角色</span>
          <strong>{workspace.role || 'member'}</strong>
        </div>
        <div>
          <span>文档数量</span>
          <strong>{knowledgeBase?.document_count ?? latestDocuments.length}</strong>
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string;
  icon: typeof Home;
}) {
  return (
    <div className="knowledge-card">
      <Icon size={22} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

type StatusBadgeKind = 'default' | 'parse' | 'index';

function StatusBadge({ value, kind = 'default' }: { value: string; kind?: StatusBadgeKind }) {
  return <span className={`status-badge ${value}`}>{statusText(value, kind)}</span>;
}

function statusText(value: string, kind: StatusBadgeKind = 'default') {
  const maps: Record<StatusBadgeKind, Record<string, string>> = {
    default: {
      owner: '所有者',
      admin: '管理员',
      member: '成员',
      viewer: '只读',
      empty: '空',
      documents_uploaded: '已上传文档',
      ready: '可检索',
      configured: '已配置',
      missing: '待配置',
      'milvus-configured': 'Milvus 已配置',
      'milvus-ready': 'Milvus 就绪',
      'neo4j-ready': 'Neo4j 就绪',
      'sqlite-ready': 'SQLite 就绪',
      uploaded: '已上传',
      pending: '待处理',
      parsing: '解析中',
      parsed: '已解析',
      indexing: '入库中',
      indexed: '已入库',
      unsupported: '暂不支持解析',
      asset_only: '仅保存',
      failed: '失败'
    },
    parse: {
      uploaded: '已上传',
      pending: '待解析',
      parsing: '解析中',
      parsed: '已解析',
      unsupported: '暂不支持解析',
      failed: '解析失败'
    },
    index: {
      pending: '待入库',
      indexing: '入库中',
      indexed: '已入库',
      asset_only: '仅保存',
      failed: '入库失败'
    }
  };
  return maps[kind][value] ?? maps.default[value] ?? value;
}

function actionText(action: string) {
  const map: Record<string, string> = {
    'auth.registered': '账号注册',
    'auth.login': '密码登录',
    'auth.email_code_login': '验证码登录',
    'auth.password_reset': '重置密码',
    'workspace.created': '创建工作区',
    'workspace.deleted': '删除工作区',
    'member.added': '添加成员',
    'member.role_updated': '修改成员角色',
    'member.removed': '移除成员',
    'document.created': '创建文档记录',
    'document.uploaded': '上传文档',
    'document.asset_saved': '保存文件资产',
    'document.parsed': '解析文档',
    'document.deleted': '删除文档',
    'chat.asked': '发起问答'
  };
  return map[action] ?? action;
}

function formatAuditDetail(detail: Record<string, unknown>) {
  const text = JSON.stringify(detail);
  return text === '{}' ? '无详情' : text;
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value?: string | null) {
  return formatBeijingDateTime(value);
}

function pageTitle(page: PageKey, type: Workspace['type']) {
  const map: Record<PageKey, string> = {
    dashboard: type === 'enterprise' ? '企业首页' : '个人首页',
    documents: type === 'enterprise' ? '企业文档' : '个人文档',
    knowledge: type === 'enterprise' ? '企业知识库' : '个人知识库',
    chat: type === 'enterprise' ? '企业智能问答' : '个人智能问答',
    settings: type === 'enterprise' ? '企业设置' : '个人设置',
    advanced: 'V5 高级驾驶舱',
    members: '企业用户权限',
    audit: '企业操作记录'
  };
  return map[page];
}

function pageDescription(page: PageKey, type: Workspace['type']) {
  const shared: Record<PageKey, string> = {
    dashboard: '展示文档数量、知识片段、向量库状态、最近问答和最近操作。',
    documents: '上传、查看和管理当前工作区内的知识文档。',
    knowledge: '查看知识库状态、文档来源和后续入库进度。',
    chat: 'V3 接入普通对话、RAG 问答和来源追溯。',
    settings: '管理模型、向量库、Webhook、存储等工作区级配置。',
    advanced: 'V5 汇总知识资产、知识图谱预览和工作区动态。',
    members: 'V4 将实现邀请成员、移除成员、角色权限和文档权限。',
    audit: '记录登录、文档、知识库、问答、工具、设置和权限操作。'
  };
  if (type === 'personal' && (page === 'members' || page === 'audit')) {
    return '个人工作区不展示企业协作入口。';
  }
  return shared[page];
}
