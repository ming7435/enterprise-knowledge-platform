import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AuthForms } from './AuthForms';

describe('AuthForms', () => {
  it('登录表单会校验必填字段', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();

    render(
      <AuthForms
        mode="login"
        loading={false}
        error={null}
        onModeChange={vi.fn()}
        onLogin={onLogin}
        onRegister={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: '登录' }));

    expect(screen.getByText('请输入邮箱')).toBeInTheDocument();
    expect(screen.getByText('请输入密码')).toBeInTheDocument();
    expect(onLogin).not.toHaveBeenCalled();
  });
});
