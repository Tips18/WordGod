import type { PassageToken, ReadingPassageResponse } from '@word-god/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { startTransition, useState } from 'react';
import {
  ApiError,
  completeReadingAttempt,
  getRandomPassage,
  login,
  register,
  syncReadingAttempt,
} from '../api/client';
import { AuthFormCard } from '../components/auth-form-card';
import type { AuthFormValues } from '../components/auth-form-card';

interface PassageTextPart {
  key: string;
  text: string;
  token: PassageToken | null;
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
 * `ReadingPage` 承载阅读检测、标记与登录拦截流程。
 */
export function ReadingPage() {
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
   * `handleDialogSubmit` 在弹层中完成登录或注册，并继续当前段落。
   */
  async function handleDialogSubmit(
    values: AuthFormValues,
    mode: 'login' | 'register',
  ) {
    if (mode === 'register') {
      await register(values);
    } else {
      await login(values);
    }

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
    <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <article className="relative overflow-hidden rounded-[2rem] border border-stone-900/10 bg-white/80 p-8 shadow-[0_18px_60px_rgba(74,39,24,0.12)]">
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

      <aside className="space-y-6">
        <section className="rounded-[2rem] border border-stone-900/10 bg-white/85 p-8 shadow-[0_18px_60px_rgba(74,39,24,0.12)]">
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
            <div className="rounded-[1.5rem] bg-[var(--paper-muted)] p-5 text-sm leading-7 text-stone-700">
              <p className="font-medium text-stone-900">
                {focusedToken
                  ? activePassage.sentences[focusedToken.sentenceIndex]?.text
                  : '点击左侧单词后，这里会显示原句。'}
              </p>
              <p className="mt-3 text-stone-600">
                {focusedToken
                  ? activePassage.sentences[focusedToken.sentenceIndex]
                      ?.translation
                  : '原句翻译也会同步出现，便于快速确认语境。'}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-stone-900/10 bg-stone-950 p-8 text-stone-100 shadow-[0_18px_60px_rgba(34,24,18,0.3)]">
          <p className="text-xs uppercase tracking-[0.32em] text-stone-400">
            Flow
          </p>
          <div className="mt-4 space-y-3 text-sm leading-7 text-stone-300">
            <p>背词之后，用真题段落检测识别稳定度。</p>
            <p>标记并结算后，生词会自动进入你的高优先级复习清单。</p>
            <p>同一段内同一词只记一次，不同段重复出现时才增加权重。</p>
          </div>
        </section>
      </aside>

      {authDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4">
          <div
            aria-label="登录后继续"
            aria-modal="true"
            className="w-full max-w-xl rounded-[2rem] border border-stone-900/10 bg-white p-8 shadow-[0_24px_80px_rgba(34,24,18,0.32)]"
            role="dialog"
          >
            <AuthFormCard
              hint="Checkpoint"
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
