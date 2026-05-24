import { useCallback, useState, useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { AuthResponse, AuthUser, EmailCodePurpose } from '@word-god/contracts';
import { ReadingPage } from './pages/reading-page';
import { VocabularyDetailPage } from './pages/vocabulary-detail-page';
import { VocabularyPage } from './pages/vocabulary-page';
import {
  getCurrentUser,
  login,
  loginWithEmailCode,
  logout,
  register,
  resetPassword,
  sendEmailCode,
} from './api/client';
import { AuthFormCard } from './components/auth-form-card';
import type { AuthFormMode, AuthFormValues } from './components/auth-form-card';

interface AppRoutesProps {
  onAuthenticated?: (user: AuthUser) => void;
  onAuthRequired?: (message?: string) => void;
  authRevision: number;
}

/**
 * `LayoutFrame` 为各个页面提供统一的导航与容器。
 */
function LayoutFrame() {
  const location = useLocation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authDialogMessage, setAuthDialogMessage] = useState<string | null>(
    null,
  );
  const [authRevision, setAuthRevision] = useState(0);
  const isReadingRoute = location.pathname === '/';
  const appContainerClassName = [
    'mx-auto px-4 pb-8 pt-4 sm:px-6 lg:px-8',
    isReadingRoute ? 'max-w-[104rem]' : 'max-w-7xl',
  ].join(' ');

  useEffect(() => {
    getCurrentUser()
      .then((result) => {
        setUser(result.user);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  /**
   * `handleAuthenticated` 接收认证页面返回的用户并刷新导航登录态。
   */
  function handleAuthenticated(nextUser: AuthUser) {
    setUser(nextUser);
    setAuthRevision((currentRevision) => currentRevision + 1);
    setAuthDialogOpen(false);
    setAuthDialogMessage(null);
  }

  /**
   * `handleLogout` 结束当前会话并刷新导航登录状态。
   */
  async function handleLogout() {
    try {
      await logout();
      setUser(null);
      setAuthRevision((currentRevision) => currentRevision + 1);
    } catch {
      setUser(null);
      setAuthRevision((currentRevision) => currentRevision + 1);
    }
  }

  /**
   * `openAuthDialog` 打开全局认证弹窗并记录触发场景提示。
   */
  const openAuthDialog = useCallback(function openAuthDialog(
    message?: string,
  ) {
    setAuthDialogMessage(message ?? null);
    setAuthDialogOpen(true);
  }, []);

  /**
   * `closeAuthDialog` 关闭全局认证弹窗并清理场景提示。
   */
  function closeAuthDialog() {
    setAuthDialogOpen(false);
    setAuthDialogMessage(null);
  }

  /**
   * `handleSendEmailCode` 将全局认证弹窗的验证码请求转发到认证 API。
   */
  async function handleSendEmailCode(email: string, purpose: EmailCodePurpose) {
    await sendEmailCode({ email, purpose });
  }

  /**
   * `handleAuthSubmit` 根据弹窗认证模式执行登录、注册或重置密码。
   */
  async function handleAuthSubmit(
    values: AuthFormValues,
    mode: AuthFormMode,
  ) {
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

    handleAuthenticated(authResponse.user);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(184,55,43,0.16),_transparent_45%),linear-gradient(180deg,_#f7f0e1_0%,_#f2e6d1_55%,_#eadcc6_100%)]">
        <div className="text-stone-600">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(184,55,43,0.16),_transparent_45%),linear-gradient(180deg,_#f7f0e1_0%,_#f2e6d1_55%,_#eadcc6_100%)] text-stone-900">
      <div className={appContainerClassName} data-testid="app-container">
        <header className="mb-8 flex flex-col gap-6 rounded-[2rem] border border-stone-800/10 bg-white/80 p-6 shadow-[0_24px_80px_rgba(74,39,24,0.14)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
                WordGod / Context First
              </p>
              <div className="space-y-2">
                <h1 className="font-[Iowan_Old_Style,Palatino_Linotype,Book_Antiqua,Georgia,serif] text-4xl leading-tight text-stone-950 sm:text-5xl">
                  我不是词神
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
                  在真题语境里重新认识那些你以为自己已经背过的词。先检测，再沉淀，再复习。
                </p>
              </div>
            </div>
            <nav className="flex flex-wrap gap-3 text-sm">
              <Link
                className="rounded-full border border-stone-900/15 px-4 py-2 text-stone-700 transition hover:border-stone-900 hover:text-stone-950"
                to="/"
              >
                阅读检测
              </Link>
              <Link
                className="rounded-full border border-stone-900/15 px-4 py-2 text-stone-700 transition hover:border-stone-900 hover:text-stone-950"
                to="/vocabulary"
              >
                生词本
              </Link>
              {user ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="max-w-[16rem] truncate rounded-full border border-stone-900/15 bg-white/65 px-4 py-2 text-stone-700">
                    {user.email}
                  </span>
                  <button
                    className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 font-semibold text-white transition hover:bg-[var(--accent-dark)]"
                    style={{ color: '#fff' }}
                    onClick={handleLogout}
                    type="button"
                  >
                    退出登录
                  </button>
                </div>
              ) : (
                <button
                  className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-white font-semibold transition hover:bg-[var(--accent-dark)]"
                  style={{ color: '#fff' }}
                  type="button"
                  onClick={() => openAuthDialog()}
                >
                  登录 / 注册
                </button>
              )}
            </nav>
          </div>
        </header>

        <AppRoutes
          authRevision={authRevision}
          onAuthRequired={openAuthDialog}
          onAuthenticated={handleAuthenticated}
        />

        {authDialogOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4">
            <div
              aria-label="登录 / 注册"
              aria-modal="true"
              className="relative w-full max-w-xl rounded-[2rem] border border-stone-900/10 bg-white p-8 shadow-[0_24px_80px_rgba(34,24,18,0.32)]"
              role="dialog"
            >
              <button
                aria-label="关闭登录弹窗"
                className="absolute right-5 top-5 z-[10] grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-stone-900/10 bg-[var(--paper-muted)] text-stone-500 transition hover:border-[var(--accent)] hover:text-stone-950"
                type="button"
                onClick={closeAuthDialog}
              >
                <span className="text-xl leading-none">×</span>
              </button>
              {authDialogMessage ? (
                <p className="mb-4 rounded-[1.25rem] bg-[var(--paper-muted)] px-4 py-3 text-sm text-stone-600">
                  {authDialogMessage}
                </p>
              ) : null}
              <AuthFormCard
                hint="Account"
                onSendEmailCode={handleSendEmailCode}
                onSubmit={handleAuthSubmit}
                submitLabel="确定"
                title="登录 / 注册"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * `AppRoutes` 声明应用的所有前端路由。
 */
export function AppRoutes({
  authRevision,
  onAuthenticated,
  onAuthRequired,
}: AppRoutesProps) {
  return (
    <Routes>
      <Route
        path="/"
        element={<ReadingPage onAuthenticated={onAuthenticated} />}
      />
      <Route path="/auth" element={<Navigate replace to="/" />} />
      <Route
        path="/vocabulary"
        element={
          <VocabularyPage
            authRevision={authRevision}
            onAuthRequired={onAuthRequired}
          />
        }
      />
      <Route path="/vocabulary/:lemma" element={<VocabularyDetailPage />} />
    </Routes>
  );
}

/**
 * `AppShell` 作为测试和运行环境共用的入口壳层。
 */
export function AppShell() {
  return <LayoutFrame />;
}

/**
 * `App` 作为浏览器环境中的默认入口组件。
 */
export default function App() {
  return <AppShell />;
}
