import type {
  CompleteReadingAttemptResponse,
  ReadingPassageResponse,
  SyncReadingAttemptRequest,
  VocabularyContextDto,
  VocabularyDetailResponse,
  VocabularyEntryDto,
  VocabularyListResponse,
} from '@word-god/contracts';

const LOCAL_USER = {
  id: 'local-user',
  email: 'local@wordgod.app',
} as const;
const STATE_STORAGE_KEY = 'wordgod.mobile.runtime.v1';
const STATE_SCHEMA_VERSION = 1;

interface MobileLocalClientOptions {
  passages: ReadingPassageResponse[];
  storage?: Storage;
  now?: () => string;
  random?: () => number;
}

interface MobileAttemptState {
  selectedTokenIds: string[];
  completedAt: string | null;
}

interface MobileVocabularyEntryState {
  lemma: string;
  surface: string;
  partOfSpeech: string;
  definitionCn: string;
  markCount: number;
  lastMarkedAt: string;
  contexts: VocabularyContextDto[];
}

interface MobileRuntimeState {
  schemaVersion: number;
  attempts: Record<string, MobileAttemptState>;
  vocabularyEntries: Record<string, MobileVocabularyEntryState>;
}

export interface MobileLocalClient {
  getCurrentUser: () => Promise<{ user: typeof LOCAL_USER }>;
  getRandomPassage: (excludePassageId?: string) => Promise<ReadingPassageResponse>;
  syncReadingAttempt: (
    passageId: string,
    payload: SyncReadingAttemptRequest,
  ) => Promise<{ success: true }>;
  completeReadingAttempt: (
    passageId: string,
  ) => Promise<CompleteReadingAttemptResponse>;
  listVocabulary: () => Promise<VocabularyListResponse>;
  getVocabularyDetail: (lemma: string) => Promise<VocabularyDetailResponse>;
}

/**
 * `createDefaultState` 创建移动端本地存储的初始状态。
 */
function createDefaultState(): MobileRuntimeState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    attempts: {},
    vocabularyEntries: {},
  };
}

/**
 * `readStoredState` 从本地存储中读取移动端运行态。
 */
function readStoredState(storage: Storage | null): MobileRuntimeState {
  if (!storage) {
    return createDefaultState();
  }

  const storedValue = storage.getItem(STATE_STORAGE_KEY);

  if (!storedValue) {
    return createDefaultState();
  }

  try {
    const parsed = JSON.parse(storedValue) as Partial<MobileRuntimeState>;

    if (parsed.schemaVersion !== STATE_SCHEMA_VERSION) {
      return createDefaultState();
    }

    return {
      schemaVersion: STATE_SCHEMA_VERSION,
      attempts: parsed.attempts ?? {},
      vocabularyEntries: parsed.vocabularyEntries ?? {},
    };
  } catch {
    return createDefaultState();
  }
}

/**
 * `writeStoredState` 将移动端运行态写回本地存储。
 */
function writeStoredState(
  storage: Storage | null,
  state: MobileRuntimeState,
): void {
  storage?.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
}

/**
 * `createStorage` 获取浏览器环境可用的本地存储对象。
 */
function createStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

/**
 * `clonePassageResponse` 复制段落响应并覆盖当前本地选择状态。
 */
function clonePassageResponse(
  passage: ReadingPassageResponse,
  selectedTokenIds: string[],
): ReadingPassageResponse {
  return {
    passage: { ...passage.passage },
    sentences: passage.sentences.map((sentence) => ({ ...sentence })),
    tokens: passage.tokens.map((token) => ({ ...token })),
    selectedTokenIds,
    requiresAuthToComplete: false,
  };
}

/**
 * `getPassageOrThrow` 根据段落主键查找离线题库条目。
 */
function getPassageOrThrow(
  passages: ReadingPassageResponse[],
  passageId: string,
): ReadingPassageResponse {
  const passage = passages.find((item) => item.passage.id === passageId);

  if (!passage) {
    throw new Error('段落不存在');
  }

  return passage;
}

/**
 * `selectRandomPassage` 从离线题库中选择一个随机段落。
 */
function selectRandomPassage(
  passages: ReadingPassageResponse[],
  random: () => number,
  excludePassageId?: string,
): ReadingPassageResponse {
  const availablePassages = excludePassageId
    ? passages.filter((item) => item.passage.id !== excludePassageId)
    : passages;
  const candidates = availablePassages.length > 0 ? availablePassages : passages;
  const selectedIndex = Math.min(
    Math.floor(random() * candidates.length),
    candidates.length - 1,
  );
  const passage = candidates[selectedIndex];

  if (!passage) {
    throw new Error('暂无可用段落');
  }

  return passage;
}

/**
 * `createUniqueTokenSelection` 过滤并去重当前段落内有效 token。
 */
function createUniqueTokenSelection(
  passage: ReadingPassageResponse,
  selectedTokenIds: string[],
): string[] {
  const validTokenIds = new Set(passage.tokens.map((token) => token.id));

  return Array.from(new Set(selectedTokenIds)).filter((tokenId) =>
    validTokenIds.has(tokenId),
  );
}

/**
 * `createSelectedTokensByLemma` 将已选 token 规整为同 lemma 只保留一个。
 */
function createSelectedTokensByLemma(
  passage: ReadingPassageResponse,
  selectedTokenIds: string[],
): typeof passage.tokens {
  const selectedTokenIdSet = new Set(selectedTokenIds);
  const selectedTokens = new Map<string, (typeof passage.tokens)[number]>();

  for (const token of passage.tokens) {
    if (token.isWord && selectedTokenIdSet.has(token.id)) {
      selectedTokens.set(token.lemma, token);
    }
  }

  return Array.from(selectedTokens.values());
}

