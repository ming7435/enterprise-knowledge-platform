import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WorkspaceShell } from './WorkspaceShell';
import type { User, Workspace } from '../types';

const user: User = {
  id: 'u1',
  email: 'owner@example.com',
  username: 'Owner',
  status: 'active'
};

const workspace: Workspace = {
  id: 'enterprise',
  name: '明途科技',
  type: 'enterprise',
  status: 'active',
  role: 'owner'
};

describe('WorkspaceShell', () => {
  it('显示当前工作区上下文和企业导航', () => {
    render(
      <WorkspaceShell
        user={user}
        workspace={workspace}
        onBackToWorkspaces={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByText('明途科技')).toBeInTheDocument();
    expect(screen.getByText('企业工作区')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '成员' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '审计日志' })).toBeInTheDocument();
  });
});
