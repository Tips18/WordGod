import { useNavigate, useSearchParams } from 'react-router-dom';
import type { AuthResponse, AuthUser, EmailCodePurpose } from '@word-god/contracts';
import { AuthFormCard } from '../components/auth-form-card';
import { login, loginWithEmailCode, register, resetPassword, sendEmailCode } from '../api/client';
import type { AuthFormMode, AuthFormValues } from '../components/auth-form-card';

interface AuthPageProps {
  onAuthenticated?: (user: AuthUser) => void;
}

/**
 * `AuthPage` 承载独立登录注册页面。
 */
export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/';

  /**
   * `handleSendEmailCode` 将表单验证码请求转发到认证 API。
   */
  async function handleSendEmailCode(email: string, purpose: EmailCodePurpose) {
    await sendEmailCode({ email, purpose });
  }

  /**
   * `handleSubmit` 根据当前认证模式执行登录、注册或重置密码并跳转。
   */
  async function handleSubmit(values: AuthFormValues, mode: AuthFormMode) {
    let authResponse: AuthResponse;

    if (mode === 'register') {
      authResponse = await register({
        email: values.email,
        password: values.password,
        emailCode: values.emailCode,
      });
    } else if (mode === 'code-login') {
      authResponse = await loginWithEmailCode({
        email: values.email,
        emailCode: values.emailCode,
        rememberLogin: values.rememberLogin,
      });
    } else if (mode === 'reset-password') {
      authResponse = await resetPassword({
        email: values.email,
        emailCode: values.emailCode,
        newPassword: values.password,
        rememberLogin: values.rememberLogin,
      });
    } else {
      authResponse = await login({
        email: values.email,
        password: values.password,
        rememberLogin: values.rememberLogin,
      });
    }

    onAuthenticated?.(authResponse.user);
    navigate(redirectTo, { replace: true });
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <article className="rounded-[2rem] border border-stone-900/10 bg-white/75 p-8 shadow-[0_18px_60px_rgba(74,39,24,0.12)]">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.32em] text-stone-500">
            Access / Restore
          </p>
          <h2 className="font-[Iowan_Old_Style,Palatino_Linotype,Book_Antiqua,Georgia,serif] text-4xl text-stone-950">
            登录后继续你的真题词汇检测
          </h2>
          <p className="max-w-xl text-sm leading-7 text-stone-600">
            游客可以先读，但只有登录后，当前段落的薄弱词才会被正式沉淀进生词本，并在后续复习里持续追踪。
          </p>
        </div>
      </article>

      <aside className="rounded-[2rem] border border-stone-900/10 bg-white/90 p-8 shadow-[0_18px_60px_rgba(74,39,24,0.12)]">
        <AuthFormCard
          hint="Account"
          onSendEmailCode={handleSendEmailCode}
          onSubmit={handleSubmit}
          submitLabel="确定"
          title="登录 / 注册"
        />
      </aside>
    </section>
  );
}
