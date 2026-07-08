import {
  Eye,
  EyeOff,
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
  RegisterInput,
  ResetPasswordInput
} from '../types';

type AuthMethod = 'password' | 'emailCode' | 'forgotPassword';

const USERNAME_PATTERN = /^[\u4e00-\u9fffA-Za-z0-9_-]{2,20}$/;

interface AuthFormsProps {
  mode: 'login' | 'register';
  loading: boolean;
  error: string | null;
  onModeChange: (mode: 'login' | 'register') => void;
  onLogin: (input: LoginInput) => Promise<void> | void;
  onEmailCodeLogin: (input: EmailCodeLoginInput) => Promise<void> | void;
  onRegister: (input: RegisterInput) => Promise<void> | void;
  onResetPassword: (input: ResetPasswordInput) => Promise<string> | string;
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
  onResetPassword,
  onSendEmailCode
}: AuthFormsProps) {
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [codeMessage, setCodeMessage] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [codeSending, setCodeSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const isRegister = mode === 'register';
  const isResetPassword = !isRegister && authMethod === 'forgotPassword';
  const needsVerificationCode = isRegister || authMethod === 'emailCode' || isResetPassword;
  const needsPassword = isRegister || authMethod === 'password';
  const passwordLabel = isResetPassword ? '新密码' : '密码';

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

  useEffect(() => {
    setFormSuccess(null);
  }, [mode]);

  function changeMode(nextMode: 'login' | 'register') {
    setAuthMethod('password');
    setFormSuccess(null);
    onModeChange(nextMode);
  }

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
      setFormSuccess(null);
      const purpose: EmailCodePurpose = isRegister
        ? 'register'
        : isResetPassword
          ? 'reset_password'
          : 'login';
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
    if (isRegister) {
      const cleanUsername = username.trim();
      if (!cleanUsername) {
        nextErrors.username = '请输入用户名';
      } else if (!USERNAME_PATTERN.test(cleanUsername)) {
        nextErrors.username = '用户名需为 2-20 个中文、英文、数字、下划线或中划线字符';
      }
    }
    if ((needsPassword || isResetPassword) && !password.trim()) nextErrors.password = '请输入密码';
    if (needsVerificationCode && !verificationCode.trim()) {
      nextErrors.verification_code = '请输入邮箱验证码';
    }
    setErrors(nextErrors);
    setFormSuccess(null);
    if (Object.keys(nextErrors).length > 0) return;

    if (isRegister) {
      await onRegister({
        email,
        username: username.trim(),
        password,
        verification_code: verificationCode
      });
      return;
    }

    if (authMethod === 'emailCode') {
      await onEmailCodeLogin({ email, verification_code: verificationCode });
      return;
    }

    if (isResetPassword) {
      const message = await onResetPassword({
        email,
        verification_code: verificationCode,
        new_password: password
      });
      setPassword('');
      setVerificationCode('');
      setAuthMethod('password');
      setFormSuccess(message);
      return;
    }

    await onLogin({ email, password });
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-label="账号入口">
        <div className="auth-copy">
          <img className="auth-logo" src="/qizhiyun-logo.png" alt="企知云" />
          <p className="eyebrow">企业知识平台</p>
          <h1>统一账号入口</h1>
          <p>登录后进入工作区选择页，个人空间与企业空间从第一步开始隔离。</p>
          <div className="auth-proof-grid" aria-label="平台能力概览">
            <article>
              <strong>Workspace</strong>
              <span>个人 / 企业双空间隔离</span>
            </article>
            <article>
              <strong>RAG</strong>
              <span>文档入库、检索、引用追溯</span>
            </article>
            <article>
              <strong>Graph</strong>
              <span>Neo4j 文件实体关系图谱</span>
            </article>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form-head">
            <p className="eyebrow">{isRegister ? '创建账号' : isResetPassword ? '安全重置' : '安全登录'}</p>
            <h2>{isRegister ? '注册企知云账号' : isResetPassword ? '找回访问权限' : '进入知识工作台'}</h2>
            <span>
              {isRegister
                ? '使用邮箱验证码完成注册，后续进入工作区选择页。'
                : isResetPassword
                  ? '通过邮箱验证码确认身份并设置新密码。'
                  : '支持密码和邮箱验证码两种登录方式。'}
            </span>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="认证方式">
            <button
              type="button"
              aria-label="切换到登录"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => changeMode('login')}
            >
              登录
            </button>
            <button
              type="button"
              aria-label="切换到注册"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => changeMode('register')}
            >
              注册
            </button>
          </div>

          {!isRegister && !isResetPassword && (
            <div className="auth-methods" aria-label="登录方式">
              <button
                type="button"
                className={authMethod === 'password' ? 'active' : ''}
                onClick={() => {
                  setFormSuccess(null);
                  setAuthMethod('password');
                }}
              >
                <Lock size={16} aria-hidden="true" />
                密码
              </button>
              <button
                type="button"
                className={authMethod === 'emailCode' ? 'active' : ''}
                onClick={() => {
                  setFormSuccess(null);
                  setAuthMethod('emailCode');
                }}
              >
                <KeyRound size={16} aria-hidden="true" />
                验证码
              </button>
            </div>
          )}

          {isResetPassword && (
            <button
              className="link-action mode-return"
              type="button"
              onClick={() => setAuthMethod('password')}
            >
              返回登录
            </button>
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

          {(needsPassword || isResetPassword) && (
            <label>
              <span>{passwordLabel}</span>
              <div className="input-row">
                <Lock size={18} aria-hidden="true" />
                <input
                  value={password}
                  type={showPassword ? 'text' : 'password'}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 8 位"
                  autoComplete={isRegister || isResetPassword ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  title={showPassword ? '隐藏密码' : '显示密码'}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              </div>
              {errors.password && <small>{errors.password}</small>}
              {!isRegister && authMethod === 'password' && (
                <button
                  className="link-action"
                  type="button"
                  onClick={() => {
                    setFormSuccess(null);
                    setAuthMethod('forgotPassword');
                  }}
                >
                  忘记密码？
                </button>
              )}
            </label>
          )}

          {error && <p className="form-error">{error}</p>}
          {formSuccess && <p className="form-success">{formSuccess}</p>}

          <button className="primary-action" type="submit" disabled={loading}>
            <LogIn size={18} aria-hidden="true" />
            {isRegister
              ? '注册并进入'
              : isResetPassword
                ? '重置密码'
              : authMethod === 'emailCode'
                ? '验证码登录'
                : '登录'}
          </button>
        </form>
      </section>
    </main>
  );
}
