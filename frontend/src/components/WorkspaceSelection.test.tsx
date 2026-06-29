import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WorkspaceSelection } from './WorkspaceSelection';
import type { User, Workspace } from '../types';

const user: User = {
  id: 'u1',
  email: 'owner@example.com',
  username: 'Owner',
  status: 'active'
};

const workspaces: Workspace[] = [
  {
    id: 'personal',
    name: 'Owner 的个人工作区',
    type: 'personal',
    status: 'active',
    role: 'owner'
  },
  {
    id: 'enterprise',
    name: '明途科技',
    type: 'enterprise',
    status: 'active',
    role: 'owner'
  }
];

describe('WorkspaceSelection', () => {
  it('渲染个人工作区和企业工作区', () => {
    render(
      <WorkspaceSelection
        user={user}
        workspaces={workspaces}
        loading={false}
        error={null}
        onSelect={vi.fn()}
        onCreateEnterprise={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByText('Owner 的个人工作区')).toBeInTheDocument();
    expect(screen.getByText('明途科技')).toBeInTheDocument();
    expect(screen.getByText('创建企业工作区')).toBeInTheDocument();
  });
});
