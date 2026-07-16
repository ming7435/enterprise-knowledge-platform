import {
  Eye,
  EyeOff,
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
import { Button } from './ui/Button';
import { SegmentedControl } from './ui/FormControls';
import { IconButton } from './ui/IconButton';

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
    <main className="auth-page-dify">
      <a className="auth-page-brand" href="/" aria-label="企知云企业知识平台">
        <img src="/qizhiyun-logo.png" alt="" aria-hidden="true" />
        <span><strong>企知云</strong><small>企业知识平台</small></span>
      </a>

      <section className="auth-card" data-ui="auth-card" aria-label="账号入口">
        <header className="auth-brand">
          <div className="auth-brand-mark" aria-hidden="true">知</div>
          <div>
            <p>{isRegister ? '创建你的知识空间' : isResetPassword ? '恢复账号访问' : '欢迎回到企知云'}</p>
            <h1>{isRegister ? '注册账号' : isResetPassword ? '重置密码' : '登录企知云'}</h1>
          </div>
          <span>
            {isRegister
              ? '使用邮箱验证码完成注册，随后进入工作区选择页。'
              : isResetPassword
                ? '验证邮箱身份后设置新密码。'
                : '登录后选择个人或企业工作区，所有数据保持严格隔离。'}
          </span>
        </header>

        <SegmentedControl<'login' | 'register'>
          value={mode}
          options={[{ value: 'login', label: '登录' }, { value: 'register', label: '注册' }]}
          onChange={changeMode}
          ariaLabel="登录或注册"
          disabled={loading}
          className="auth-mode-segment"
        />

        <form className="auth-form-fields" onSubmit={handleSubmit}>
          {!isRegister && !isResetPassword ? (
            <SegmentedControl<AuthMethod>
              value={authMethod}
              options={[{ value: 'password', label: '密码登录' }, { value: 'emailCode', label: '验证码登录' }]}
              onChange={(method) => {
                setFormSuccess(null);
                setAuthMethod(method);
              }}
              ariaLabel="登录方式"
              disabled={loading}
              className="auth-method-segment"
            />
          ) : null}

          {isResetPassword ? (
            <button className="link-action mode-return" type="button" onClick={() => setAuthMethod('password')}>
              返回登录
            </button>
          ) : null}

          {isRegister ? (
            <label className="auth-field">
              <span>用户名</span>
              <div className="input-row">
                <UserPlus size={17} aria-hidden="true" />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="请输入 2-20 位用户名"
                  autoComplete="username"
                  aria-invalid={Boolean(errors.username)}
                />
              </div>
              {errors.username ? <small>{errors.username}</small> : null}
            </label>
          ) : null}

          <label className="auth-field">
            <span>邮箱</span>
            <div className="input-row">
              <Mail size={17} aria-hidden="true" />
              <input
                value={email}
                type="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
              />
            </div>
            {errors.email ? <small>{errors.email}</small> : null}
          </label>

          {needsVerificationCode ? (
            <label className="auth-field">
              <span>邮箱验证码</span>
              <div className="code-row">
                <div className="input-row">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <input
                    value={verificationCode}
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) => setVerificationCode(event.target.value)}
                    placeholder="6 位数字"
                    autoComplete="one-time-code"
                    aria-invalid={Boolean(errors.verification_code)}
                  />
                </div>
                <Button
                  size="sm"
                  icon={Send}
                  disabled={loading || codeSending || cooldown > 0}
                  loading={codeSending}
                  onClick={handleSendCode}
                >
                  {cooldown > 0 ? `${cooldown}s` : '发送验证码'}
                </Button>
              </div>
              {errors.verification_code ? <small>{errors.verification_code}</small> : null}
              {errors.send_code ? <small>{errors.send_code}</small> : null}
              {codeMessage ? <small className="form-success">{codeMessage}</small> : null}
            </label>
          ) : null}

          {needsPassword || isResetPassword ? (
            <label className="auth-field">
              <span>{passwordLabel}</span>
              <div className="input-row">
                <Lock size={17} aria-hidden="true" />
                <input
                  value={password}
                  type={showPassword ? 'text' : 'password'}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 8 位"
                  autoComplete={isRegister || isResetPassword ? 'new-password' : 'current-password'}
                  aria-invalid={Boolean(errors.password)}
                />
                <IconButton
                  icon={showPassword ? EyeOff : Eye}
                  label={showPassword ? '隐藏密码' : '显示密码'}
                  size="sm"
                  className="password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                />
              </div>
              {errors.password ? <small>{errors.password}</small> : null}
              {!isRegister && authMethod === 'password' ? (
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
              ) : null}
            </label>
          ) : null}

          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {formSuccess ? <p className="form-success" role="status">{formSuccess}</p> : null}

          <Button className="auth-submit" variant="primary" type="submit" icon={LogIn} loading={loading}>
            {isRegister
              ? '注册并进入'
              : isResetPassword
                ? '重置密码'
                : authMethod === 'emailCode'
                  ? '验证码登录'
                  : '登录'}
          </Button>
        </form>

        <footer className="auth-card-footer">
          个人工作区与企业工作区互不复制、导入或同步数据
        </footer>
      </section>
    </main>
  );
}
