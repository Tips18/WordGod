import { PassageToken } from '@word-god/contracts';
import { ReadingService } from './reading.service';
import { InMemoryAppStore } from '../store/in-memory-app.store';
import { VocabularyService } from '../vocabulary/vocabulary.service';
import { PassageTranslator } from './passage-translator';

/**
 * `createToken` 构造测试用的段落 token。
 */
function createToken(
  token: Partial<PassageToken> & Pick<PassageToken, 'id' | 'lemma' | 'surface'>,
): PassageToken {
  return {
    sentenceIndex: 0,
    partOfSpeech: 'adj.',
    definitionCn: '测试释义',
    translationCn: '测试翻译',
    isWord: true,
    ...token,
  };
}

describe('ReadingService', () => {
  let store: InMemoryAppStore;
  let vocabularyService: VocabularyService;
  let readingService: ReadingService;
  let passageTranslator: jest.Mocked<
    Pick<PassageTranslator, 'translatePassage'>
  >;
  let dictionaryService: {
    enrichTokens: jest.Mock<Promise<PassageToken[]>, [PassageToken[]]>;
  };

  beforeEach(() => {
    store = new InMemoryAppStore({
      passages: [
        {
          id: 'passage-1',
          examType: 'kaoyan',
          year: 2024,
          paper: '英语一',
          questionType: 'reading',
          passageIndex: 1,
          title: 'Passage One',
          content: 'Obscure theories align with practice.',
          sourceUrl: 'https://example.com/p1',
          sourceDomain: 'example.com',
          sentences: [
            {
              index: 0,
              text: 'Obscure theories align with practice.',
              translation: '晦涩的理论与实践保持一致。',
            },
          ],
          tokens: [
            createToken({
              id: 'p1-t1',
              lemma: 'obscure',
              surface: 'Obscure',
              definitionCn: '晦涩的',
            }),
            createToken({
              id: 'p1-t2',
              lemma: 'obscure',
              surface: 'obscure',
              definitionCn: '晦涩的',
            }),
            createToken({
              id: 'p1-t3',
              lemma: 'align',
              surface: 'align',
              definitionCn: '使一致',
            }),
          ],
          publishedAt: '2026-04-26T00:00:00.000Z',
        },
        {
          id: 'passage-2',
          examType: 'kaoyan',
          year: 2023,
          paper: '英语一',
          questionType: 'reading',
          passageIndex: 2,
          title: 'Passage Two',
          content: 'Obscure symbols shape memory.',
          sourceUrl: 'https://example.com/p2',
          sourceDomain: 'example.com',
          sentences: [
            {
              index: 0,
              text: 'Obscure symbols shape memory.',
              translation: '晦涩的符号塑造记忆。',
            },
          ],
          tokens: [
            createToken({
              id: 'p2-t1',
              lemma: 'obscure',
              surface: 'Obscure',
              definitionCn: '晦涩的',
            }),
            createToken({
              id: 'p2-t2',
              lemma: 'shape',
              surface: 'shape',
              definitionCn: '塑造',
            }),
          ],
          publishedAt: '2026-04-25T00:00:00.000Z',
        },
        {
          id: 'passage-3',
          examType: 'kaoyan',
          year: 2022,
          paper: '英语一',
          questionType: 'reading',
          passageIndex: 3,
          title: 'Passage Three',
          content: 'Obscure archives challenge readers.',
          sourceUrl: 'https://example.com/p3',
          sourceDomain: 'example.com',
          sentences: [
            {
              index: 0,
              text: 'Obscure archives challenge readers.',
              translation: '晦涩的档案挑战读者。',
            },
          ],
          tokens: [
            createToken({
              id: 'p3-t1',
              lemma: 'obscure',
              surface: 'Obscure',
              definitionCn: '晦涩的',
            }),
          ],
          publishedAt: '2026-04-24T00:00:00.000Z',
        },
        {
          id: 'passage-4',
          examType: 'kaoyan',
          year: 2021,
          paper: '英语一',
          questionType: 'reading',
          passageIndex: 4,
          title: 'Passage Four',
          content: 'Obscure debates reshape policy.',
          sourceUrl: 'https://example.com/p4',
          sourceDomain: 'example.com',
          sentences: [
            {
              index: 0,
              text: 'Obscure debates reshape policy.',
              translation: '晦涩的争论重塑政策。',
            },
          ],
          tokens: [
            createToken({
              id: 'p4-t1',
              lemma: 'obscure',
              surface: 'Obscure',
              definitionCn: '晦涩的',
            }),
          ],
          publishedAt: '2026-04-23T00:00:00.000Z',
        },
      ],
    });
    vocabularyService = new VocabularyService(store);
    passageTranslator = {
      translatePassage: jest.fn((passage) => Promise.resolve(passage)),
    };
    dictionaryService = {
      enrichTokens: jest.fn((tokens) => Promise.resolve(tokens)),
    };
    readingService = new ReadingService(
      store,
      vocabularyService,
      passageTranslator as PassageTranslator,
      dictionaryService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('replaces the full selected token set when syncing an attempt', async () => {
    await readingService.syncAttempt('user-1', 'passage-1', {
      selectedTokenIds: ['p1-t1', 'p1-t3'],
    });
    await readingService.syncAttempt('user-1', 'passage-1', {
      selectedTokenIds: ['p1-t3'],
    });

    expect(store.findAttempt('user-1', 'passage-1')?.selectedTokenIds).toEqual([
      'p1-t3',
    ]);
  });

  it('does not write vocabulary entries before the attempt is completed', async () => {
    await readingService.syncAttempt('user-1', 'passage-1', {
      selectedTokenIds: ['p1-t1'],
    });

    await expect(vocabularyService.listForUser('user-1')).resolves.toEqual({
      items: [],
    });
  });

  it('returns runtime translated passage data', async () => {
    const runtimeTranslation = '运行时翻译后的原句。';

    jest.spyOn(Math, 'random').mockReturnValue(0);
    passageTranslator.translatePassage.mockImplementation((passage) =>
      Promise.resolve({
        ...passage,
        sentences: passage.sentences.map((sentence) => ({
          ...sentence,
          translation: runtimeTranslation,
        })),
        tokens: passage.tokens.map((token) => ({
          ...token,
          translationCn: runtimeTranslation,
        })),
      }),
    );

    const response = await readingService.getRandomPassage();

    expect(response.sentences[0].translation).toBe(runtimeTranslation);
    expect(response.tokens[0].translationCn).toBe(runtimeTranslation);
    expect(passageTranslator.translatePassage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'passage-1' }),
    );
  });

  it('returns token definitions enriched from the downloaded dictionary', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    dictionaryService.enrichTokens.mockImplementation((tokens) =>
      Promise.resolve(
        tokens.map((token) =>
          token.lemma === 'align'
            ? {
                ...token,
                partOfSpeech: 'v.',
                definitionCn: '使一致；排列',
              }
            : token,
        ),
      ),
    );

    const response = await readingService.getRandomPassage();
    const alignToken = response.tokens.find((token) => token.lemma === 'align');

    expect(dictionaryService.enrichTokens).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ lemma: 'align' })]),
    );
    expect(alignToken?.partOfSpeech).toBe('v.');
    expect(alignToken?.definitionCn).toBe('使一致；排列');
  });

  it('completes a passage, counts each lemma once, and returns a different next passage', async () => {
    await readingService.syncAttempt('user-1', 'passage-1', {
      selectedTokenIds: ['p1-t1', 'p1-t2', 'p1-t3'],
    });

    const completion = await readingService.completeAttempt(
      'user-1',
      'passage-1',
    );
    const items = (await vocabularyService.listForUser('user-1')).items;

    expect(completion.savedLemmaCount).toBe(2);
    expect(completion.nextPassage.passage.id).not.toBe('passage-1');
    expect(items.find((item) => item.lemma === 'obscure')?.markCount).toBe(1);
    expect(items.find((item) => item.lemma === 'align')?.markCount).toBe(1);
  });

  it('records downloaded dictionary definitions when completing a passage', async () => {
    dictionaryService.enrichTokens.mockImplementation((tokens) =>
      Promise.resolve(
        tokens.map((token) =>
          token.lemma === 'align'
            ? {
                ...token,
                partOfSpeech: 'v.',
                definitionCn: '使一致；排列',
              }
            : token,
        ),
      ),
    );

    await readingService.syncAttempt('user-1', 'passage-1', {
      selectedTokenIds: ['p1-t3'],
    });
    await readingService.completeAttempt('user-1', 'passage-1');

    const detail = await vocabularyService.getDetail('user-1', 'align');

    expect(detail.item.partOfSpeech).toBe('v.');
    expect(detail.item.definitionCn).toBe('使一致；排列');
  });

  it('records runtime translated sentence context when completing a passage', async () => {
    const runtimeTranslation = '晦涩一词所在原句的运行时翻译。';

    passageTranslator.translatePassage.mockImplementation((passage) =>
      Promise.resolve(
        passage.id === 'passage-1'
          ? {
              ...passage,
              sentences: passage.sentences.map((sentence) => ({
                ...sentence,
                translation: runtimeTranslation,
              })),
              tokens: passage.tokens.map((token) => ({
                ...token,
                translationCn: runtimeTranslation,
              })),
            }
          : passage,
      ),
    );

    await readingService.syncAttempt('user-1', 'passage-1', {
      selectedTokenIds: ['p1-t1'],
    });
    await readingService.completeAttempt('user-1', 'passage-1');

    const detail = await vocabularyService.getDetail('user-1', 'obscure');

    expect(detail.item.contexts[0].sentenceTranslation).toBe(
      runtimeTranslation,
    );
  });

  it('increments repeated lemmas across passages and keeps only the latest three contexts', async () => {
    for (const passageId of [
      'passage-1',
      'passage-2',
      'passage-3',
      'passage-4',
    ]) {
      const tokenId = store.findPassage(passageId)?.tokens[0]?.id;

      await readingService.syncAttempt('user-1', passageId, {
        selectedTokenIds: tokenId ? [tokenId] : [],
      });
      await readingService.completeAttempt('user-1', passageId);
    }

    const detail = await vocabularyService.getDetail('user-1', 'obscure');

    expect(detail.item.markCount).toBe(4);
    expect(detail.item.contexts).toHaveLength(3);
    expect(detail.item.contexts[0].passageId).toBe('passage-4');
    expect(detail.item.contexts[2].passageId).toBe('passage-2');
  });
});
