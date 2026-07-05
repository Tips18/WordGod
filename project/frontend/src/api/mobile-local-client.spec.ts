import type { ReadingPassageResponse } from '@word-god/contracts';
import { describe, expect, it } from 'vitest';
import { createMobileLocalClient } from './mobile-local-client';

/**
 * `createPassage` 构造移动端本地客户端测试使用的段落响应。
 */
function createPassage(
  id: string,
  lemma: string,
  markedAtIndex: number,
): ReadingPassageResponse {
  const sentenceText = `${lemma} appears in context ${markedAtIndex}.`;
  const sentenceTranslation = `${lemma} 的第 ${markedAtIndex} 条中文语境。`;

  return {
    passage: {
      id,
      examType: 'kaoyan',
      year: 2026,
      paper: '英语一',
      questionType: 'reading',
      passageIndex: markedAtIndex,
      textIndex: markedAtIndex,
      paragraphIndex: 1,
      title: `Passage ${markedAtIndex}`,
      content: sentenceText,
      sourceUrl: 'https://example.com',
    },
    sentences: [
      {
        index: 0,
        text: sentenceText,
        translation: sentenceTranslation,
      },
    ],
    tokens: [
      {
        id: `${id}-token`,
        lemma,
        surface: lemma,
        sentenceIndex: 0,
        partOfSpeech: 'n.',
        definitionCn: `${lemma} 的释义`,
        translationCn: sentenceTranslation,
        isWord: true,
      },
    ],
    selectedTokenIds: [],
    requiresAuthToComplete: false,
  };
}

/**
 * `createMemoryStorage` 构造符合 localStorage 接口的内存存储。
 */
function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('createMobileLocalClient', () => {
  it('uses a default local user and never requires authentication to complete reading', async () => {
    const client = createMobileLocalClient({
      now: () => '2026-05-27T00:00:00.000Z',
      passages: [createPassage('passage-1', 'obscure', 1)],
      random: () => 0,
      storage: createMemoryStorage(),
    });

    await expect(client.getCurrentUser()).resolves.toEqual({
      user: { id: 'local-user', email: 'local@wordgod.app' },
    });

    const passage = await client.getRandomPassage();

    expect(passage.requiresAuthToComplete).toBe(false);
  });

  it('settles selected tokens into local vocabulary and returns another passage', async () => {
    const client = createMobileLocalClient({
      now: () => '2026-05-27T00:00:00.000Z',
      passages: [
        createPassage('passage-1', 'obscure', 1),
        createPassage('passage-2', 'align', 2),
      ],
      random: () => 0,
      storage: createMemoryStorage(),
    });

    await client.syncReadingAttempt('passage-1', {
      selectedTokenIds: ['passage-1-token'],
    });
    const result = await client.completeReadingAttempt('passage-1');
    const vocabulary = await client.listVocabulary();

    expect(result).toMatchObject({
      completedPassageId: 'passage-1',
      savedLemmaCount: 1,
      nextPassage: {
        passage: {
          id: 'passage-2',
        },
      },
    });
    expect(vocabulary.items).toHaveLength(1);
    expect(vocabulary.items[0]).toMatchObject({
      lemma: 'obscure',
      markCount: 1,
      contexts: [
        {
          sentenceText: 'obscure appears in context 1.',
          sentenceTranslation: 'obscure 的第 1 条中文语境。',
        },
      ],
    });
  });

  it('deduplicates same-passage lemmas and keeps the latest three contexts sorted by priority', async () => {
    const storage = createMemoryStorage();
    const client = createMobileLocalClient({
      now: () => '2026-05-27T00:00:00.000Z',
      passages: [
        createPassage('passage-1', 'obscure', 1),
        createPassage('passage-2', 'obscure', 2),
        createPassage('passage-3', 'obscure', 3),
        createPassage('passage-4', 'obscure', 4),
        createPassage('passage-5', 'align', 5),
      ],
      random: () => 0,
      storage,
    });

    await client.syncReadingAttempt('passage-1', {
      selectedTokenIds: ['passage-1-token', 'passage-1-token'],
    });
    await client.completeReadingAttempt('passage-1');
    await client.syncReadingAttempt('passage-2', {
      selectedTokenIds: ['passage-2-token'],
    });
    await client.completeReadingAttempt('passage-2');
    await client.syncReadingAttempt('passage-3', {
      selectedTokenIds: ['passage-3-token'],
    });
    await client.completeReadingAttempt('passage-3');
    await client.syncReadingAttempt('passage-4', {
      selectedTokenIds: ['passage-4-token'],
    });
    await client.completeReadingAttempt('passage-4');
    await client.syncReadingAttempt('passage-5', {
      selectedTokenIds: ['passage-5-token'],
    });
    await client.completeReadingAttempt('passage-5');

    const vocabulary = await client.listVocabulary();
    const detail = await client.getVocabularyDetail('obscure');

    expect(vocabulary.items.map((item) => item.lemma)).toEqual([
      'obscure',
      'align',
    ]);
    expect(vocabulary.items[0].markCount).toBe(4);
    expect(detail.item.contexts.map((context) => context.passageId)).toEqual([
      'passage-4',
      'passage-3',
      'passage-2',
    ]);
  });
});
