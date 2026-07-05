import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import {
  AuthSessionRecord,
  CrawlJobRecord,
  EmailVerificationCodeRecord,
  LexiconEntryRecord,
  PassageRecord,
  ReadingAttemptRecord,
  StoreSeed,
  UserRecord,
  VocabularyContextRecord,
  VocabularyEntryRecord,
} from './store.types';
import { AppStore } from './app-store';

export interface InMemoryAppStoreOptions {
  persistencePath?: string;
}

type PersistedMemoryStore = Pick<
  StoreSeed,
  | 'users'
  | 'sessions'
  | 'emailVerificationCodes'
  | 'attempts'
  | 'vocabularyEntries'
  | 'vocabularyContexts'
  | 'lexiconEntries'
  | 'crawlJobs'
>;

/**
 * `readPersistedMemoryStore` 从本地 JSON 文件读取内存存储的运行态数据。
 */
function readPersistedMemoryStore(
  persistencePath: string | undefined,
): Partial<PersistedMemoryStore> {
  if (!persistencePath || !existsSync(persistencePath)) {
    return {};
  }

  const parsed = JSON.parse(readFileSync(persistencePath, 'utf8')) as Partial<
    Record<keyof PersistedMemoryStore, unknown>
  >;

  return {
    users: Array.isArray(parsed.users) ? (parsed.users as UserRecord[]) : [],
    sessions: Array.isArray(parsed.sessions)
      ? (parsed.sessions as AuthSessionRecord[])
      : [],
    emailVerificationCodes: Array.isArray(parsed.emailVerificationCodes)
      ? (parsed.emailVerificationCodes as EmailVerificationCodeRecord[])
      : [],
    attempts: Array.isArray(parsed.attempts)
      ? (parsed.attempts as ReadingAttemptRecord[])
      : [],
    vocabularyEntries: Array.isArray(parsed.vocabularyEntries)
      ? (parsed.vocabularyEntries as VocabularyEntryRecord[])
      : [],
    vocabularyContexts: Array.isArray(parsed.vocabularyContexts)
      ? (parsed.vocabularyContexts as VocabularyContextRecord[])
      : [],
    lexiconEntries: Array.isArray(parsed.lexiconEntries)
      ? (parsed.lexiconEntries as LexiconEntryRecord[])
      : [],
    crawlJobs: Array.isArray(parsed.crawlJobs)
      ? (parsed.crawlJobs as CrawlJobRecord[])
      : [],
  };
}

/**
 * `resolveSeedArray` 在持久化数据存在时优先使用持久化数组。
 */
function resolveSeedArray<T>(
  persistedItems: T[] | undefined,
  seedItems: T[] | undefined,
): T[] {
  return [...(persistedItems ?? seedItems ?? [])];
}

/**
 * `InMemoryAppStore` 为当前服务提供可测试的内存数据存储。
 */
export class InMemoryAppStore implements AppStore {
  private readonly persistencePath: string | null;
  private readonly users: UserRecord[];
  private readonly sessions: AuthSessionRecord[];
  private readonly emailVerificationCodes: EmailVerificationCodeRecord[];
  private readonly passages: PassageRecord[];
  private readonly attempts: ReadingAttemptRecord[];
  private readonly vocabularyEntries: VocabularyEntryRecord[];
  private readonly vocabularyContexts: VocabularyContextRecord[];
  private readonly lexiconEntries: LexiconEntryRecord[];
  private readonly crawlJobs: CrawlJobRecord[];

