import type {
  AuthResponse,
  AuthUser,
  EmailCodePurpose,
  PassageToken,
  ReadingPassageResponse,
} from '@word-god/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { startTransition, useState } from 'react';
import {
  ApiError,
  completeReadingAttempt,
  getRandomPassage,
  login,
  loginWithEmailCode,
  register,
  resetPassword,
  sendEmailCode,
  syncReadingAttempt,
} from '../api/client';
import { AuthFormCard } from '../components/auth-form-card';
import type { AuthFormMode, AuthFormValues } from '../components/auth-form-card';

interface PassageTextPart {
  key: string;
  text: string;
  token: PassageToken | null;
}

interface SelectedWordListItem {
  lemma: string;
  surface: string;
}

interface ReadingPageProps {
  onAuthenticated?: (user: AuthUser) => void;
}

/**
 * `normalizeTokenKey` 将英文表面词规整为匹配 token 的键。
 */
function normalizeTokenKey(value: string): string {
  return value.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');
}

/**
 * `createTokenQueues` 按英文表面词为重复出现的 token 建立顺序队列。
 */
function createTokenQueues(
  tokens: PassageToken[],
): Map<string, PassageToken[]> {
  const queues = new Map<string, PassageToken[]>();

  for (const token of tokens) {
    const key = normalizeTokenKey(token.surface);
    const queue = queues.get(key) ?? [];

    queue.push(token);
    queues.set(key, queue);
  }

  return queues;
}

/**
 * `buildPassageTextParts` 将完整段落切成普通文本与可点击 token 片段。
 */
function buildPassageTextParts(
  content: string,
  tokens: PassageToken[],
): PassageTextPart[] {
  const tokenQueues = createTokenQueues(tokens);
  const chunks = content.match(/\S+\s*/g) ?? [];

  return chunks.map((chunk, index) => {
    const key = normalizeTokenKey(chunk);
    const token = key ? (tokenQueues.get(key)?.shift() ?? null) : null;

    return {
      key: `${index}-${chunk}`,
      text: chunk,
      token,
    };
  });
}

/**
 * `buildSelectedWordListItems` 将已选 token 规整为按 lemma 去重的本篇生词列表。
 */
function buildSelectedWordListItems(
  tokens: PassageToken[],
  selectedTokenIds: string[],
): SelectedWordListItem[] {
  const tokenMap = new Map(tokens.map((token) => [token.id, token]));
  const seenLemmas = new Set<string>();
  const items: SelectedWordListItem[] = [];

  for (const tokenId of selectedTokenIds) {
    const token = tokenMap.get(tokenId);

    if (!token || seenLemmas.has(token.lemma)) {
      continue;
    }

    seenLemmas.add(token.lemma);
    items.push({
      lemma: token.lemma,
      surface: token.surface,
    });
  }

  return items;
}

/**
 * `ReadingPage` 承载阅读检测、标记与登录拦截流程。
 */
