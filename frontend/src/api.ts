import type {
  DocumentRecord,
  EmailCodeLoginInput,
  EmailCodePurpose,
  KnowledgeChunk,
  KnowledgeBaseStatus,
  LoginInput,
  RegisterInput,
  User,
  Workspace
} from './types';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:9520';

interface TokenResponse {
  access_token: string;
  token_type: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: '请求失败' }));
    throw new Error(payload.detail ?? '请求失败');
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export const api = {
  register(input: RegisterInput) {
    return request<{ user: User; personal_workspace: Workspace }>(
      '/api/v1/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(input)
      }
    );
  },
  login(input: LoginInput) {
    return request<TokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },
  sendEmailCode(email: string, purpose: EmailCodePurpose) {
    return request<{ message: string }>('/api/v1/auth/email-code/send', {
      method: 'POST',
      body: JSON.stringify({ email, purpose })
    });
  },
  emailCodeLogin(input: EmailCodeLoginInput) {
    return request<TokenResponse>('/api/v1/auth/email-code/login', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },
  me(token: string) {
    return request<User>('/api/v1/auth/me', {}, token);
  },
  workspaces(token: string) {
    return request<Workspace[]>('/api/v1/workspaces', {}, token);
  },
  createEnterprise(token: string, name: string, description: string) {
    return request<Workspace>(
      '/api/v1/workspaces/enterprise',
      {
        method: 'POST',
        body: JSON.stringify({ name, description })
      },
      token
    );
  },
  documents(token: string, workspaceId: string) {
    return request<DocumentRecord[]>(
      `/api/v1/workspaces/${workspaceId}/documents`,
      {},
      token
    );
  },
  knowledgeBase(token: string, workspaceId: string) {
    return request<KnowledgeBaseStatus>(
      `/api/v1/workspaces/${workspaceId}/knowledge-base`,
      {},
      token
    );
  },
  knowledgeChunks(token: string, workspaceId: string, limit = 10) {
    return request<KnowledgeChunk[]>(
      `/api/v1/workspaces/${workspaceId}/knowledge-base/chunks?limit=${limit}`,
      {},
      token
    );
  },
  searchKnowledge(token: string, workspaceId: string, query: string, limit = 10) {
    const params = new URLSearchParams({
      query,
      limit: String(limit)
    });
    return request<KnowledgeChunk[]>(
      `/api/v1/workspaces/${workspaceId}/knowledge-base/search?${params.toString()}`,
      {},
      token
    );
  },
  uploadDocument(token: string, workspaceId: string, file: File) {
    const formData = new FormData();
    formData.set('file', file);
    formData.set('permission_scope', 'workspace');
    return request<DocumentRecord>(
      `/api/v1/workspaces/${workspaceId}/documents/upload`,
      {
        method: 'POST',
        body: formData
      },
      token
    );
  },
  deleteDocument(token: string, workspaceId: string, documentId: string) {
    return request<void>(
      `/api/v1/workspaces/${workspaceId}/documents/${documentId}`,
      {
        method: 'DELETE'
      },
      token
    );
  }
};
