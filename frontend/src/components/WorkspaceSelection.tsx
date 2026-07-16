import {
  ArrowRight,
  Building2,
  LogOut,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

import { formatBeijingDateTime } from '../time';
import type { User, Workspace } from '../types';
import { Button } from './ui/Button';
import { ConfirmDialog, Modal } from './ui/Overlay';

interface WorkspaceSelectionProps {
  user: User;
  workspaces: Workspace[];
  loading: boolean;
  error: string | null;
  onSelect: (workspace: Workspace) => void;
  onCreatePersonal: () => Promise<void> | void;
  onCreateEnterprise: (name: string, description: string) => Promise<void> | void;
  onDeleteWorkspace: (workspace: Workspace) => Promise<void> | void;
  onLogout: () => void;
}

export function WorkspaceSelection({
  user,
  workspaces,
  loading,
  error,
  onSelect,
  onCreatePersonal,
  onCreateEnterprise,
  onDeleteWorkspace,
  onLogout,
}: WorkspaceSelectionProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [createEnterpriseOpen, setCreateEnterpriseOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Workspace | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const personal = useMemo(
    () => workspaces.filter((workspace) => workspace.type === 'personal'),
    [workspaces],
  );
  const enterprises = useMemo(
    () => workspaces.filter((workspace) => workspace.type === 'enterprise'),
    [workspaces],
  );
  const createBusy = createSubmitting || loading;

  function closeCreateModal() {
    if (createBusy) return;
    setCreateEnterpriseOpen(false);
    setLocalError(null);
    setName('');
    setDescription('');
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setLocalError('请输入企业名称');
      return;
    }
    setLocalError(null);
    try {
      setCreateSubmitting(true);
      await onCreateEnterprise(name.trim(), description.trim());
      setName('');
      setDescription('');
      setCreateEnterpriseOpen(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : '创建企业工作区失败');
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await onDeleteWorkspace(pendingDelete);
      setPendingDelete(null);
      setDeleteError(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error && err.message.trim()
          ? `删除工作区失败：${err.message}`
          : '删除工作区失败，请稍后重试。',
      );
    }
  }

  function closeDeleteDialog() {
    setPendingDelete(null);
    setDeleteError(null);
  }

  function renderWorkspaceCard(workspace: Workspace) {
    const personalWorkspace = workspace.type === 'personal';
    const Icon = personalWorkspace ? UserRound : Building2;
    const metadata = workspaceMetadata(workspace);
    return (
      <article className="workspace-choice-card" key={workspace.id}>
        <div className={`workspace-choice-icon ${workspace.type}`}>
          <Icon size={20} aria-hidden="true" />
        </div>
        <div className="workspace-choice-copy">
          <div>
            <span>{personalWorkspace ? '个人工作区' : '企业工作区'}</span>
            <strong>{workspace.name}</strong>
          </div>
          <p>{workspace.description || (personalWorkspace ? '个人文档、知识库、问答和知识图谱。' : '企业知识、成员权限、问答与审计能力。')}</p>
          <small>角色：{roleLabel(workspace.role)} · 状态：{workspaceStatusLabel(workspace.status)}</small>
          <div className="workspace-choice-metadata">
            <span>最近更新：{metadata.updatedAt}</span>
            <span>文档数：{metadata.documentCount}</span>
          </div>
        </div>
        <div className="workspace-choice-actions">
          <Button variant="primary" size="sm" icon={ArrowRight} disabled={loading} onClick={() => onSelect(workspace)}>
            进入工作区
          </Button>
          {workspace.role === 'owner' ? (
            <details className="workspace-choice-menu">
              <summary aria-label={`打开 ${workspace.name} 操作菜单`} title="更多操作">
                <MoreHorizontal size={17} aria-hidden="true" />
              </summary>
              <div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={(event) => {
                    event.currentTarget.closest('details')?.removeAttribute('open');
                    setDeleteError(null);
                    setPendingDelete(workspace);
                  }}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  删除工作区
                </button>
              </div>
            </details>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <main className="workspace-selection-page">
      <header className="workspace-selection-header">
        <a className="workspace-selection-brand" href="/" aria-label="企知云企业知识平台">
          <img src="/qizhiyun-logo.png" alt="" aria-hidden="true" />
          <span><strong>企知云</strong><small>企业知识平台</small></span>
        </a>
        <div className="workspace-selection-user">
          <span>{user.username.slice(0, 1).toUpperCase()}</span>
          <div><strong>{user.username}</strong><small>{user.email}</small></div>
          <Button variant="ghost" size="sm" icon={LogOut} onClick={onLogout}>退出</Button>
        </div>
      </header>

      <div className="workspace-selection-main">
        <section className="workspace-selection-intro">
          <div>
            <p>工作区选择</p>
            <h1>从一个独立空间开始工作</h1>
            <span>选择个人或企业工作区。每个空间都拥有独立的文档、知识片段、向量索引、问答历史和图谱资产。</span>
          </div>
          <div className="workspace-isolation-note">
            <ShieldCheck size={20} aria-hidden="true" />
            <div>
              <strong>空间数据严格隔离</strong>
              <span>个人与企业数据不跨空间同步、复制、导入或共享。</span>
            </div>
          </div>
        </section>

        {error ? <p className="form-error workspace-selection-error" role="alert">{error}</p> : null}

        <div className="workspace-selection-grid">
          <section className="workspace-list-panel">
            <div className="workspace-list-heading">
              <div><h2>你的工作区</h2><span>共 {workspaces.length} 个可访问空间</span></div>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                disabled={loading}
                onClick={() => {
                  setLocalError(null);
                  setCreateEnterpriseOpen(true);
                }}
              >
                新建企业工作区
              </Button>
            </div>

            <div className="workspace-list-group">
              <div className="workspace-group-label"><UserRound size={16} aria-hidden="true" /><span>个人工作区</span><small>{personal.length}</small></div>
              {personal.length > 0 ? personal.map(renderWorkspaceCard) : (
                <div className="workspace-empty-card">
                  <strong>还没有个人工作区</strong>
                  <span>创建后可管理仅自己可见的文档、问答和知识图谱。</span>
                  <Button variant="primary" size="sm" icon={Plus} disabled={loading} onClick={() => void onCreatePersonal()}>
                    创建个人空间
                  </Button>
                </div>
              )}
            </div>

            <div className="workspace-list-group">
              <div className="workspace-group-label"><Building2 size={16} aria-hidden="true" /><span>企业工作区</span><small>{enterprises.length}</small></div>
              {enterprises.length > 0 ? enterprises.map(renderWorkspaceCard) : (
                <div className="workspace-empty-card compact"><strong>还没有企业工作区</strong><span>点击“新建企业工作区”创建独立企业空间。</span></div>
              )}
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={createEnterpriseOpen}
        title="新建企业工作区"
        description="为企业知识、成员权限和审计记录创建独立空间。"
        closeDisabled={createBusy}
        onClose={closeCreateModal}
        footer={
          <>
            <Button disabled={createBusy} onClick={closeCreateModal}>取消</Button>
            <Button
              variant="primary"
              type="submit"
              form="create-enterprise-workspace-form"
              icon={Plus}
              loading={createBusy}
            >
              创建并进入
            </Button>
          </>
        }
      >
        <form id="create-enterprise-workspace-form" className="create-workspace-modal-form" onSubmit={handleCreate}>
          <label>
            <span>企业名称</span>
            <input data-autofocus value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：明途科技" />
          </label>
          <label>
            <span>空间说明</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="说明这个企业知识空间的用途" />
          </label>
          {(localError || error) ? <p className="form-error" role="alert">{localError || error}</p> : null}
          <p className="create-workspace-tip">创建者将成为企业工作区所有者，可继续配置成员权限。</p>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="删除工作区"
        description={`确认删除“${pendingDelete?.name ?? ''}”吗？工作区内文档、知识片段和会话记录会一并删除，此操作不可撤销。`}
        error={deleteError ?? undefined}
        confirmLabel="确认删除"
        danger
        busy={loading}
        onConfirm={() => void confirmDelete()}
        onClose={closeDeleteDialog}
      />
    </main>
  );
}

function roleLabel(role?: string | null) {
  const labels: Record<string, string> = {
    owner: '所有者',
    admin: '管理员',
    member: '成员',
    viewer: '只读',
  };
  return labels[role || ''] || '成员';
}

function workspaceStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    active: '可用',
    ready: '可用',
    disabled: '已停用',
    pending: '准备中',
  };
  return labels[status || ''] || '可用';
}

function workspaceMetadata(workspace: Workspace) {
  return {
    updatedAt: formatBeijingDateTime(workspace.updated_at),
    documentCount: String(workspace.document_count),
  };
}