export function ReadingPage({ onAuthenticated }: ReadingPageProps) {
  const passageQuery = useQuery({
    queryKey: ['reading-passage'],
    queryFn: getRandomPassage,
  });
  const [nextPassage, setNextPassage] = useState<ReadingPassageResponse | null>(
    null,
  );
  const [localReadingState, setLocalReadingState] = useState<{
    passageId: string;
    selectedTokenIds: string[];
    focusedTokenId: string | null;
  } | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const activePassage = nextPassage ?? passageQuery.data ?? null;
  const activeLocalState =
    activePassage && localReadingState?.passageId === activePassage.passage.id
      ? localReadingState
      : null;
  const selectedTokenIds =
    activeLocalState?.selectedTokenIds ?? activePassage?.selectedTokenIds ?? [];
  const focusedTokenId =
    activeLocalState?.focusedTokenId ??
    selectedTokenIds[0] ??
    activePassage?.tokens[0]?.id ??
    null;
  const continueMutation = useMutation({
    mutationFn: async (passageId: string) => {
      await syncReadingAttempt(passageId, { selectedTokenIds });
      return completeReadingAttempt(passageId);
    },
  });

  const tokenMap = new Map(
    (activePassage?.tokens ?? []).map((token) => [token.id, token]),
  );
  const focusedToken = focusedTokenId
    ? (tokenMap.get(focusedTokenId) ?? null)
    : null;
  const selectedWordItems = buildSelectedWordListItems(
    activePassage?.tokens ?? [],
    selectedTokenIds,
  );
  const passageParts = activePassage
    ? buildPassageTextParts(activePassage.passage.content, activePassage.tokens)
    : [];

  /**
   * `toggleToken` 切换指定 token 的标记状态，并更新当前详情卡片。
   */
  function toggleToken(tokenId: string) {
    if (!activePassage) {
      return;
    }

    setLocalReadingState((currentState) => {
      const currentSelection =
        currentState?.passageId === activePassage.passage.id
          ? currentState.selectedTokenIds
          : activePassage.selectedTokenIds;
      const nextSelection = currentSelection.includes(tokenId)
        ? currentSelection.filter((item) => item !== tokenId)
        : [...currentSelection, tokenId];

      return {
        passageId: activePassage.passage.id,
        selectedTokenIds: nextSelection,
        focusedTokenId: tokenId,
      };
    });
  }

  /**
   * `removeSelectedWord` 从当前段落标记集合中移除指定 lemma 的已选词。
   */
  function removeSelectedWord(lemma: string) {
    if (!activePassage) {
      return;
    }

    setLocalReadingState((currentState) => {
      const currentSelection =
        currentState?.passageId === activePassage.passage.id
          ? currentState.selectedTokenIds
          : activePassage.selectedTokenIds;
      const nextSelection = currentSelection.filter((tokenId) => {
        return tokenMap.get(tokenId)?.lemma !== lemma;
      });
      const currentFocusedTokenId =
        currentState?.passageId === activePassage.passage.id
          ? currentState.focusedTokenId
          : focusedTokenId;
      const focusedLemma = currentFocusedTokenId
        ? tokenMap.get(currentFocusedTokenId)?.lemma
        : null;

      return {
        passageId: activePassage.passage.id,
        selectedTokenIds: nextSelection,
        focusedTokenId:
          focusedLemma === lemma
            ? (nextSelection[0] ?? activePassage.tokens[0]?.id ?? null)
            : currentFocusedTokenId,
      };
    });
  }

  /**
   * `applyNextPassage` 用新的段落结果刷新本地阅读状态。
   */
  function applyNextPassage(nextPassage: ReadingPassageResponse) {
    startTransition(() => {
      setNextPassage(nextPassage);
      setLocalReadingState({
        passageId: nextPassage.passage.id,
        selectedTokenIds: nextPassage.selectedTokenIds,
        focusedTokenId:
          nextPassage.selectedTokenIds[0] ?? nextPassage.tokens[0]?.id ?? null,
      });
    });
  }

  /**
   * `continueReading` 尝试结算当前段落；若未登录则打开认证弹层。
   */
  async function continueReading() {
    if (!activePassage) {
      return;
    }

    try {
      const result = await continueMutation.mutateAsync(
        activePassage.passage.id,
      );

      setStatusMessage(
        `已沉淀 ${result.savedLemmaCount} 个重点词，继续下一段。`,
      );
      applyNextPassage(result.nextPassage);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAuthDialogOpen(true);
        return;
      }

      setStatusMessage(error instanceof Error ? error.message : '继续阅读失败');
    }
  }

  /**
   * `closeAuthDialog` 关闭阅读结算拦截弹窗并停留在当前段落。
   */
  function closeAuthDialog() {
    setAuthDialogOpen(false);
  }

  /**
   * `handleSendEmailCode` 将弹层验证码请求转发到认证 API。
   */
  async function handleSendEmailCode(email: string, purpose: EmailCodePurpose) {
    await sendEmailCode({ email, purpose });
  }

  /**
   * `handleDialogSubmit` 在弹层中完成登录、注册或重置密码，并继续当前段落。
   */
  async function handleDialogSubmit(
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

    onAuthenticated?.(authResponse.user);
    setAuthDialogOpen(false);

    if (activePassage) {
      const result = await continueMutation.mutateAsync(
        activePassage.passage.id,
      );

      setStatusMessage(
        `已沉淀 ${result.savedLemmaCount} 个重点词，继续下一段。`,
      );
      applyNextPassage(result.nextPassage);
    }
  }

  if (passageQuery.isError) {
    return (
      <section className="rounded-[2rem] border border-rose-200 bg-rose-50 p-8 text-rose-700 shadow-[0_18px_60px_rgba(74,39,24,0.12)]">
        {passageQuery.error instanceof Error
          ? passageQuery.error.message
          : '段落加载失败'}
      </section>
    );
  }

  if (passageQuery.isLoading || !activePassage) {
    return (
      <section className="rounded-[2rem] border border-stone-900/10 bg-white/80 p-10 text-center text-stone-600 shadow-[0_18px_60px_rgba(74,39,24,0.12)]">
        正在载入真题段落...
      </section>
    );
  }

  return (
    <section
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(44rem,44rem)_minmax(0,1fr)] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_minmax(44rem,56rem)_minmax(0,1fr)]"
      data-testid="reading-layout"
    >
      <article className="relative overflow-hidden rounded-[2rem] border border-stone-900/10 bg-white/80 p-8 shadow-[0_18px_60px_rgba(74,39,24,0.12)] xl:col-start-2">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-stone-900/10 pb-6">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.32em] text-stone-500">
              {activePassage.passage.paper} / {activePassage.passage.year}
            </p>
            <h2 className="font-[Iowan_Old_Style,Palatino_Linotype,Book_Antiqua,Georgia,serif] text-4xl text-stone-950">
              {activePassage.passage.title}
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-stone-600">
              单击段落中的词，将“不认识 /
              不熟悉”的单词沉淀到下一步的检测结算里。
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-stone-900/10 bg-[var(--paper-muted)] px-4 py-3 text-sm text-stone-700">
            当前已标记{' '}
            <span className="font-semibold text-stone-950">
              {selectedTokenIds.length}
            </span>{' '}
            个词
          </div>
        </div>

        <div className="rounded-[1.8rem] bg-[var(--paper-muted)] p-6 shadow-inner">
          <p className="whitespace-pre-wrap text-lg leading-9 text-stone-900">
            {passageParts.map((part) => {
              const token = part.token;

              if (!token) {
                return <span key={part.key}>{part.text}</span>;
              }

              return (
                <button
                  key={part.key}
                  aria-pressed={selectedTokenIds.includes(token.id)}
                  className={[
                    'mx-0.5 rounded-sm border-b px-0.5 py-0 text-left align-baseline transition',
                    selectedTokenIds.includes(token.id)
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(125,42,28,0.18)]'
                      : 'border-transparent bg-transparent text-stone-900 hover:border-stone-400 hover:bg-white/70',
                  ].join(' ')}
                  type="button"
                  onClick={() => toggleToken(token.id)}
                >
                  {part.text}
                </button>
              );
            })}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={continueMutation.isPending}
            type="button"
            onClick={continueReading}
          >
            {continueMutation.isPending ? '处理中...' : '下一篇'}
          </button>
          {statusMessage ? (
            <p className="text-sm text-stone-600">{statusMessage}</p>
          ) : null}
        </div>
      </article>

      <aside
        aria-label="本篇已选"
        className="xl:sticky xl:top-6 xl:col-start-1 xl:row-start-1 xl:max-h-[calc(100vh-3rem)] xl:w-full xl:max-w-72 xl:justify-self-end xl:overflow-y-auto"
      >
        <section className="rounded-lg border border-stone-900/[0.06] bg-white/70 p-6 backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.32em] text-stone-500">
            Selected
          </p>
          <div className="mt-4 space-y-4">
            <h3 className="font-[Iowan_Old_Style,Palatino_Linotype,Book_Antiqua,Georgia,serif] text-2xl text-stone-950">
              本篇已选
            </h3>
            {selectedWordItems.length > 0 ? (
              <ul aria-label="本篇已选词面" className="space-y-2">
                {selectedWordItems.map((item) => (
                  <li
                    className="flex items-center justify-between gap-3 rounded-full border border-[var(--accent)]/20 bg-[var(--paper-muted)] px-4 py-2 text-sm font-semibold text-stone-900"
                    key={item.lemma}
                  >
                    <span className="min-w-0 truncate">{item.surface}</span>
                    <button
                      aria-label={`移除 ${item.surface}`}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-stone-900/10 bg-white/70 text-base leading-none text-stone-500 transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                      type="button"
                      onClick={() => removeSelectedWord(item.lemma)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-[var(--paper-muted)] px-4 py-3 text-sm text-stone-500">
                暂无标记词
              </p>
            )}
          </div>
        </section>
      </aside>

      <aside
        aria-label="Live Note"
        className="space-y-6 xl:sticky xl:top-6 xl:col-start-3 xl:row-start-1 xl:max-h-[calc(100vh-3rem)] xl:w-full xl:max-w-80 xl:justify-self-start xl:overflow-y-auto"
      >
        <section className="rounded-lg border border-stone-900/10 bg-white/80 p-8">
          <p className="text-xs uppercase tracking-[0.32em] text-stone-500">
            Live Note
          </p>
          <div className="mt-4 space-y-4">
            <h3 className="font-[Iowan_Old_Style,Palatino_Linotype,Book_Antiqua,Georgia,serif] text-3xl text-stone-950">
              {focusedToken?.surface ?? '尚未选择单词'}
            </h3>
            <div className="space-y-2 text-sm text-stone-600">
              <p>
                词性：
                <span className="font-medium text-stone-900">
                  {focusedToken?.partOfSpeech ?? '--'}
                </span>
              </p>
              <p>
                释义：
                <span className="font-medium text-stone-900">
                  {focusedToken?.definitionCn ?? '--'}
                </span>
              </p>
            </div>
            <div className="rounded-lg bg-[var(--paper-muted)] p-5 text-sm leading-7 text-stone-700">
              <p className="font-medium text-stone-900">
                {focusedToken
                  ? activePassage.sentences[focusedToken.sentenceIndex]?.text
                  : '点击左侧单词后，这里会显示原句。'}
              </p>
            </div>
          </div>
        </section>
      </aside>

      {authDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4">
          <div
            aria-label="登录后继续"
            aria-modal="true"
            className="relative w-full max-w-xl rounded-[2rem] border border-stone-900/10 bg-white p-8 shadow-[0_24px_80px_rgba(34,24,18,0.32)]"
            role="dialog"
          >
            <button
              aria-label="关闭登录弹窗"
              className="absolute right-5 top-5 z-[10] grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-stone-900/10 bg-[var(--paper-muted)] text-stone-500 transition hover:border-[var(--accent)] hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              type="button"
              onClick={closeAuthDialog}
            >
              <span className="text-xl leading-none">×</span>
            </button>
            <AuthFormCard
              hint="Checkpoint"
              onSendEmailCode={handleSendEmailCode}
              onSubmit={handleDialogSubmit}
              submitLabel="登录并继续"
              title="登录后继续"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
