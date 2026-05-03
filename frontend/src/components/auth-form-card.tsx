import { useState } from 'react';
import type { FormEvent } from 'react';

export interface AuthFormValues {
  email: string;
  password: string;
  rememberLogin: boolean;
}

interface AuthFormCardProps {
  title: string;
  submitLabel: string;
  hint: string;
  initialMode?: 'login' | 'register';
  onSubmit: (values: AuthFormValues, mode: 'login' | 'register') => Promise<void>;
}

/**
 * `AuthFormCard` 渲染登录与注册共用的表单卡片。
 */
export function AuthFormCard({
  title,
  submitLabel,
  hint,
  initialMode = 'login',
  onSubmit,
}: AuthFormCardProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberLogin, setRememberLogin] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * `handleSubmit` 提交当前表单并交给外层处理认证动作。
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({ email, password, rememberLogin }, mode);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '请求失败');
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * `toggleMode` 在登录和注册模式之间切换。
   */
  function toggleMode() {
    setMode((currentMode) => (currentMode === 'login' ? 'register' : 'login'));
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-stone-500">{hint}</p>
        <h2 className="font-[Iowan_Old_Style,Palatino_Linotype,Book_Antiqua,Georgia,serif] text-3xl text-stone-950">
          {title}
        </h2>
      </div>

      <label className="block space-y-2 text-sm text-stone-700">
        <span>邮箱</span>
        <input
          className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label className="block space-y-2 text-sm text-stone-700">
        <span>密码</span>
        <input
          className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      {mode === 'login' ? (
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

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? '确定中...' : submitLabel}
        </button>
        <button
          className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-900 hover:text-stone-950"
          type="button"
          onClick={toggleMode}
        >
          {mode === 'login' ? '去注册' : '去登录'}
        </button>
      </div>

      <p className="text-sm text-stone-500">
        当前模式：
        <span className="ml-2 font-medium text-stone-700">{mode === 'login' ? '登录' : '注册'}</span>
      </p>
    </form>
  );
}