/**
 * `toVocabularyDto` 将本地生词状态转换为页面消费的 DTO。
 */
function toVocabularyDto(
  entry: MobileVocabularyEntryState,
): VocabularyEntryDto {
  return {
    lemma: entry.lemma,
    surface: entry.surface,
    partOfSpeech: entry.partOfSpeech,
    definitionCn: entry.definitionCn,
    markCount: entry.markCount,
    lastMarkedAt: entry.lastMarkedAt,
    contexts: entry.contexts,
  };
}

/**
 * `createMobileLocalClient` 创建 APK 离线模式使用的本地数据客户端。
 */
export function createMobileLocalClient(
  options: MobileLocalClientOptions,
): MobileLocalClient {
  const storage = options.storage ?? createStorage();
  const now = options.now ?? (() => new Date().toISOString());
  const random = options.random ?? Math.random;
  let state = readStoredState(storage);

  /**
   * `saveState` 持久化当前移动端运行态。
   */
  function saveState(nextState: MobileRuntimeState): void {
    state = nextState;
    writeStoredState(storage, state);
  }

  /**
   * `getCurrentUser` 返回 APK 本机默认用户。
   */
  async function getCurrentUser(): Promise<{ user: typeof LOCAL_USER }> {
    return { user: LOCAL_USER };
  }

  /**
   * `getRandomPassage` 返回带本地选择状态的离线随机段落。
   */
  async function getRandomPassage(
    excludePassageId?: string,
  ): Promise<ReadingPassageResponse> {
    const passage = selectRandomPassage(
      options.passages,
      random,
      excludePassageId,
    );
    const selectedTokenIds =
      state.attempts[passage.passage.id]?.selectedTokenIds ?? [];

    return clonePassageResponse(passage, selectedTokenIds);
  }

  /**
   * `syncReadingAttempt` 保存当前段落的本地临时标记集合。
   */
  async function syncReadingAttempt(
    passageId: string,
    payload: SyncReadingAttemptRequest,
  ): Promise<{ success: true }> {
    const passage = getPassageOrThrow(options.passages, passageId);
    const selectedTokenIds = createUniqueTokenSelection(
      passage,
      payload.selectedTokenIds,
    );

    saveState({
      ...state,
      attempts: {
        ...state.attempts,
        [passageId]: {
          selectedTokenIds,
          completedAt: state.attempts[passageId]?.completedAt ?? null,
        },
      },
    });

    return { success: true };
  }

  /**
   * `completeReadingAttempt` 将本地标记结算进本机生词本。
   */
  async function completeReadingAttempt(
    passageId: string,
  ): Promise<CompleteReadingAttemptResponse> {
    const passage = getPassageOrThrow(options.passages, passageId);
    const attempt = state.attempts[passageId] ?? {
      selectedTokenIds: [],
      completedAt: null,
    };
    const selectedTokens = createSelectedTokensByLemma(
      passage,
      attempt.selectedTokenIds,
    );
    const markedAt = now();
    const vocabularyEntries = { ...state.vocabularyEntries };

    for (const token of selectedTokens) {
      const existingEntry = vocabularyEntries[token.lemma];
      const sentence = passage.sentences[token.sentenceIndex];
      const nextContext: VocabularyContextDto = {
        passageId: passage.passage.id,
        sentenceText: sentence?.text ?? passage.passage.content,
        sentenceTranslation: sentence?.translation ?? token.translationCn,
        markedAt,
      };

      vocabularyEntries[token.lemma] = {
        lemma: token.lemma,
        surface: token.surface.toLowerCase(),
        partOfSpeech: token.partOfSpeech,
        definitionCn: token.definitionCn,
        markCount: (existingEntry?.markCount ?? 0) + 1,
        lastMarkedAt: markedAt,
        contexts: [nextContext, ...(existingEntry?.contexts ?? [])].slice(0, 3),
      };
    }

    saveState({
      ...state,
      attempts: {
        ...state.attempts,
        [passageId]: {
          selectedTokenIds: attempt.selectedTokenIds,
          completedAt: markedAt,
        },
      },
      vocabularyEntries,
    });

    return {
      completedPassageId: passageId,
      savedLemmaCount: selectedTokens.length,
      nextPassage: await getRandomPassage(passageId),
    };
  }

  /**
   * `listVocabulary` 返回本机生词本排序列表。
   */
  async function listVocabulary(): Promise<VocabularyListResponse> {
    const items = Object.values(state.vocabularyEntries)
      .sort((left, right) => {
        if (right.markCount !== left.markCount) {
          return right.markCount - left.markCount;
        }

        return right.lastMarkedAt.localeCompare(left.lastMarkedAt);
      })
      .map(toVocabularyDto);

    return { items };
  }

  /**
   * `getVocabularyDetail` 返回本机生词详情。
   */
  async function getVocabularyDetail(
    lemma: string,
  ): Promise<VocabularyDetailResponse> {
    const entry = state.vocabularyEntries[lemma];

    if (!entry) {
      throw new Error('生词不存在');
    }

    return { item: toVocabularyDto(entry) };
  }

  return {
    completeReadingAttempt,
    getCurrentUser,
    getRandomPassage,
    getVocabularyDetail,
    listVocabulary,
    syncReadingAttempt,
  };
}
