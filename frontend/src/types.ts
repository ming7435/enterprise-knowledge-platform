export interface User {
  id: string;
  email: string;
  username: string;
  status: string;
}

export interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'enterprise';
  description?: string | null;
  status: string;
  role?: string | null;
}

export interface DocumentRecord {
  id: string;
  workspace_id: string;
  user_id: string;
  filename: string;
  file_type: string;
  file_path?: string | null;
  parse_status: string;
  index_status: string;
  chunk_count: number;
  processing_progress: number;
  processing_stage: string;
  processing_error?: string | null;
  task_id?: string | null;
  content_hash?: string | null;
  version: number;
  permission_scope: string;
  created_at: string;
}

export interface DocumentContent {
  document: DocumentRecord;
  library_name: string;
  content: string;
  chunk_count: number;
}

export interface KnowledgeBaseStatus {
  workspace_id: string;
  status: string;
  document_count: number;
  chunk_count: number;
}

export interface KnowledgeChunk {
  id: string;
  document_id: string;
  filename: string;
  chunk_index: number;
  content: string;
  score: number;
  page_number?: number | null;
  section?: string | null;
  retrieval_method?: string;
}

export interface ChatSession {
  id: string;
  workspace_id: string;
  title: string;
  mode: string;
}

export interface ChatAskResponse {
  session: ChatSession;
  answer: string;
  sources?: KnowledgeChunk[];
  references?: KnowledgeChunk[];
  chunks?: KnowledgeChunk[];
  citations?: KnowledgeChunk[];
  source_chunks?: KnowledgeChunk[];
  retrieved_chunks?: KnowledgeChunk[];
  model_name: string;
  use_knowledge_base: boolean;
}

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  email: string;
  username: string;
  role: WorkspaceRole;
  department?: string | null;
  status: string;
  joined_at: string;
}

export interface AuditLogRecord {
  id: string;
  workspace_id?: string | null;
  user_id?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface AdvancedOverview {
  workspace_id: string;
  document_count: number;
  chunk_count: number;
  member_count: number;
  audit_log_count: number;
  vector_status: string;
  graph_status: string;
  rerank_status: string;
  latest_activity_at?: string | null;
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: 'entity' | 'workspace' | 'document' | 'chunk' | 'concept' | 'keyword' | 'question' | string;
  weight: number;
  properties?: Record<string, string | number | boolean | null>;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  weight: number;
  properties?: Record<string, string | number | boolean | null>;
}

export interface KnowledgeGraph {
  enabled: boolean;
  status: 'ready' | 'empty' | 'disabled' | 'unavailable' | 'permission_denied' | string;
  message?: string | null;
  mode?: string;
  partial?: boolean;
  stats?: {
    workspace_id?: string | null;
    node_count: number;
    edge_count: number;
  };
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  links?: KnowledgeGraphEdge[];
}

export interface ToolStatus {
  key: string;
  label: string;
  status: string;
  description: string;
  endpoint?: string | null;
}

export interface AdvancedNotification {
  id: string;
  action: string;
  title: string;
  message: string;
  level: string;
  created_at: string;
}

export interface DeploymentStatus {
  key: string;
  label: string;
  status: string;
  value: string;
  description: string;
}

export interface WorkspaceSettingRecord {
  setting_key: string;
  setting_value: Record<string, unknown>;
  setting_type: string;
  encrypted: string;
}

export interface WorkspaceModelConnectionTestResult {
  ok: boolean;
  provider: string;
  model_name: string;
  message: string;
  response_preview?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface EmailCodeLoginInput {
  email: string;
  verification_code: string;
}

export interface RegisterInput extends LoginInput {
  username: string;
  verification_code: string;
}

export interface ResetPasswordInput {
  email: string;
  verification_code: string;
  new_password: string;
}

export type EmailCodePurpose = 'login' | 'register' | 'reset_password';
