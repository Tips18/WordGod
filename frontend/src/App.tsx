import { Link, Route, Routes } from 'react-router-dom';
import { AuthPage } from './pages/auth-page';
import { ReadingPage } from './pages/reading-page';
import { VocabularyDetailPage } from './pages/vocabulary-detail-page';
import { VocabularyPage } from './pages/vocabulary-page';

/**
 * `LayoutFrame` 为各个页面提供统一的导航与容器。
 */
function LayoutFrame() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(184,55,43,0.16),_transparent_45%),linear-gradient(180deg,_#f7f0e1_0%,_#f2e6d1_55%,_#eadcc6_100%)] text-stone-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-6 rounded-[2rem] border border-stone-800/10 bg-white/70 p-6 shadow-[0_24px_80px_rgba(74,39,24,0.14)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-stone-500">WordGod / Context First</p>
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
              <Link className="rounded-full border border-stone-900/15 px-4 py-2 text-stone-700 transition hover:border-stone-900 hover:text-stone-950" to="/">
                阅读检测
              </Link>
              <Link className="rounded-full border border-stone-900/15 px-4 py-2 text-stone-700 transition hover:border-stone-900 hover:text-stone-950" to="/vocabulary">
                生词本
              </Link>
              <Link className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-white transition hover:bg-[var(--accent-dark)]" to="/auth">
                登录 / 注册
              </Link>
            </nav>
          </div>
        </header>

        <AppRoutes />
      </div>
    </div>
  );
}

/**
 * `AppRoutes` 声明应用的所有前端路由。
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ReadingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/vocabulary" element={<VocabularyPage />} />
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