  /**
   * `constructor` 使用可选种子数据初始化内存状态。
   */
  constructor(seed?: Partial<StoreSeed>, options?: InMemoryAppStoreOptions) {
    const persistedSeed = readPersistedMemoryStore(options?.persistencePath);

    this.persistencePath = options?.persistencePath ?? null;
    this.users = resolveSeedArray(persistedSeed.users, seed?.users);
    this.sessions = resolveSeedArray(persistedSeed.sessions, seed?.sessions);
    this.emailVerificationCodes = resolveSeedArray(
      persistedSeed.emailVerificationCodes,
      seed?.emailVerificationCodes,
    );
    this.passages = [...(seed?.passages ?? [])];
    this.attempts = resolveSeedArray(persistedSeed.attempts, seed?.attempts);
    this.vocabularyEntries = resolveSeedArray(
      persistedSeed.vocabularyEntries,
      seed?.vocabularyEntries,
    );
    this.vocabularyContexts = resolveSeedArray(
      persistedSeed.vocabularyContexts,
      seed?.vocabularyContexts,
    );
    this.lexiconEntries = resolveSeedArray(
      persistedSeed.lexiconEntries,
      seed?.lexiconEntries,
    );
    this.crawlJobs = resolveSeedArray(persistedSeed.crawlJobs, seed?.crawlJobs);
  }

  /**
   * `persistRuntimeState` 将内存运行态数据写入本地 JSON 文件。
   */
  private persistRuntimeState(): void {
    if (!this.persistencePath) {
      return;
    }

    mkdirSync(dirname(this.persistencePath), { recursive: true });
    writeFileSync(
      this.persistencePath,
      JSON.stringify(
        {
          users: this.users,
          sessions: this.sessions,
          emailVerificationCodes: this.emailVerificationCodes,
          attempts: this.attempts,
          vocabularyEntries: this.vocabularyEntries,
          vocabularyContexts: this.vocabularyContexts,
          lexiconEntries: this.lexiconEntries,
          crawlJobs: this.crawlJobs,
        },
        null,
        2,
      ),
      'utf8',
    );
  }

  /**
   * `findUserByEmail` 根据邮箱查询用户。
   */
  findUserByEmail(email: string): UserRecord | undefined {
    return this.users.find(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    );
  }

  /**
   * `findUserById` 根据主键查询用户。
   */
  findUserById(userId: string): UserRecord | undefined {
    return this.users.find((user) => user.id === userId);
  }

  /**
   * `saveUser` 写入或更新用户实体。
   */
  saveUser(user: Omit<UserRecord, 'id'> & { id?: string }): UserRecord {
    const existingIndex = user.id
      ? this.users.findIndex((item) => item.id === user.id)
      : -1;
    const savedUser: UserRecord = {
      id: user.id ?? randomUUID(),
      ...user,
    };

    if (existingIndex >= 0) {
      this.users[existingIndex] = savedUser;
      this.persistRuntimeState();
      return savedUser;
    }

    this.users.push(savedUser);
    this.persistRuntimeState();
    return savedUser;
  }

  /**
   * `saveSession` 写入刷新会话。
   */
  saveSession(
    session: Omit<AuthSessionRecord, 'id'> & { id?: string },
  ): AuthSessionRecord {
    const existingIndex = session.id
      ? this.sessions.findIndex((item) => item.id === session.id)
      : -1;
    const savedSession: AuthSessionRecord = {
      id: session.id ?? randomUUID(),
      ...session,
    };

    if (existingIndex >= 0) {
      this.sessions[existingIndex] = savedSession;
      this.persistRuntimeState();
      return savedSession;
    }

    this.sessions.push(savedSession);
    this.persistRuntimeState();
    return savedSession;
  }

  /**
   * `listSessionsForUser` 返回用户的全部会话。
   */
  listSessionsForUser(userId: string): AuthSessionRecord[] {
    return this.sessions.filter((session) => session.userId === userId);
  }

  /**
   * `listSessions` 返回全部刷新会话。
   */
  listSessions(): AuthSessionRecord[] {
    return [...this.sessions];
  }

  /**
   * `findSessionByTokenHash` 根据哈希查找刷新会话。
   */
  findSessionByTokenHash(tokenHash: string): AuthSessionRecord | undefined {
    return this.sessions.find(
      (session) => session.refreshTokenHash === tokenHash,
    );
  }

