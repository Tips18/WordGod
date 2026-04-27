import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthFormCard } from '../components/auth-form-card';
import { login, register } from '../api/client';
import type { AuthFormValues } from '../components/auth-form-card';

/**
 * `AuthPage` 承载独立登录注册页面。
 */
export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/';

  /**
   * `handleSubmit` 根据当前模式执行登录或注册并跳转。
   */
  async function handleSubmit(values: AuthFormValues, mode: 'login' | 'register') {
    if (mode === 'register') {
      await register(values);
    } else {
      await login(values);
    }

    navigate(redirectTo, { replace: true });
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <article className="rounded-[2rem] border border-stone-900/10 bg-white/75 p-8 shadow-[0_18px_60px_rgba(74,39,24,0.12)]">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.32em] text-stone-500">Access / Restore</p>
          <h2 className="font-[Iowan_Old_Style,Palatino_Linotype,Book_Antiqua,Georgia,serif] text-4xl text-stone-950">
            登录后继续你的真题词汇检测
          </h2>
          <p className="max-w-xl text-sm leading-7 text-stone-600">
            游客可以先读，但只有登录后，当前段落的薄弱词才会被正式沉淀进生词本，并在后续复习里持续追踪。
          </p>
        </div>
      </article>

      <aside className="rounded-[2rem] border border-stone-900/10 bg-white/90 p-8 shadow-[0_18px_60px_rgba(74,39,24,0.12)]">
        <AuthFormCard hint="Account" onSubmit={handleSubmit} submitLabel="提交" title="登录 / 注册" />
      </aside>
    </section>
  );
}
