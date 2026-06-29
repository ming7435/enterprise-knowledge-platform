import { Building2, LogOut, Plus, UserRound } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

import type { User, Workspace } from '../types';

interface WorkspaceSelectionProps {
  user: User;
  workspaces: Workspace[];
  loading: boolean;
  error: string | null;
  onSelect: (workspace: Workspace) => void;
  onCreateEnterprise: (name: string, description: string) => Promise<void> | void;
  onLogout: () => void;
}

export function WorkspaceSelection({
  user,
  workspaces,
  loading,
  error,
  onSelect,
  onCreateEnterprise,
  onLogout
}: WorkspaceSelectionProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const personal = useMemo(
    () => workspaces.filter((workspace) => workspace.type === 'personal'),
    [workspaces]
  );
  const enterprises = useMemo(
    () => workspaces.filter((workspace) => workspace.type === 'enterprise'),
    [workspaces]
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setLocalError('请输入企业名称');
      return;
    }
    setLocalError(null);
    await onCreateEnterprise(name.trim(), description.trim());
    setName('');
    setDescription('');
  }

  return (
    <main className="workspace-page">
      <header className="workspace-topbar">
        <div>
          <p className="eyebrow">工作区选择</p>
          <h1>你好，{user.username}</h1>
        </div>
        <button className="ghost-button" onClick={onLogout}>
          <LogOut size={18} aria-hidden="true" />
          退出登录
        </button>
      </header>

      {(error || localError) && <p className="form-error">{error || localError}</p>}

      <section className="workspace-grid">
        <div className="workspace-column">
          <h2>个人工作区</h2>
          {personal.map((workspace) => (
            <article className="workspace-card" key={workspace.id}>
              <div className="card-icon personal">
                <UserRound size={22} aria-hidden="true" />
              </div>
              <div>
                <h3>{workspace.name}</h3>
                <p>个人文档、知识库、问答和工具记录。</p>
              </div>
              <button onClick={() => onSelect(workspace)}>进入</button>
            </article>
          ))}
        </div>

        <div className="workspace-column">
          <h2>企业工作区</h2>
          {enterprises.length === 0 && (
            <p className="empty-state">还没有加入企业工作区。</p>
          )}
          {enterprises.map((workspace) => (
            <article className="workspace-card" key={workspace.id}>
              <div className="card-icon enterprise">
                <Building2 size={22} aria-hidden="true" />
              </div>
              <div>
                <h3>{workspace.name}</h3>
                <p>{workspace.description || '企业文档、权限、审计和知识库。'}</p>
              </div>
              <button onClick={() => onSelect(workspace)}>进入</button>
            </article>
          ))}
        </div>

        <form className="create-enterprise" onSubmit={handleCreate}>
          <h2>新建企业工作区</h2>
          <label>
            <span>企业名称</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：明途科技"
            />
          </label>
          <label>
            <span>说明</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="企业知识库、权限、审计等能力从这里开始。"
            />
          </label>
          <button className="primary-action" type="submit" disabled={loading}>
            <Plus size={18} aria-hidden="true" />
            创建企业工作区
          </button>
        </form>
      </section>
    </main>
  );
}
