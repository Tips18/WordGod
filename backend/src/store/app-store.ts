import {
  AuthSessionRecord,
  CrawlJobRecord,
  LexiconEntryRecord,
  PassageRecord,
  ReadingAttemptRecord,
  UserRecord,
  VocabularyContextRecord,
  VocabularyEntryRecord,
} from './store.types';

/**
 * `MaybePromise` 表示内存与数据库存储都可实现的返回值形态。
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * `APP_STORE` 是业务服务注入应用存储实现时使用的令牌。
 */
export const APP_STORE = Symbol('APP_STORE');

/**
 * `AppStore` 定义认证、阅读、生词本和内容管线共享的数据访问接口。
 */
export interface AppStore {
  findUserByEmail(email: string): MaybePromise<UserRecord | undefined>;
  findUserById(userId: string): MaybePromise<UserRecord | undefined>;
  saveUser(
    user: Omit<UserRecord, 'id'> & { id?: string },
  ): MaybePromise<UserRecord>;
  saveSession(
    session: Omit<AuthSessionRecord, 'id'> & { id?: string },
  ): MaybePromise<AuthSessionRecord>;
  listSessionsForUser(userId: string): MaybePromise<AuthSessionRecord[]>;
  listSessions(): MaybePromise<AuthSessionRecord[]>;
  removeSessionById(sessionId: string): MaybePromise<void>;
  listPassages(): MaybePromise<PassageRecord[]>;
  findPassage(passageId: string): MaybePromise<PassageRecord | undefined>;
  saveAttempt(
    attempt: Omit<ReadingAttemptRecord, 'id'> & { id?: string },
  ): MaybePromise<ReadingAttemptRecord>;
  findAttempt(
    userId: string,
    passageId: string,
  ): MaybePromise<ReadingAttemptRecord | undefined>;
  listVocabularyEntriesForUser(
    userId: string,
  ): MaybePromise<VocabularyEntryRecord[]>;
  findVocabularyEntry(
    userId: string,
    lemma: string,
  ): MaybePromise<VocabularyEntryRecord | undefined>;
  saveVocabularyEntry(
    entry: Omit<VocabularyEntryRecord, 'id'> & { id?: string },
  ): MaybePromise<VocabularyEntryRecord>;
  listVocabularyContexts(
    vocabularyEntryId: string,
  ): MaybePromise<VocabularyContextRecord[]>;
  replaceVocabularyContexts(
    vocabularyEntryId: string,
    contexts: Omit<VocabularyContextRecord, 'id'>[],
  ): MaybePromise<void>;
  findLexiconEntry(lemma: string): MaybePromise<LexiconEntryRecord | undefined>;
  listLexiconEntries(): MaybePromise<LexiconEntryRecord[]>;
  saveLexiconEntries(entries: LexiconEntryRecord[]): MaybePromise<void>;
  listCrawlJobs(): MaybePromise<CrawlJobRecord[]>;
  saveCrawlJob(
    job: Omit<CrawlJobRecord, 'id'> & { id?: string },
  ): MaybePromise<CrawlJobRecord>;
}
