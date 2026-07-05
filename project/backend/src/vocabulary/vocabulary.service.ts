import {
  PassageRecord,
  VocabularyContextRecord,
  VocabularyEntryRecord,
} from '../store/store.types';
import {
  PassageToken,
  VocabularyContextDto,
  VocabularyDetailResponse,
  VocabularyEntryDto,
  VocabularyListResponse,
} from '@word-god/contracts';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APP_STORE } from '../store/app-store';
import type { AppStore } from '../store/app-store';

/**
 * `VocabularyService` 负责生词本聚合、排序与详情查询。
 */
@Injectable()
export class VocabularyService {
  /**
   * `constructor` 注入生词服务所需的数据存储。
   */
  constructor(@Inject(APP_STORE) private readonly store: AppStore) {}

  /**
   * `recordMarks` 将一次段落检测的唯一 lemma 聚合进生词本。
   */
  async recordMarks(
    userId: string,
    passage: PassageRecord,
    selectedTokens: PassageToken[],
  ): Promise<number> {
    const selectedByLemma = new Map<string, PassageToken>();

    for (const token of selectedTokens) {
      if (token.isWord && !selectedByLemma.has(token.lemma)) {
        selectedByLemma.set(token.lemma, token);
      }
    }

    const markedAt = new Date().toISOString();

    for (const token of selectedByLemma.values()) {
      const existingEntry = await this.store.findVocabularyEntry(
        userId,
        token.lemma,
      );
      const savedEntry = await this.store.saveVocabularyEntry({
        id: existingEntry?.id,
        userId,
        lemma: token.lemma,
        surface: token.surface.toLowerCase(),
        partOfSpeech: token.partOfSpeech,
        definitionCn: token.definitionCn,
        markCount: (existingEntry?.markCount ?? 0) + 1,
        lastMarkedAt: markedAt,
      });
      const currentContexts = (
        await this.store.listVocabularyContexts(savedEntry.id)
      ).sort((left, right) => right.markedAt.localeCompare(left.markedAt));
      const sentence = passage.sentences[token.sentenceIndex];
      const nextContexts: Omit<VocabularyContextRecord, 'id'>[] = [
        {
          vocabularyEntryId: savedEntry.id,
          passageId: passage.id,
          sentenceText: sentence?.text ?? passage.content,
          sentenceTranslation: sentence?.translation ?? token.translationCn,
          markedAt,
        },
        ...currentContexts.map((context) => ({
          vocabularyEntryId: context.vocabularyEntryId,
          passageId: context.passageId,
          sentenceText: context.sentenceText,
          sentenceTranslation: context.sentenceTranslation,
          markedAt: context.markedAt,
        })),
      ].slice(0, 3);

      await this.store.replaceVocabularyContexts(savedEntry.id, nextContexts);
    }

    return selectedByLemma.size;
  }

  /**
   * `listForUser` 返回排序后的生词本列表。
   */
  async listForUser(userId: string): Promise<VocabularyListResponse> {
    const entries = await this.store.listVocabularyEntriesForUser(userId);
    const items = await Promise.all(
      entries
        .sort((left, right) => {
          if (right.markCount !== left.markCount) {
            return right.markCount - left.markCount;
          }

          return right.lastMarkedAt.localeCompare(left.lastMarkedAt);
        })
        .map((entry) => this.toDto(entry)),
    );

    return { items };
  }

  /**
   * `getDetail` 返回指定 lemma 的生词详情。
   */
  async getDetail(
    userId: string,
    lemma: string,
  ): Promise<VocabularyDetailResponse> {
    const entry = await this.store.findVocabularyEntry(userId, lemma);

    if (!entry) {
      throw new NotFoundException('生词不存在');
    }

    return {
      item: await this.toDto(entry),
    };
  }

  /**
   * `toDto` 将生词实体转换为接口返回结构。
   */
  private async toDto(
    entry: VocabularyEntryRecord,
  ): Promise<VocabularyEntryDto> {
    const contexts: VocabularyContextDto[] = (
      await this.store.listVocabularyContexts(entry.id)
    )
      .sort((left, right) => right.markedAt.localeCompare(left.markedAt))
      .map((context) => ({
        sentenceText: context.sentenceText,
        sentenceTranslation: context.sentenceTranslation,
        markedAt: context.markedAt,
        passageId: context.passageId,
      }));

    return {
      lemma: entry.lemma,
      surface: entry.surface,
      partOfSpeech: entry.partOfSpeech,
      definitionCn: entry.definitionCn,
      markCount: entry.markCount,
      lastMarkedAt: entry.lastMarkedAt,
      contexts,
    };
  }
}
