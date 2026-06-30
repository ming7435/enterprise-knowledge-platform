import { useEffect, useState } from 'react';

import { api } from './api';
import { AuthForms } from './components/AuthForms';
import { WorkspaceSelection } from './components/WorkspaceSelection';
import { WorkspaceShell } from './components/WorkspaceShell';
import type {
  EmailCodeLoginInput,
  EmailCodePurpose,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  User,
  Workspace
} from './types';

const TOKEN_KEY = 'ekp_token';

export default function App() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY)
  );
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void loadSession(token);
  }, [token]);

  async function loadSession(nextToken: string) {
    try {
      setLoading(true);
      setError(null);
      const [nextUser, nextWorkspaces] = await Promise.all([
        api.me(nextToken),
        api.workspaces(nextToken)
      ]);
      setUser(nextUser);
      setWorkspaces(nextWorkspaces);
    } catch (err) {
      handleLogout();
      setError(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(input: LoginInput) {
    try {
      setLoading(true);
      setError(null);
      const response = await api.login(input);
      localStorage.setItem(TOKEN_KEY, response.access_token);
      setToken(response.access_token);
      await loadSession(response.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailCodeLogin(input: EmailCodeLoginInput) {
    try {
      setLoading(true);
      setError(null);
      const response = await api.emailCodeLogin(input);
      localStorage.setItem(TOKEN_KEY, response.access_token);
      setToken(response.access_token);
      await loadSession(response.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码登录失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendEmailCode(email: string, purpose: EmailCodePurpose) {
    setError(null);
    const response = await api.sendEmailCode(email, purpose);
    return response.message;
  }

  async function handleRegister(input: RegisterInput) {
    try {
      setLoading(true);
      setError(null);
      await api.register(input);
      await handleLogin({ email: input.email, password: input.password });
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(input: ResetPasswordInput) {
    try {
      setLoading(true);
      setError(null);
      const response = await api.resetPassword(input);
      setMode('login');
      return response.message;
    } catch (err) {
      setError(err instanceof Error ? err.message : '密码重置失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateEnterprise(name: string, description: string) {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const workspace = await api.createEnterprise(token, name, description);
      const nextWorkspaces = [...workspaces, workspace];
      setWorkspaces(nextWorkspaces);
      setSelectedWorkspace(workspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建企业工作区失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePersonal() {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const workspace = await api.createPersonal(token);
      const nextWorkspaces = [...workspaces, workspace];
      setWorkspaces(nextWorkspaces);
      setSelectedWorkspace(workspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建个人工作区失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteWorkspace(workspace: Workspace) {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      await api.deleteWorkspace(token, workspace.id);
      const nextWorkspaces = workspaces.filter((item) => item.id !== workspace.id);
      setWorkspaces(nextWorkspaces);
      if (selectedWorkspace?.id === workspace.id) {
        setSelectedWorkspace(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除工作区失败');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setWorkspaces([]);
    setSelectedWorkspace(null);
  }

  if (!token || !user) {
    return (
      <AuthForms
        mode={mode}
        loading={loading}
        error={error}
        onModeChange={setMode}
        onLogin={handleLogin}
        onEmailCodeLogin={handleEmailCodeLogin}
        onRegister={handleRegister}
        onResetPassword={handleResetPassword}
        onSendEmailCode={handleSendEmailCode}
      />
    );
  }

  if (!selectedWorkspace) {
    return (
      <WorkspaceSelection
        user={user}
        workspaces={workspaces}
        loading={loading}
        error={error}
        onSelect={setSelectedWorkspace}
        onCreatePersonal={handleCreatePersonal}
        onCreateEnterprise={handleCreateEnterprise}
        onDeleteWorkspace={handleDeleteWorkspace}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <WorkspaceShell
      token={token}
      user={user}
      workspace={selectedWorkspace}
      onBackToWorkspaces={() => setSelectedWorkspace(null)}
      onLogout={handleLogout}
    />
  );
}
