import type { ChangeEvent } from 'react';

import type {
  AdvancedNotification,
  AdvancedOverview,
  DocumentContent,
  DocumentRecord,
  KnowledgeBaseStatus,
  KnowledgeChunk,
  KnowledgeGraph,
  KnowledgeGraphNode,
  User,
  Workspace,
  WorkspaceModelConnectionTestResult,
  WorkspaceSettingRecord,
} from '../../types';

export type PersonalPageKey =
  | 'dashboard'
  | 'documents'
  | 'knowledge'
  | 'chat'
  | 'settings'
  | 'advanced';

export interface PersonalChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: KnowledgeChunk[];
  modelName?: string;
  useKnowledgeBase?: boolean;
}

export interface PersonalProfile {
  documentCount: number;
  parsedDocumentCount: number;
  indexedDocumentCount: number;
  failedDocumentCount: number;
  pendingParseCount: number;
  pendingIndexCount: number;
  chunkCount: number;
  chatQuestionCount: number;
  knowledgeStatus: string;
  knowledgeStatusText: string;
  knowledgeReady: boolean;
  latestActivityText: string;
  latestActivityAt: string | null;
  vectorType: string;
  rerankStatus: string;
}

export interface PersonalWorkspacePanelProps {
  activePage: PersonalPageKey;
  currentNavLabel: string;
  user: User;
  workspace: Workspace;
  documents: DocumentRecord[];
  knowledgeBase: KnowledgeBaseStatus | null;
  chunks: KnowledgeChunk[];
  searchQuery: string;
  searchResults: KnowledgeChunk[];
  selectedFile: File | null;
  selectedFiles: File[];
  documentContents: Record<string, DocumentContent>;
  chatQuestion: string;
  chatMessages: PersonalChatMessage[];
  selectedKnowledgeDocumentIds: string[];
  selectedGraphDocumentIds: string[];
  useKnowledgeBaseForChat: boolean;
  activeChatModelName: string;
  workspaceSettings: WorkspaceSettingRecord[];
  advancedOverview: AdvancedOverview | null;
  knowledgeGraph: KnowledgeGraph | null;
  notifications: AdvancedNotification[];
  loading: boolean;
  uploading: boolean;
  searching: boolean;
  chatLoading: boolean;
  deletingDocumentId: string | null;
  deletingDocumentIds: string[];
  settingSavingKey: string | null;
  settingTestingKey: string | null;
  error: string | null;
  notice: string | null;
  knowledgeDocumentFilter: string;
  onNavigate: (page: PersonalPageKey) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onDeleteDocument: (document: DocumentRecord) => Promise<boolean>;
  onDeleteDocuments: (documents: DocumentRecord[]) => Promise<boolean>;
  onReprocessDocument: (document: DocumentRecord) => Promise<boolean>;
  onLoadDocumentContent: (document: DocumentRecord) => void | Promise<void>;
  onSaveWorkspaceSetting: (
    settingKey: string,
    settingValue: Record<string, unknown>
  ) => void | Promise<void>;
  onTestWorkspaceModelConnection: (
    settingKey: string,
    settingValue: Record<string, unknown>
  ) => Promise<WorkspaceModelConnectionTestResult | null>;
  onRefreshModules: () => void;
  onRefreshAdvanced: () => void;
  onRebuildGraph: () => void;
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
}

export interface PersonalSharedProps {
  currentNavLabel: string;
  user: User;
  workspace: Workspace;
  documents: DocumentRecord[];
  knowledgeBase: KnowledgeBaseStatus | null;
  chunks: KnowledgeChunk[];
  documentContents: Record<string, DocumentContent>;
  chatMessages: PersonalChatMessage[];
  selectedKnowledgeDocumentIds: string[];
  selectedGraphDocumentIds: string[];
  useKnowledgeBaseForChat: boolean;
  activeChatModelName: string;
  workspaceSettings: WorkspaceSettingRecord[];
  profile: PersonalProfile;
  loading: boolean;
  error: string | null;
  notice: string | null;
  settingSavingKey: string | null;
  settingTestingKey: string | null;
  onNavigate: (page: PersonalPageKey) => void;
  onPrepareQuestion: (question: string, documentIds?: string[]) => void;
  onLoadDocumentContent: (document: DocumentRecord) => void | Promise<void>;
  onSaveWorkspaceSetting: (
    settingKey: string,
    settingValue: Record<string, unknown>
  ) => void | Promise<void>;
  onTestWorkspaceModelConnection: (
    settingKey: string,
    settingValue: Record<string, unknown>
  ) => Promise<WorkspaceModelConnectionTestResult | null>;
  onSelectedKnowledgeDocumentIdsChange: (documentIds: string[]) => void;
  onSelectedGraphDocumentIdsChange: (documentIds: string[]) => void;
  onSearchGraphNodes: (query: string, documentIds?: string[]) => Promise<KnowledgeGraphNode[]>;
  onLoadGraphNodeDetail: (nodeId: string) => Promise<KnowledgeGraphNode | null>;
  onLoadGraphNeighbors: (nodeId: string) => Promise<KnowledgeGraphNode[]>;
  onUseKnowledgeBaseForChatChange: (value: boolean) => void;
}

export interface PersonalMetric {
  label: string;
  value: string;
  hint?: string;
  tone?: 'normal' | 'warning' | 'danger';
}
