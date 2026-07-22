import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save, Trash2, UserPlus, Users } from 'lucide-react';

import { getMemberDisplayName, maskEmail } from '../../display';
import type { WorkspaceMember, WorkspaceRole } from '../../types';
import { Button } from '../ui/Button';
import { DataTable } from '../ui/DataTable';
import { EmptyState, ErrorState, LoadingState, PermissionDenied } from '../ui/AsyncState';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge } from '../ui/StatusBadge';
import { EnterpriseIsolationNotice, Feedback, formatDate, roleLabel, SectionHeader } from './shared';
import type { EnterpriseSharedProps } from './types';

const ROLE_OPTIONS: Array<{ value: WorkspaceRole; label: string }> = [
  { value: 'admin', label: '管理员' },
  { value: 'member', label: '成员' },
  { value: 'viewer', label: '只读' },
];

export interface EnterpriseMembersProps extends EnterpriseSharedProps {
  saving: boolean;
  actionMemberId: string | null;
  email: string;
  department: string;
  role: WorkspaceRole;
  canManageMembers: boolean;
  canGrantAdmin: boolean;
  onEmailChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onRoleChange: (value: WorkspaceRole) => void;
  onAddMember: () => void;
  onUpdateRole: (member: WorkspaceMember, role: WorkspaceRole) => void;
  onUpdateDepartment: (member: WorkspaceMember, department: string) => void;
  onRemoveMember: (member: WorkspaceMember) => void;
  onRefresh: () => void;
}

export function EnterpriseMembers({
  user,
  workspace,
  members,
  loading,
  error,
  notice,
  saving,
  actionMemberId,
  email,
  department,
  role,
  canManageMembers,
  canGrantAdmin,
  onEmailChange,
  onDepartmentChange,
  onRoleChange,
  onAddMember,
  onUpdateRole,
  onUpdateDepartment,
  onRemoveMember,
  onRefresh,
}: EnterpriseMembersProps) {
  const [departmentDrafts, setDepartmentDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setDepartmentDrafts(Object.fromEntries(members.map((item) => [item.id, item.department || ''])));
  }, [members]);

  const roleOptions = useMemo(
    () => canGrantAdmin ? ROLE_OPTIONS : ROLE_OPTIONS.filter((item) => item.value !== 'admin'),
    [canGrantAdmin]
  );

  if (!canManageMembers) {
    return (
      <section className="personal-workbench-v2 enterprise-workbench-v2">
        <PageHeader eyebrow="企业工作区" title="成员与权限" description="查看和管理当前企业成员。" />
        <EnterpriseIsolationNotice />
        <PermissionDenied title="无权查看成员管理" description="只有企业所有者和管理员可以查看或修改成员。" />
      </section>
    );
  }

  return (
    <section className="personal-workbench-v2 enterprise-workbench-v2 personal-page-members">
      <PageHeader eyebrow="企业工作区" title="成员与权限" description={`管理 ${workspace.name} 的成员、角色和部门。`} actions={<Button icon={RefreshCw} loading={loading} onClick={onRefresh}>刷新成员</Button>} />
      <EnterpriseIsolationNotice />
      <Feedback error={error} notice={notice} />
      {error && !members.length ? <ErrorState title="成员数据加载失败" description={error} onRetry={onRefresh} /> : null}
      {loading && !members.length ? <LoadingState label="正在加载企业成员" /> : null}

      <section className="personal-section">
        <SectionHeader title="添加已有用户" description="对方必须先完成账号注册；成员只会加入当前企业工作区。" />
        <div className="enterprise-member-form">
          <label><span>用户邮箱</span><input type="email" value={email} placeholder="name@example.com" onChange={(event) => onEmailChange(event.target.value)} /></label>
          <label><span>部门</span><input value={department} placeholder="例如：研发部" onChange={(event) => onDepartmentChange(event.target.value)} /></label>
          <label><span>角色</span><select value={role} onChange={(event) => onRoleChange(event.target.value as WorkspaceRole)}>{roleOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <Button variant="primary" icon={UserPlus} loading={saving} disabled={!email.trim()} onClick={onAddMember}>添加成员</Button>
        </div>
      </section>

      <section className="personal-section">
        <SectionHeader title="成员列表" description={`${members.length} 名有效成员 · 管理员不能修改其他管理员`} />
        {members.length ? (
          <DataTable<WorkspaceMember>
            rows={members}
            rowKey={(item) => item.id}
            emptyText="当前企业暂无成员"
            columns={[
              { key: 'member', label: '成员', render: (item) => <div className="enterprise-member-identity"><span className="enterprise-member-avatar"><Users size={16} /></span><div><strong>{getMemberDisplayName(item)}</strong><small>{maskEmail(item.email)}</small></div></div> },
              {
                key: 'role', label: '角色', width: '150px', render: (item) => {
                  const isSelf = item.user_id === user.id;
                  const editable = item.role !== 'owner' && !isSelf && (canGrantAdmin || item.role !== 'admin');
                  return editable ? (
                    <select aria-label={`修改 ${getMemberDisplayName(item)} 的角色`} value={item.role} disabled={actionMemberId === item.id} onChange={(event) => onUpdateRole(item, event.target.value as WorkspaceRole)}>
                      {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : <StatusBadge status={item.role} label={roleLabel(item.role)} />;
                },
              },
              {
                key: 'department', label: '部门', width: '220px', render: (item) => {
                  const isSelf = item.user_id === user.id;
                  const editable = item.role !== 'owner' && !isSelf && (canGrantAdmin || item.role !== 'admin');
                  return editable ? (
                    <div className="enterprise-department-editor">
                      <input value={departmentDrafts[item.id] ?? ''} disabled={actionMemberId === item.id} onChange={(event) => setDepartmentDrafts((current) => ({ ...current, [item.id]: event.target.value }))} aria-label={`${getMemberDisplayName(item)} 的部门`} />
                      <Button size="sm" variant="ghost" icon={Save} disabled={actionMemberId === item.id || (departmentDrafts[item.id] ?? '') === (item.department || '')} onClick={() => onUpdateDepartment(item, departmentDrafts[item.id] ?? '')}>保存</Button>
                    </div>
                  ) : <span>{item.department || '未设置'}</span>;
                },
              },
              { key: 'joined', label: '加入时间', width: '170px', render: (item) => formatDate(item.joined_at) },
              { key: 'status', label: '状态', width: '90px', render: (item) => <StatusBadge status={item.status} /> },
              {
                key: 'actions', label: '操作', width: '110px', render: (item) => {
                  const isSelf = item.user_id === user.id;
                  const editable = item.role !== 'owner' && !isSelf && (canGrantAdmin || item.role !== 'admin');
                  return <Button size="sm" variant="danger" icon={Trash2} disabled={!editable || actionMemberId === item.id} title={!editable ? '不能移除所有者、自己或同级管理员' : undefined} onClick={() => onRemoveMember(item)}>移除</Button>;
                },
              },
            ]}
          />
        ) : <EmptyState title="当前企业暂无成员" description="添加已注册用户后，其数据访问范围只限当前企业工作区。" icon={Users} />}
      </section>
    </section>
  );
}
