import type {
  AuthResponse,
  AuthUser,
  EmailCodePurpose,
  PassageToken,
  ReadingPassageResponse,
} from '@word-god/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { startTransition, useEffect, useRef, useState } from 'react';
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

interface MobileWordNotePosition {
  top: number;
  left: number;
}

interface MobileWordNoteState {
  open: boolean;
  position: MobileWordNotePosition;
}

interface ReadingPageProps {
  onAuthenticated?: (user: AuthUser) => void;
}

const MOBILE_WORD_NOTE_WIDTH = 288;
const MOBILE_WORD_NOTE_ESTIMATED_HEIGHT = 252;
const MOBILE_WORD_NOTE_MARGIN = 12;
const MOBILE_WORD_NOTE_OFFSET = 8;
const DEFAULT_MOBILE_WORD_NOTE_POSITION = {
  top: 96,
  left: MOBILE_WORD_NOTE_MARGIN,
};
const UNAVAILABLE_TRANSLATION_TEXT = '翻译暂不可用，请稍后重试。';

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
 * `shouldOpenMobileWordNote` 判断当前运行环境是否应使用贴近词面的移动端弹窗。
 */
function shouldOpenMobileWordNote(): boolean {
  if (import.meta.env.VITE_WORD_GOD_RUNTIME === 'mobile') {
    return true;
  }

  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }

  return window.matchMedia('(max-width: 640px)').matches;
}

/**
 * `createMobileWordNotePosition` 根据被点击词面位置生成不越出视口的弹窗坐标。
 */
