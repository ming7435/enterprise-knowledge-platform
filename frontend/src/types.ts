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
  filename: string;
  file_type: string;
  file_path?: string | null;
  parse_status: string;
  index_status: string;
  chunk_count: number;
  permission_scope: string;
  created_at: string;
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
  sources: KnowledgeChunk[];
  model_name: string;
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
