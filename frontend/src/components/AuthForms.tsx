import {
  KeyRound,
  Lock,
  LogIn,
  Mail,
  Send,
  ShieldCheck,
  UserPlus
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';

import type {
  EmailCodeLoginInput,
  EmailCodePurpose,
  LoginInput,
  RegisterInput
} from '../types';

type AuthMethod = 'password' | 'emailCode';

interface AuthFormsProps {
  mode: 'login' | 'register';
  loading: boolean;
  error: string | null;
  onModeChange: (mode: 'login' | 'register') => void;
  onLogin: (input: LoginInput) => Promise<void> | void;
  onEmailCodeLogin: (input: EmailCodeLoginInput) => Promise<void> | void;
  onRegister: (input: RegisterInput) => Promise<void> | void;
  onSendEmailCode: (
    email: string,
    purpose: EmailCodePurpose
  ) => Promise<string> | string;
}

interface FormErrors {
  email?: string;
  username?: string;
  password?: string;
  verification_code?: string;
  send_code?: string;
}

export function AuthForms({
  mode,
  loading,
  error,
  onModeChange,
  onLogin,
  onEmailCodeLogin,
  onRegister,
  onSendEmailCode
}: AuthFormsProps) {
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [codeMessage, setCodeMessage] = useState<string | null>(null);
  const [codeSending, setCodeSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const isRegister = mode === 'register';
  const needsVerificationCode = isRegister || authMethod === 'emailCode';
  const needsPassword = isRegister || authMethod === 'password';

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    setErrors({});
    setCodeMessage(null);
    setVerificationCode('');
  }, [mode, authMethod]);

  function validateEmailOnly() {
    if (!email.trim()) {
      setErrors({ email: '请输入邮箱' });
      return false;
    }
    setErrors({});
    return true;
  }

  async function handleSendCode() {
    if (!validateEmailOnly()) return;
    try {
      setCodeSending(true);
      setCodeMessage(null);
      const purpose: EmailCodePurpose = isRegister ? 'register' : 'login';
      const message = await onSendEmailCode(email, purpose);
      setCodeMessage(message);
      setCooldown(60);
    } catch (err) {
      setErrors({
        send_code: err instanceof Error ? err.message : '验证码发送失败'
      });
    } finally {
      setCodeSending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    if (!email.trim()) nextErrors.email = '请输入邮箱';
    if (isRegister && !username.trim()) nextErrors.username = '请输入用户名';
    if (needsPassword && !password.trim()) nextErrors.password = '请输入密码';
    if (needsVerificationCode && !verificationCode.trim()) {
      nextErrors.verification_code = '请输入邮箱验证码';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (isRegister) {
      await onRegister({
        email,
        username,
        password,
        verification_code: verificationCode
      });
      return;
    }

    if (authMethod === 'emailCode') {
      await onEmailCodeLogin({ email, verification_code: verificationCode });
      return;
    }

    await onLogin({ email, password });
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-label="账号入口">
        <div className="auth-copy">
          <p className="eyebrow">企业知识平台</p>
          <h1>统一账号入口</h1>
          <p>登录后进入工作区选择页，个人空间与企业空间从第一步开始隔离。</p>
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

          {!isRegister && (
            <div className="auth-methods" aria-label="登录方式">
              <button
                type="button"
                className={authMethod === 'password' ? 'active' : ''}
                onClick={() => setAuthMethod('password')}
              >
                <Lock size={16} aria-hidden="true" />
                密码
              </button>
              <button
                type="button"
                className={authMethod === 'emailCode' ? 'active' : ''}
                onClick={() => setAuthMethod('emailCode')}
              >
                <KeyRound size={16} aria-hidden="true" />
                验证码
              </button>
            </div>
          )}

          {isRegister && (
            <label>
              <span>用户名</span>
              <div className="input-row">
                <UserPlus size={18} aria-hidden="true" />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="例如：Owner"
                  autoComplete="username"
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
                autoComplete="email"
              />
            </div>
            {errors.email && <small>{errors.email}</small>}
          </label>

          {needsVerificationCode && (
            <label>
              <span>邮箱验证码</span>
              <div className="code-row">
                <div className="input-row">
                  <ShieldCheck size={18} aria-hidden="true" />
                  <input
                    value={verificationCode}
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) => setVerificationCode(event.target.value)}
                    placeholder="6 位数字"
                    autoComplete="one-time-code"
                  />
                </div>
                <button
                  type="button"
                  className="secondary-action"
                  disabled={loading || codeSending || cooldown > 0}
                  onClick={handleSendCode}
                >
                  <Send size={16} aria-hidden="true" />
                  {cooldown > 0 ? `${cooldown}s` : '发送'}
                </button>
              </div>
              {errors.verification_code && <small>{errors.verification_code}</small>}
              {errors.send_code && <small>{errors.send_code}</small>}
              {codeMessage && <small className="form-success">{codeMessage}</small>}
            </label>
          )}

          {needsPassword && (
            <label>
              <span>密码</span>
              <div className="input-row">
                <Lock size={18} aria-hidden="true" />
                <input
                  value={password}
                  type="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 8 位"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                />
              </div>
              {errors.password && <small>{errors.password}</small>}
            </label>
          )}

          {error && <p className="form-error">{error}</p>}

          <button className="primary-action" type="submit" disabled={loading}>
            <LogIn size={18} aria-hidden="true" />
            {isRegister
              ? '注册并进入'
              : authMethod === 'emailCode'
                ? '验证码登录'
                : '登录'}
          </button>
        </form>
      </section>
    </main>
  );
}
