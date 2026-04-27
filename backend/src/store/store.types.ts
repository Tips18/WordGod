import {
  PassageSentence,
  PassageToken,
  PassageSummary,
} from '@word-god/contracts';

/**
 * `UserRecord` 描述内存存储中的用户实体。
 */
export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * `AuthSessionRecord` 描述刷新会话实体。
 */
export interface AuthSessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * `PassageRecord` 描述可直接展示的段落实体。
 */
export interface PassageRecord extends PassageSummary {
  sourceDomain: string;
  sentences: PassageSentence[];
  tokens: PassageToken[];
  publishedAt: string;
}

/**
 * `ReadingAttemptRecord` 描述当前段落的临时标记实体。
 */
export interface ReadingAttemptRecord {
  id: string;
  userId: string;
  passageId: string;
  selectedTokenIds: string[];
  completedAt: string | null;
}

/**
 * `VocabularyEntryRecord` 描述生词本主表实体。
 */
export interface VocabularyEntryRecord {
  id: string;
  userId: string;
  lemma: string;
  surface: string;
  partOfSpeech: string;
  definitionCn: string;
  markCount: number;
  lastMarkedAt: string;
}

/**
 * `VocabularyContextRecord` 描述生词上下文实体。
 */
export interface VocabularyContextRecord {
  id: string;
  vocabularyEntryId: string;
  passageId: string;
  sentenceText: string;
  sentenceTranslation: string;
  markedAt: string;
}

/**
 * `LexiconEntryRecord` 描述词典实体。
 */
export interface LexiconEntryRecord {
  id: string;
  lemma: string;
  surface: string;
  partOfSpeech: string;
  definitionCn: string;
  inflections: string[];
}

/**
 * `CrawlJobRecord` 描述抓取任务实体。
 */
export interface CrawlJobRecord {
  id: string;
  sourceUrl: string;
  sourceDomain: string;
  status: 'pending' | 'normalized' | 'translated' | 'ingested' | 'failed';
  rawContent: string;
  normalizedContent: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * `StoreSeed` 描述初始化内存存储时可注入的种子数据。
 */
export interface StoreSeed {
  users: UserRecord[];
  sessions: AuthSessionRecord[];
  passages: PassageRecord[];
  attempts: ReadingAttemptRecord[];
  vocabularyEntries: VocabularyEntryRecord[];
  vocabularyContexts: VocabularyContextRecord[];
  lexiconEntries: LexiconEntryRecord[];
  crawlJobs: CrawlJobRecord[];
}
