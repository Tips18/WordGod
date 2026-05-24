import type { EmailCodePurpose } from '@word-god/contracts';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

export type AuthFormMode = 'password-login' | 'code-login' | 'register' | 'reset-password';

export interface AuthFormValues {
  email: string;
  password: string;
  emailCode: string;
  rememberLogin: boolean;
}

interface AuthFormCardProps {
  title: string;
  submitLabel: string;
  hint: string;
  initialMode?: AuthFormMode;
  onSendEmailCode: (email: string, purpose: EmailCodePurpose) => Promise<void>;
  onSubmit: (values: AuthFormValues, mode: AuthFormMode) => Promise<void>;
}

/**
 * `getCodePurpose` 根据当前认证模式判断验证码的业务用途。
 */
function getCodePurpose(currentMode: AuthFormMode): EmailCodePurpose | null {
  if (currentMode === 'register') {
    return 'register';
  }

  if (currentMode === 'code-login') {
    return 'login';
  }

  if (currentMode === 'reset-password') {
    return 'reset-password';
  }

  return null;
}

/**
 * `AuthFormCard` 渲染登录、验证码登录、注册和重置密码共用的认证表单。
 */
export function AuthFormCard({
  title,
  submitLabel,
  hint,
  initialMode = 'password-login',
  onSendEmailCode,
  onSubmit,
}: AuthFormCardProps) {
  const [mode, setMode] = useState<AuthFormMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [rememberLogin, setRememberLogin] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codePurpose = getCodePurpose(mode);
  const shouldShowPassword = mode === 'password-login' || mode === 'register' || mode === 'reset-password';
  const shouldShowRememberLogin = mode !== 'register';
  const passwordLabel = mode === 'reset-password' ? '新密码' : '密码';
  const codeButtonLabel = sendingCode ? '发送中...' : countdown > 0 ? `${countdown}秒后重发` : '发送验证码';

  useEffect(() => {
    if (countdown <= 0) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setCountdown((currentCountdown) => Math.max(0, currentCountdown - 1));
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [countdown]);

  /**
   * `switchMode` 切换认证模式并清理当前错误提示。
   */
  function switchMode(nextMode: AuthFormMode) {
    setMode(nextMode);
    setError(null);
  }

  /**
   * `handleSendEmailCode` 触发当前模式对应的邮箱验证码发送流程。
   */
  async function handleSendEmailCode() {
    if (!codePurpose || countdown > 0) {
      return;
    }

    setSendingCode(true);
    setError(null);

    try {
      await onSendEmailCode(email, codePurpose);
      setCountdown(60);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '验证码发送失败');
    } finally {
      setSendingCode(false);
    }
  }

  /**
   * `handleSubmit` 提交当前表单并交给外层按认证模式执行动作。
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({ email, password, emailCode, rememberLogin }, mode);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '请求失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-stone-500">{hint}</p>
        <h2 className="font-[Iowan_Old_Style,Palatino_Linotype,Book_Antiqua,Georgia,serif] text-3xl text-stone-950">
          {title}
        </h2>
      </div>

      <div aria-label="认证方式" className="grid grid-cols-2 gap-2 rounded-[1.25rem] bg-[var(--paper-muted)] p-2 sm:grid-cols-4">
        {[
          ['password-login', '密码登录'],
          ['code-login', '验证码登录'],
          ['register', '去注册'],
          ['reset-password', '忘记密码'],
        ].map(([itemMode, label]) => (
          <button
            key={itemMode}
            className={[
              'rounded-full px-3 py-2 text-sm font-semibold transition',
              mode === itemMode
                ? 'bg-white text-stone-950 shadow-sm'
                : 'text-stone-600 hover:bg-white/70 hover:text-stone-950',
            ].join(' ')}
            type="button"
            onClick={() => switchMode(itemMode as AuthFormMode)}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="block space-y-2 text-sm text-stone-700">
        <span>邮箱</span>
        <input
          className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      {codePurpose ? (
        <div className="space-y-2 text-sm text-stone-700">
          <label className="block space-y-2">
            <span>验证码</span>
            <input
              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              inputMode="numeric"
              required
              value={emailCode}
              onChange={(event) => setEmailCode(event.target.value)}
            />
          </label>
          <button
            className="w-full rounded-full border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-900 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={sendingCode || countdown > 0}
            type="button"
            onClick={handleSendEmailCode}
          >
            {codeButtonLabel}
          </button>
        </div>
      ) : null}

      {shouldShowPassword ? (
        <label className="block space-y-2 text-sm text-stone-700">
          <span>{passwordLabel}</span>
          <input
            className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
      ) : null}

      {shouldShowRememberLogin ? (
        <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-[var(--paper-muted)] px-4 py-3 text-sm text-stone-700">
          <input
            checked={rememberLogin}
            className="h-4 w-4 accent-[var(--accent)]"
            type="checkbox"
            onChange={(event) => setRememberLogin(event.target.checked)}
          />
          <span>30天内记住登录</span>
        </label>
      ) : null}

      {error ? <p className="rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <button
        className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? '确定中...' : submitLabel}
      </button>
    </form>
  );
}
