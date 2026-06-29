import { Lock, LogIn, Mail, UserPlus } from 'lucide-react';
import { FormEvent, useState } from 'react';

import type { LoginInput, RegisterInput } from '../types';

interface AuthFormsProps {
  mode: 'login' | 'register';
  loading: boolean;
  error: string | null;
  onModeChange: (mode: 'login' | 'register') => void;
  onLogin: (input: LoginInput) => Promise<void> | void;
  onRegister: (input: RegisterInput) => Promise<void> | void;
}

interface FormErrors {
  email?: string;
  username?: string;
  password?: string;
}

export function AuthForms({
  mode,
  loading,
  error,
  onModeChange,
  onLogin,
  onRegister
}: AuthFormsProps) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const isRegister = mode === 'register';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    if (!email.trim()) nextErrors.email = '请输入邮箱';
    if (isRegister && !username.trim()) nextErrors.username = '请输入用户名';
    if (!password.trim()) nextErrors.password = '请输入密码';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (isRegister) {
      await onRegister({ email, username, password });
    } else {
      await onLogin({ email, password });
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-label="账号入口">
        <div className="auth-copy">
          <p className="eyebrow">企业知识平台</p>
          <h1>统一账号入口</h1>
          <p>
            登录后进入工作区选择页，个人空间与企业空间从第一步开始隔离。
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-tabs" role="tablist" aria-label="认证方式">
            <button
              type="button"
              aria-label="切换到登录"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => onModeChange('login')}
            >
              登录
            </button>
            <button
              type="button"
              aria-label="切换到注册"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => onModeChange('register')}
            >
              注册
            </button>
          </div>

          {isRegister && (
            <label>
              <span>用户名</span>
              <div className="input-row">
                <UserPlus size={18} aria-hidden="true" />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="例如：Owner"
                />
              </div>
              {errors.username && <small>{errors.username}</small>}
            </label>
          )}

          <label>
            <span>邮箱</span>
            <div className="input-row">
              <Mail size={18} aria-hidden="true" />
              <input
                value={email}
                type="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="owner@example.com"
              />
            </div>
            {errors.email && <small>{errors.email}</small>}
          </label>

          <label>
            <span>密码</span>
            <div className="input-row">
              <Lock size={18} aria-hidden="true" />
              <input
                value={password}
                type="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 8 位"
              />
            </div>
            {errors.password && <small>{errors.password}</small>}
          </label>

          {error && <p className="form-error">{error}</p>}

          <button className="primary-action" type="submit" disabled={loading}>
            <LogIn size={18} aria-hidden="true" />
            {isRegister ? '注册并进入' : '登录'}
          </button>
        </form>
      </section>
    </main>
  );
}
