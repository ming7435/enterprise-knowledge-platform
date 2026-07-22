import type { ChangeEvent } from 'react';

import type {
  AdvancedNotification,
  AdvancedOverview,
  AuditLogRecord,
  DocumentContent,
  DocumentRecord,
  KnowledgeBaseStatus,
  KnowledgeChunk,
  KnowledgeGraph,
  KnowledgeGraphNode,
  User,
  Workspace,
  WorkspaceMember,
  WorkspaceModelConnectionTestResult,
  WorkspaceRole,
  WorkspaceSettingRecord,
} from '../../types';

export type EnterprisePageKey =
  | 'dashboard'
  | 'documents'
  | 'knowledge'
  | 'chat'
  | 'settings'
  | 'advanced'
  | 'members'
  | 'audit';

export interface EnterpriseChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: KnowledgeChunk[];
  modelName?: string;
  useKnowledgeBase?: boolean;
  createdAt?: string;
}

export interface EnterpriseProfile {
  role: WorkspaceRole;
  documentCount: number;
  parsedCount: number;
  indexedCount: number;
  failedCount: number;
  pendingParseCount: number;
  pendingIndexCount: number;
  chunkCount: number;
  memberCount: number;
  auditCount: number;
  qaCount: number;
  latestUpdatedAt: string | null;
  knowledgeStatus: string;
  knowledgeStatusText: string;
  knowledgeReady: boolean;
  canUpload: boolean;
  canManageDocs: boolean;
  canManageMembers: boolean;
  canManageSettings: boolean;
}

export interface EnterpriseWorkspacePanelProps {
  activePage: EnterprisePageKey;
  currentNavLabel: string;
  user: User;
  workspace: Workspace;
  documents: DocumentRecord[];
  knowledgeBase: KnowledgeBaseStatus | null;
  chunks: KnowledgeChunk[];
  members: WorkspaceMember[];
  auditLogs: AuditLogRecord[];
  advancedOverview: AdvancedOverview | null;
  knowledgeGraph: KnowledgeGraph | null;
  notifications: AdvancedNotification[];
  searchQuery: string;
  searchResults: KnowledgeChunk[];
  selectedFile: File | null;
  selectedFiles: File[];
  documentContents: Record<string, DocumentContent>;
  chatQuestion: string;
  chatMessages: EnterpriseChatMessage[];
  selectedKnowledgeDocumentIds: string[];
  selectedGraphDocumentIds: string[];
  useKnowledgeBaseForChat: boolean;
  activeChatModelName: string;
  workspaceSettings: WorkspaceSettingRecord[];
  memberEmail: string;
  memberDepartment: string;
  memberRole: WorkspaceRole;
  loading: boolean;
  uploading: boolean;
  searching: boolean;
  chatLoading: boolean;
  memberSaving: boolean;
  deletingDocumentId: string | null;
  deletingDocumentIds: string[];
  memberActionId: string | null;
  deletingAuditLogId: string | null;
  auditBulkDeleting: boolean;
  auditRetentionDeleting: boolean;
  settingSavingKey: string | null;
  settingTestingKey: string | null;
  error: string | null;
  notice: string | null;
  knowledgeDocumentFilter: string;
  canManageMembers: boolean;
  canGrantAdmin: boolean;
  onNavigate: (page: EnterprisePageKey) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onDeleteDocument: (document: DocumentRecord) => Promise<boolean>;
  onDeleteDocuments: (documents: DocumentRecord[]) => Promise<boolean>;
  onReprocessDocument: (document: DocumentRecord) => Promise<boolean>;
  onLoadDocumentContent: (document: DocumentRecord) => void | Promise<void>;
  onSaveWorkspaceSetting: (key: string, value: Record<string, unknown>) => void | Promise<void>;
  onTestWorkspaceModelConnection: (
    key: string,
    value: Record<string, unknown>
  ) => Promise<WorkspaceModelConnectionTestResult | null>;
  onRefreshModules: () => void;
  onRefreshEnterpriseDashboard: () => void;
  onRefreshAdvanced: () => void;
  onRebuildGraph: () => void;
  onRefreshMembers: () => void;
  onRefreshAuditLogs: () => void;
  onDeleteAuditLog: (log: AuditLogRecord) => void | Promise<void>;
  onDeleteAllAuditLogs: () => void | Promise<void>;
  onDeleteAuditLogsByRetention: (days: number) => void | Promise<void>;
  onSearchQueryChange: (value: string) => void;
  onKnowledgeDocumentFilterChange: (documentId: string) => void;
  onSearch: () => void;
  onClearSearch: () => void;
  onQuestionChange: (value: string) => void;
  onSelectedKnowledgeDocumentIdsChange: (documentIds: string[]) => void;
  onSelectedGraphDocumentIdsChange: (documentIds: string[]) => void;
  onSearchGraphNodes: (query: string, documentIds?: string[]) => Promise<KnowledgeGraphNode[]>;
  onLoadGraphNodeDetail: (nodeId: string) => Promise<KnowledgeGraphNode | null>;
  onLoadGraphNeighbors: (nodeId: string) => Promise<KnowledgeGraphNode[]>;
  onUseKnowledgeBaseForChatChange: (value: boolean) => void;
  onAsk: () => void;
  onStop: () => void;
  onPrepareQuestion: (question: string, documentIds?: string[]) => void;
  onDeleteChatTurn: (messageId: string) => boolean | Promise<boolean>;
  onClearChatHistory: () => boolean | Promise<boolean>;
  onEmailChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onRoleChange: (value: WorkspaceRole) => void;
  onAddMember: () => void;
  onUpdateRole: (member: WorkspaceMember, role: WorkspaceRole) => void;
  onUpdateDepartment: (member: WorkspaceMember, department: string) => void;
  onRemoveMember: (member: WorkspaceMember) => void;
}

