import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppStore } from './app-store';
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
 * `toIsoString` 将数据库 Date 转为 DTO 使用的 ISO 字符串。
 */
function toIsoString(value: Date): string {
  return value.toISOString();
}

/**
 * `toJsonArray` 将 Prisma JSON 值转换为预期数组类型。
 */
function toJsonArray<TItem>(value: Prisma.JsonValue): TItem[] {
  return Array.isArray(value) ? (value as TItem[]) : [];
}

/**
 * `toUserRecord` 将 Prisma 用户实体转换为存储实体。
 */
function toUserRecord(user: {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}): UserRecord {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    createdAt: toIsoString(user.createdAt),
    updatedAt: toIsoString(user.updatedAt),
  };
}

/**
 * `toSessionRecord` 将 Prisma 会话实体转换为存储实体。
 */
function toSessionRecord(session: {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}): AuthSessionRecord {
  return {
    id: session.id,
    userId: session.userId,
    refreshTokenHash: session.refreshTokenHash,
    expiresAt: toIsoString(session.expiresAt),
    createdAt: toIsoString(session.createdAt),
  };
}

/**
 * `toPassageRecord` 将 Prisma 段落实体转换为阅读服务可用结构。
 */
function toPassageRecord(passage: {
  id: string;
  examType: string;
  year: number;
  paper: string;
  questionType: string;
  passageIndex: number;
  title: string;
  sourceUrl: string;
  sourceDomain: string;
  content: string;
  sentences: Prisma.JsonValue;
  tokens: Prisma.JsonValue;
  publishedAt: Date;
}): PassageRecord {
  return {
    id: passage.id,
    examType: passage.examType as PassageRecord['examType'],
    year: passage.year,
    paper: passage.paper,
    questionType: passage.questionType as PassageRecord['questionType'],
    passageIndex: passage.passageIndex,
    title: passage.title,
    sourceUrl: passage.sourceUrl,
    sourceDomain: passage.sourceDomain,
    content: passage.content,
    sentences: toJsonArray(passage.sentences),
    tokens: toJsonArray(passage.tokens),
    publishedAt: toIsoString(passage.publishedAt),
  };
}

/**
 * `toAttemptRecord` 将 Prisma 阅读状态转换为存储实体。
 */
function toAttemptRecord(attempt: {
  id: string;
  userId: string;
  passageId: string;
  selectedTokenIds: Prisma.JsonValue;
  completedAt: Date | null;
}): ReadingAttemptRecord {
  return {
    id: attempt.id,
    userId: attempt.userId,
    passageId: attempt.passageId,
    selectedTokenIds: toJsonArray<string>(attempt.selectedTokenIds),
    completedAt: attempt.completedAt ? toIsoString(attempt.completedAt) : null,
  };
}

/**
 * `toVocabularyEntryRecord` 将 Prisma 生词主记录转换为存储实体。
 */
function toVocabularyEntryRecord(entry: {
  id: string;
  userId: string;
  lemma: string;
  surface: string;
  partOfSpeech: string;
  definitionCn: string;
  markCount: number;
  lastMarkedAt: Date;
}): VocabularyEntryRecord {
  return {
    id: entry.id,
    userId: entry.userId,
    lemma: entry.lemma,
    surface: entry.surface,
    partOfSpeech: entry.partOfSpeech,
    definitionCn: entry.definitionCn,
    markCount: entry.markCount,
    lastMarkedAt: toIsoString(entry.lastMarkedAt),
  };
}

/**
 * `toVocabularyContextRecord` 将 Prisma 生词上下文转换为存储实体。
 */
function toVocabularyContextRecord(context: {
  id: string;
  vocabularyEntryId: string;
  passageId: string;
  sentenceText: string;
  sentenceTranslation: string;
  markedAt: Date;
}): VocabularyContextRecord {
  return {
    id: context.id,
    vocabularyEntryId: context.vocabularyEntryId,
    passageId: context.passageId,
    sentenceText: context.sentenceText,
    sentenceTranslation: context.sentenceTranslation,
    markedAt: toIsoString(context.markedAt),
  };
}

