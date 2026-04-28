import { randomUUID } from 'node:crypto';
import {
  AuthSessionRecord,
  CrawlJobRecord,
  LexiconEntryRecord,
  PassageRecord,
  ReadingAttemptRecord,
  StoreSeed,
  UserRecord,
  VocabularyContextRecord,
  VocabularyEntryRecord,
} from './store.types';
import { AppStore } from './app-store';

/**
 * `InMemoryAppStore` 为当前服务提供可测试的内存数据存储。
 */
export class InMemoryAppStore implements AppStore {
  private readonly users: UserRecord[];
  private readonly sessions: AuthSessionRecord[];
  private readonly passages: PassageRecord[];
  private readonly attempts: ReadingAttemptRecord[];
  private readonly vocabularyEntries: VocabularyEntryRecord[];
  private readonly vocabularyContexts: VocabularyContextRecord[];
  private readonly lexiconEntries: LexiconEntryRecord[];
  private readonly crawlJobs: CrawlJobRecord[];

  /**
   * `constructor` 使用可选种子数据初始化内存状态。
   */
  constructor(seed?: Partial<StoreSeed>) {
    this.users = [...(seed?.users ?? [])];
    this.sessions = [...(seed?.sessions ?? [])];
    this.passages = [...(seed?.passages ?? [])];
    this.attempts = [...(seed?.attempts ?? [])];
    this.vocabularyEntries = [...(seed?.vocabularyEntries ?? [])];
    this.vocabularyContexts = [...(seed?.vocabularyContexts ?? [])];
    this.lexiconEntries = [...(seed?.lexiconEntries ?? [])];
    this.crawlJobs = [...(seed?.crawlJobs ?? [])];
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
      return savedUser;
    }

    this.users.push(savedUser);
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
      return savedSession;
    }

    this.sessions.push(savedSession);
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
      return savedAttempt;
    }

    this.attempts.push(savedAttempt);
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
      return savedEntry;
    }

    this.vocabularyEntries.push(savedEntry);
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
      return savedJob;
    }

    this.crawlJobs.push(savedJob);
    return savedJob;
  }
}