function createMobileWordNotePosition(
  targetElement: HTMLElement,
): MobileWordNotePosition {
  if (typeof window === 'undefined') {
    return DEFAULT_MOBILE_WORD_NOTE_POSITION;
  }

  const targetRect = targetElement.getBoundingClientRect();
  const viewportWidth =
    window.innerWidth || MOBILE_WORD_NOTE_WIDTH + MOBILE_WORD_NOTE_MARGIN * 2;
  const viewportHeight =
    window.innerHeight ||
    MOBILE_WORD_NOTE_ESTIMATED_HEIGHT + MOBILE_WORD_NOTE_MARGIN * 2;
  const maxLeft = Math.max(
    MOBILE_WORD_NOTE_MARGIN,
    viewportWidth - MOBILE_WORD_NOTE_WIDTH - MOBILE_WORD_NOTE_MARGIN,
  );
  const maxTop = Math.max(
    MOBILE_WORD_NOTE_MARGIN,
    viewportHeight - MOBILE_WORD_NOTE_ESTIMATED_HEIGHT - MOBILE_WORD_NOTE_MARGIN,
  );
  const desiredLeft =
    targetRect.left + targetRect.width / 2 - MOBILE_WORD_NOTE_WIDTH / 2;
  const desiredTop = targetRect.bottom + MOBILE_WORD_NOTE_OFFSET;

  return {
    top: Math.min(Math.max(desiredTop, MOBILE_WORD_NOTE_MARGIN), maxTop),
    left: Math.min(Math.max(desiredLeft, MOBILE_WORD_NOTE_MARGIN), maxLeft),
  };
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
  const [mobileWordNoteState, setMobileWordNoteState] =
    useState<MobileWordNoteState>({
      open: false,
      position: DEFAULT_MOBILE_WORD_NOTE_POSITION,
    });
  const mobileWordNoteRef = useRef<HTMLDivElement | null>(null);
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
  const focusedSentence =
    focusedToken && activePassage
      ? (activePassage.sentences[focusedToken.sentenceIndex] ?? null)
      : null;
  const focusedSentenceText =
    focusedSentence?.text ?? activePassage?.passage.content ?? '';
  const focusedSentenceTranslation =
    focusedSentence?.translation ??
    focusedToken?.translationCn ??
    UNAVAILABLE_TRANSLATION_TEXT;
  const shouldShowMobileSentenceTranslation =
    focusedSentenceTranslation.trim() !== UNAVAILABLE_TRANSLATION_TEXT;
  const selectedWordItems = buildSelectedWordListItems(
    activePassage?.tokens ?? [],
    selectedTokenIds,
  );
  const passageParts = activePassage
    ? buildPassageTextParts(activePassage.passage.content, activePassage.tokens)
    : [];

  useEffect(() => {
    if (!mobileWordNoteState.open) {
      return undefined;
    }

    /**
     * `handleDocumentPointerDown` 在移动端单词弹窗外部点击时关闭弹窗。
     */
    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (mobileWordNoteRef.current?.contains(target)) {
        return;
      }

      setMobileWordNoteState((currentState) => ({
        ...currentState,
        open: false,
      }));
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown);

    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
    };
  }, [mobileWordNoteState.open]);

  /**
   * `toggleToken` 切换指定 token 的标记状态，并更新当前详情卡片。
   */
  function toggleToken(tokenId: string, targetElement: HTMLElement) {
    if (!activePassage) {
      return;
    }

    if (shouldOpenMobileWordNote()) {
      setMobileWordNoteState({
        open: true,
        position: createMobileWordNotePosition(targetElement),
      });
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
   * `closeMobileWordNote` 关闭手机端单词详情弹窗并保留当前选词状态。
   */
  function closeMobileWordNote() {
    setMobileWordNoteState((currentState) => ({
      ...currentState,
      open: false,
    }));
  }

  /**
   * `removeSelectedWord` 从当前段落标记集合中移除指定 lemma 的已选词。
   */
  function removeSelectedWord(lemma: string) {
    if (!activePassage) {
      return;
    }

    setMobileWordNoteState((currentState) => ({
      ...currentState,
      open: false,
    }));

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
      setMobileWordNoteState({
        open: false,
        position: DEFAULT_MOBILE_WORD_NOTE_POSITION,
      });
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

      setStatusMessage(null);
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

      setStatusMessage(null);
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
          <p className="reading-passage-text whitespace-pre-wrap text-lg leading-9 text-stone-900">
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
                    'reading-token-button mx-0.5 rounded-sm border-b px-0.5 py-0 text-left align-baseline transition',
                    selectedTokenIds.includes(token.id)
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(125,42,28,0.18)]'
                      : 'border-transparent bg-transparent text-stone-900 hover:border-stone-400 hover:bg-white/70',
                  ].join(' ')}
                  type="button"
                  onClick={(event) =>
                    toggleToken(token.id, event.currentTarget)
                  }
                >
                  {part.text}
                </button>
              );
            })}
          </p>
        </div>

        {mobileWordNoteState.open && focusedToken ? (
          <div
            aria-label="单词详情"
            className="mobile-word-note fixed z-40 rounded-xl border border-stone-900/10 bg-white/95 p-4 text-sm text-stone-700 shadow-[0_18px_50px_rgba(34,24,18,0.24)] backdrop-blur"
            ref={mobileWordNoteRef}
            role="dialog"
            style={{
              top: `${mobileWordNoteState.position.top}px`,
              left: `${mobileWordNoteState.position.left}px`,
            }}
          >
            <button
              aria-label="关闭单词详情"
              className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full border border-stone-900/10 bg-[var(--paper-muted)] text-base leading-none text-stone-500 transition hover:border-[var(--accent)] hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              type="button"
              onClick={closeMobileWordNote}
            >
              ×
            </button>
            <p className="pr-8 text-[0.7rem] uppercase tracking-[0.24em] text-stone-500">
              Live Note
            </p>
            <h3 className="mt-2 pr-8 font-[Iowan_Old_Style,Palatino_Linotype,Book_Antiqua,Georgia,serif] text-2xl leading-tight text-stone-950">
              {focusedToken.surface}
            </h3>
            <div className="mt-3 space-y-1.5 text-xs leading-5 text-stone-600">
              <p>
                词性：
                <span className="font-medium text-stone-900">
                  {focusedToken.partOfSpeech}
                </span>
              </p>
              <p>
                释义：
                <span className="font-medium text-stone-900">
                  {focusedToken.definitionCn}
                </span>
              </p>
            </div>
            <div className="mt-3 space-y-2 rounded-lg bg-[var(--paper-muted)] p-3 text-xs leading-5 text-stone-700">
              <p className="font-medium text-stone-900">
                {focusedSentenceText}
              </p>
              {shouldShowMobileSentenceTranslation ? (
                <p>{focusedSentenceTranslation}</p>
              ) : null}
            </div>
          </div>
        ) : null}
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

      <div
        className="reading-continue-action flex flex-wrap items-center gap-4 xl:col-start-2 xl:row-start-2"
        data-testid="reading-continue-action"
      >
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
            <div className="space-y-3 rounded-lg bg-[var(--paper-muted)] p-5 text-sm leading-7 text-stone-700">
              <p className="font-medium text-stone-900">
                {focusedToken
                  ? focusedSentenceText
                  : '点击左侧单词后，这里会显示原句。'}
              </p>
              {focusedToken ? <p>{focusedSentenceTranslation}</p> : null}
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