  /**
   * `removeSessionById` 删除指定会话。
   */
  removeSessionById(sessionId: string): void {
    const sessionIndex = this.sessions.findIndex(
      (session) => session.id === sessionId,
    );

    if (sessionIndex >= 0) {
      this.sessions.splice(sessionIndex, 1);
      this.persistRuntimeState();
    }
  }

  /**
   * `findLatestEmailCode` 返回指定邮箱和用途的最新验证码记录。
   */
  findLatestEmailCode(
    email: string,
    purpose: EmailVerificationCodeRecord['purpose'],
  ): EmailVerificationCodeRecord | undefined {
    return [...this.emailVerificationCodes]
      .filter(
        (code) =>
          code.email.toLowerCase() === email.toLowerCase() &&
          code.purpose === purpose,
      )
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      )[0];
  }

  /**
   * `saveEmailCode` 写入或更新邮箱验证码记录。
   */
  saveEmailCode(
    code: Omit<EmailVerificationCodeRecord, 'id'> & { id?: string },
  ): EmailVerificationCodeRecord {
    const existingIndex = code.id
      ? this.emailVerificationCodes.findIndex((item) => item.id === code.id)
      : -1;
    const savedCode: EmailVerificationCodeRecord = {
      id: code.id ?? randomUUID(),
      ...code,
    };

    if (existingIndex >= 0) {
      this.emailVerificationCodes[existingIndex] = savedCode;
      this.persistRuntimeState();
      return savedCode;
    }

    this.emailVerificationCodes.push(savedCode);
    this.persistRuntimeState();
    return savedCode;
  }

  /**
   * `invalidateEmailCodes` 将同邮箱同用途的未消费验证码标记为已作废。
   */
  invalidateEmailCodes(
    email: string,
    purpose: EmailVerificationCodeRecord['purpose'],
    consumedAt: string,
  ): void {
    let invalidated = false;

    for (const code of this.emailVerificationCodes) {
      if (
        code.email.toLowerCase() === email.toLowerCase() &&
        code.purpose === purpose &&
        !code.consumedAt
      ) {
        code.consumedAt = consumedAt;
        invalidated = true;
      }
    }

    if (invalidated) {
      this.persistRuntimeState();
    }
  }

  /**
   * `listPassages` 返回全部段落。
   */
  listPassages(): PassageRecord[] {
    return [...this.passages];
  }

  /**
   * `findPassage` 根据主键查找段落。
   */
  findPassage(passageId: string): PassageRecord | undefined {
    return this.passages.find((passage) => passage.id === passageId);
  }

  /**
   * `saveAttempt` 以覆盖方式写入当前段落的临时状态。
   */
  saveAttempt(
    attempt: Omit<ReadingAttemptRecord, 'id'> & { id?: string },
  ): ReadingAttemptRecord {
    const existingIndex = this.attempts.findIndex(
      (item) =>
        item.userId === attempt.userId && item.passageId === attempt.passageId,
    );
    const savedAttempt: ReadingAttemptRecord = {
      id:
        existingIndex >= 0
          ? this.attempts[existingIndex].id
          : (attempt.id ?? randomUUID()),
      ...attempt,
    };

    if (existingIndex >= 0) {
      this.attempts[existingIndex] = savedAttempt;
      this.persistRuntimeState();
      return savedAttempt;
    }

    this.attempts.push(savedAttempt);
    this.persistRuntimeState();
    return savedAttempt;
  }

  /**
   * `findAttempt` 查找用户在指定段落的临时状态。
   */
  findAttempt(
    userId: string,
    passageId: string,
  ): ReadingAttemptRecord | undefined {
    return this.attempts.find(
      (attempt) => attempt.userId === userId && attempt.passageId === passageId,
    );
  }

  /**
   * `listVocabularyEntriesForUser` 返回用户全部生词主记录。
   */
  listVocabularyEntriesForUser(userId: string): VocabularyEntryRecord[] {
    return this.vocabularyEntries.filter((entry) => entry.userId === userId);
  }

  /**
   * `findVocabularyEntry` 根据用户和 lemma 查询生词主记录。
   */
  findVocabularyEntry(
    userId: string,
    lemma: string,
  ): VocabularyEntryRecord | undefined {
    return this.vocabularyEntries.find(
      (entry) => entry.userId === userId && entry.lemma === lemma,
    );
  }

  /**
   * `saveVocabularyEntry` 写入或更新生词主记录。
   */
  saveVocabularyEntry(
    entry: Omit<VocabularyEntryRecord, 'id'> & { id?: string },
  ): VocabularyEntryRecord {
    const existingIndex = entry.id
      ? this.vocabularyEntries.findIndex((item) => item.id === entry.id)
      : this.vocabularyEntries.findIndex(
          (item) => item.userId === entry.userId && item.lemma === entry.lemma,
        );
    const savedEntry: VocabularyEntryRecord = {
      id:
        existingIndex >= 0
          ? this.vocabularyEntries[existingIndex].id
          : (entry.id ?? randomUUID()),
      ...entry,
    };

    if (existingIndex >= 0) {
      this.vocabularyEntries[existingIndex] = savedEntry;
      this.persistRuntimeState();
      return savedEntry;
    }

    this.vocabularyEntries.push(savedEntry);
    this.persistRuntimeState();
    return savedEntry;
  }

  /**
   * `listVocabularyContexts` 返回指定词条的上下文。
   */
  listVocabularyContexts(vocabularyEntryId: string): VocabularyContextRecord[] {
    return this.vocabularyContexts.filter(
      (context) => context.vocabularyEntryId === vocabularyEntryId,
    );
  }

  /**
   * `replaceVocabularyContexts` 使用新上下文集合覆盖旧上下文。
   */
  replaceVocabularyContexts(
    vocabularyEntryId: string,
    contexts: Omit<VocabularyContextRecord, 'id'>[],
  ): void {
    const remaining = this.vocabularyContexts.filter(
      (context) => context.vocabularyEntryId !== vocabularyEntryId,
    );
    const nextContexts = contexts.map((context) => ({
      id: randomUUID(),
      ...context,
    }));

    this.vocabularyContexts.splice(
      0,
      this.vocabularyContexts.length,
      ...remaining,
      ...nextContexts,
    );
    this.persistRuntimeState();
  }

  /**
   * `findLexiconEntry` 按 lemma 查询单个词典条目。
   */
  findLexiconEntry(lemma: string): LexiconEntryRecord | undefined {
    return this.lexiconEntries.find((entry) => entry.lemma === lemma);
  }

  /**
   * `listLexiconEntries` 返回当前词典数据。
   */
  listLexiconEntries(): LexiconEntryRecord[] {
    return [...this.lexiconEntries];
  }

  /**
   * `saveLexiconEntries` 覆盖写入词典数据。
   */
  saveLexiconEntries(entries: LexiconEntryRecord[]): void {
    this.lexiconEntries.splice(0, this.lexiconEntries.length, ...entries);
    this.persistRuntimeState();
  }

  /**
   * `listCrawlJobs` 返回抓取任务集合。
   */
  listCrawlJobs(): CrawlJobRecord[] {
    return [...this.crawlJobs];
  }

  /**
   * `saveCrawlJob` 写入或更新抓取任务。
   */
  saveCrawlJob(
    job: Omit<CrawlJobRecord, 'id'> & { id?: string },
  ): CrawlJobRecord {
    const existingIndex = job.id
      ? this.crawlJobs.findIndex((item) => item.id === job.id)
      : -1;
    const savedJob: CrawlJobRecord = {
      id:
        existingIndex >= 0
          ? this.crawlJobs[existingIndex].id
          : (job.id ?? randomUUID()),
      ...job,
    };

    if (existingIndex >= 0) {
      this.crawlJobs[existingIndex] = savedJob;
      this.persistRuntimeState();
      return savedJob;
    }

    this.crawlJobs.push(savedJob);
    this.persistRuntimeState();
    return savedJob;
  }
}