/**
 * `toLexiconEntryRecord` 将 Prisma 词典实体转换为存储实体。
 */
function toLexiconEntryRecord(entry: {
  id: string;
  lemma: string;
  surface: string;
  partOfSpeech: string;
  definitionCn: string;
  inflections: Prisma.JsonValue;
}): LexiconEntryRecord {
  return {
    id: entry.id,
    lemma: entry.lemma,
    surface: entry.surface,
    partOfSpeech: entry.partOfSpeech,
    definitionCn: entry.definitionCn,
    inflections: toJsonArray<string>(entry.inflections),
  };
}

/**
 * `toCrawlJobRecord` 将 Prisma 抓取任务转换为存储实体。
 */
function toCrawlJobRecord(job: {
  id: string;
  sourceUrl: string;
  sourceDomain: string;
  status: string;
  rawContent: string;
  normalizedContent: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CrawlJobRecord {
  return {
    id: job.id,
    sourceUrl: job.sourceUrl,
    sourceDomain: job.sourceDomain,
    status: job.status as CrawlJobRecord['status'],
    rawContent: job.rawContent,
    normalizedContent: job.normalizedContent,
    errorMessage: job.errorMessage,
    createdAt: toIsoString(job.createdAt),
    updatedAt: toIsoString(job.updatedAt),
  };
}

/**
 * `PrismaAppStore` 使用 PostgreSQL 为应用提供运行时数据访问。
 */
export class PrismaAppStore implements AppStore {
  /**
   * `constructor` 注入 Prisma 客户端服务。
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `findUserByEmail` 根据邮箱查询用户。
   */
  async findUserByEmail(email: string): Promise<UserRecord | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    return user ? toUserRecord(user) : undefined;
  }

  /**
   * `findUserById` 根据主键查询用户。
   */
  async findUserById(userId: string): Promise<UserRecord | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    return user ? toUserRecord(user) : undefined;
  }

  /**
   * `saveUser` 写入或更新用户实体。
   */
  async saveUser(user: Omit<UserRecord, 'id'> & { id?: string }): Promise<UserRecord> {
    const savedUser = user.id
      ? await this.prisma.user.upsert({
          where: { id: user.id },
          create: {
            id: user.id,
            email: user.email,
            passwordHash: user.passwordHash,
            createdAt: new Date(user.createdAt),
            updatedAt: new Date(user.updatedAt),
          },
          update: {
            email: user.email,
            passwordHash: user.passwordHash,
            updatedAt: new Date(user.updatedAt),
          },
        })
      : await this.prisma.user.create({
          data: {
            email: user.email,
            passwordHash: user.passwordHash,
            createdAt: new Date(user.createdAt),
            updatedAt: new Date(user.updatedAt),
          },
        });

    return toUserRecord(savedUser);
  }

  /**
   * `saveSession` 写入刷新会话。
   */
  async saveSession(
    session: Omit<AuthSessionRecord, 'id'> & { id?: string },
  ): Promise<AuthSessionRecord> {
    const savedSession = session.id
      ? await this.prisma.authSession.upsert({
          where: { id: session.id },
          create: {
            id: session.id,
            userId: session.userId,
            refreshTokenHash: session.refreshTokenHash,
            expiresAt: new Date(session.expiresAt),
            createdAt: new Date(session.createdAt),
          },
          update: {
            refreshTokenHash: session.refreshTokenHash,
            expiresAt: new Date(session.expiresAt),
          },
        })
      : await this.prisma.authSession.create({
          data: {
            userId: session.userId,
            refreshTokenHash: session.refreshTokenHash,
            expiresAt: new Date(session.expiresAt),
            createdAt: new Date(session.createdAt),
          },
        });

    return toSessionRecord(savedSession);
  }

  /**
   * `listSessionsForUser` 返回用户的全部会话。
   */
  async listSessionsForUser(userId: string): Promise<AuthSessionRecord[]> {
    const sessions = await this.prisma.authSession.findMany({
      where: { userId },
    });

    return sessions.map(toSessionRecord);
  }

  /**
   * `listSessions` 返回全部刷新会话。
   */
  async listSessions(): Promise<AuthSessionRecord[]> {
    const sessions = await this.prisma.authSession.findMany();

    return sessions.map(toSessionRecord);
  }

  /**
   * `removeSessionById` 删除指定会话。
   */
  async removeSessionById(sessionId: string): Promise<void> {
    await this.prisma.authSession.deleteMany({
      where: { id: sessionId },
    });
  }

  /**
   * `listPassages` 返回全部段落。
   */
  async listPassages(): Promise<PassageRecord[]> {
    const passages = await this.prisma.passage.findMany({
      orderBy: [{ year: 'desc' }, { paper: 'asc' }, { passageIndex: 'asc' }],
    });

    return passages.map(toPassageRecord);
  }

  /**
   * `findPassage` 根据主键查找段落。
   */
  async findPassage(passageId: string): Promise<PassageRecord | undefined> {
    const passage = await this.prisma.passage.findUnique({
      where: { id: passageId },
    });

    return passage ? toPassageRecord(passage) : undefined;
  }

  /**
   * `saveAttempt` 以覆盖方式写入当前段落的临时状态。
   */
  async saveAttempt(
    attempt: Omit<ReadingAttemptRecord, 'id'> & { id?: string },
  ): Promise<ReadingAttemptRecord> {
    const savedAttempt = await this.prisma.readingAttempt.upsert({
      where: {
        userId_passageId: {
          userId: attempt.userId,
          passageId: attempt.passageId,
        },
      },
      create: {
        id: attempt.id,
        userId: attempt.userId,
        passageId: attempt.passageId,
        selectedTokenIds: attempt.selectedTokenIds,
        completedAt: attempt.completedAt ? new Date(attempt.completedAt) : null,
      },
      update: {
        selectedTokenIds: attempt.selectedTokenIds,
        completedAt: attempt.completedAt ? new Date(attempt.completedAt) : null,
      },
    });

    return toAttemptRecord(savedAttempt);
  }

  /**
   * `findAttempt` 查找用户在指定段落的临时状态。
   */
  async findAttempt(
    userId: string,
    passageId: string,
  ): Promise<ReadingAttemptRecord | undefined> {
    const attempt = await this.prisma.readingAttempt.findUnique({
      where: {
        userId_passageId: {
          userId,
          passageId,
        },
      },
    });

    return attempt ? toAttemptRecord(attempt) : undefined;
  }

  /**
   * `listVocabularyEntriesForUser` 返回用户全部生词主记录。
   */
  async listVocabularyEntriesForUser(userId: string): Promise<VocabularyEntryRecord[]> {
    const entries = await this.prisma.vocabularyEntry.findMany({
      where: { userId },
    });

    return entries.map(toVocabularyEntryRecord);
  }

  /**
   * `findVocabularyEntry` 根据用户和 lemma 查询生词主记录。
   */
  async findVocabularyEntry(
    userId: string,
    lemma: string,
  ): Promise<VocabularyEntryRecord | undefined> {
    const entry = await this.prisma.vocabularyEntry.findUnique({
      where: {
        userId_lemma: {
          userId,
          lemma,
        },
      },
    });

    return entry ? toVocabularyEntryRecord(entry) : undefined;
  }

  /**
   * `saveVocabularyEntry` 写入或更新生词主记录。
   */
  async saveVocabularyEntry(
    entry: Omit<VocabularyEntryRecord, 'id'> & { id?: string },
  ): Promise<VocabularyEntryRecord> {
    const savedEntry = await this.prisma.vocabularyEntry.upsert({
      where: {
        userId_lemma: {
          userId: entry.userId,
          lemma: entry.lemma,
        },
      },
      create: {
        id: entry.id,
        userId: entry.userId,
        lemma: entry.lemma,
        surface: entry.surface,
        partOfSpeech: entry.partOfSpeech,
        definitionCn: entry.definitionCn,
        markCount: entry.markCount,
        lastMarkedAt: new Date(entry.lastMarkedAt),
      },
      update: {
        surface: entry.surface,
        partOfSpeech: entry.partOfSpeech,
        definitionCn: entry.definitionCn,
        markCount: entry.markCount,
        lastMarkedAt: new Date(entry.lastMarkedAt),
      },
    });

    return toVocabularyEntryRecord(savedEntry);
  }

  /**
   * `listVocabularyContexts` 返回指定词条的上下文。
   */
  async listVocabularyContexts(vocabularyEntryId: string): Promise<VocabularyContextRecord[]> {
    const contexts = await this.prisma.vocabularyContext.findMany({
      where: { vocabularyEntryId },
    });

    return contexts.map(toVocabularyContextRecord);
  }

  /**
   * `replaceVocabularyContexts` 使用新上下文集合覆盖旧上下文。
   */
  async replaceVocabularyContexts(
    vocabularyEntryId: string,
    contexts: Omit<VocabularyContextRecord, 'id'>[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.vocabularyContext.deleteMany({
        where: { vocabularyEntryId },
      }),
      ...contexts.map((context) =>
        this.prisma.vocabularyContext.create({
          data: {
            vocabularyEntryId: context.vocabularyEntryId,
            passageId: context.passageId,
            sentenceText: context.sentenceText,
            sentenceTranslation: context.sentenceTranslation,
            markedAt: new Date(context.markedAt),
          },
        }),
      ),
    ]);
  }

  /**
   * `listLexiconEntries` 返回当前词典数据。
   */
  async listLexiconEntries(): Promise<LexiconEntryRecord[]> {
    const entries = await this.prisma.lexiconEntry.findMany();

    return entries.map(toLexiconEntryRecord);
  }

  /**
   * `saveLexiconEntries` 覆盖写入词典数据。
   */
  async saveLexiconEntries(entries: LexiconEntryRecord[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.lexiconEntry.deleteMany(),
      ...entries.map((entry) =>
        this.prisma.lexiconEntry.create({
          data: {
            id: entry.id,
            lemma: entry.lemma,
            surface: entry.surface,
            partOfSpeech: entry.partOfSpeech,
            definitionCn: entry.definitionCn,
            inflections: entry.inflections,
          },
        }),
      ),
    ]);
  }

  /**
   * `listCrawlJobs` 返回抓取任务集合。
   */
  async listCrawlJobs(): Promise<CrawlJobRecord[]> {
    const jobs = await this.prisma.crawlJob.findMany();

    return jobs.map(toCrawlJobRecord);
  }

  /**
   * `saveCrawlJob` 写入或更新抓取任务。
   */
  async saveCrawlJob(
    job: Omit<CrawlJobRecord, 'id'> & { id?: string },
  ): Promise<CrawlJobRecord> {
    const savedJob = job.id
      ? await this.prisma.crawlJob.upsert({
          where: { id: job.id },
          create: {
            id: job.id,
            sourceUrl: job.sourceUrl,
            sourceDomain: job.sourceDomain,
            status: job.status,
            rawContent: job.rawContent,
            normalizedContent: job.normalizedContent,
            errorMessage: job.errorMessage,
            createdAt: new Date(job.createdAt),
            updatedAt: new Date(job.updatedAt),
          },
          update: {
            status: job.status,
            rawContent: job.rawContent,
            normalizedContent: job.normalizedContent,
            errorMessage: job.errorMessage,
            updatedAt: new Date(job.updatedAt),
          },
        })
      : await this.prisma.crawlJob.create({
          data: {
            sourceUrl: job.sourceUrl,
            sourceDomain: job.sourceDomain,
            status: job.status,
            rawContent: job.rawContent,
            normalizedContent: job.normalizedContent,
            errorMessage: job.errorMessage,
            createdAt: new Date(job.createdAt),
            updatedAt: new Date(job.updatedAt),
          },
        });

    return toCrawlJobRecord(savedJob);
  }
}