export interface EnterpriseSharedProps {
  currentNavLabel: string;
  user: User;
  workspace: Workspace;
  documents: DocumentRecord[];
  knowledgeBase: KnowledgeBaseStatus | null;
  chunks: KnowledgeChunk[];
  members: WorkspaceMember[];
  auditLogs: AuditLogRecord[];
  documentContents: Record<string, DocumentContent>;
  chatMessages: EnterpriseChatMessage[];
  selectedKnowledgeDocumentIds: string[];
  selectedGraphDocumentIds: string[];
  useKnowledgeBaseForChat: boolean;
  activeChatModelName: string;
  workspaceSettings: WorkspaceSettingRecord[];
  notifications: AdvancedNotification[];
  profile: EnterpriseProfile;
  loading: boolean;
  error: string | null;
  notice: string | null;
  settingSavingKey: string | null;
  settingTestingKey: string | null;
  onNavigate: (page: EnterprisePageKey) => void;
  onPrepareQuestion: (question: string, documentIds?: string[]) => void;
  onLoadDocumentContent: (document: DocumentRecord) => void | Promise<void>;
  onSaveWorkspaceSetting: (key: string, value: Record<string, unknown>) => void | Promise<void>;
  onTestWorkspaceModelConnection: (
    key: string,
    value: Record<string, unknown>
  ) => Promise<WorkspaceModelConnectionTestResult | null>;
  onSelectedKnowledgeDocumentIdsChange: (documentIds: string[]) => void;
  onSelectedGraphDocumentIdsChange: (documentIds: string[]) => void;
  onSearchGraphNodes: (query: string, documentIds?: string[]) => Promise<KnowledgeGraphNode[]>;
  onLoadGraphNodeDetail: (nodeId: string) => Promise<KnowledgeGraphNode | null>;
  onLoadGraphNeighbors: (nodeId: string) => Promise<KnowledgeGraphNode[]>;
  onUseKnowledgeBaseForChatChange: (value: boolean) => void;
}
