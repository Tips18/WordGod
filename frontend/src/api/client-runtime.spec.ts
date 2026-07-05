import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReadingPassageResponse } from '@word-god/contracts';

const mobilePassageFixture: ReadingPassageResponse = {
  passage: {
    id: 'mobile-passage-1',
    examType: 'kaoyan',
    year: 2026,
    paper: '英语一',
    questionType: 'reading',
    passageIndex: 1,
    textIndex: 1,
    paragraphIndex: 1,
    title: 'Mobile Fixture',
    content: 'Obscure theories align with practice.',
    sourceUrl: 'https://example.com',
  },
  sentences: [
    {
      index: 0,
      text: 'Obscure theories align with practice.',
      translation: '晦涩的理论与实践保持一致。',
    },
  ],
  tokens: [
    {
      id: 'mobile-token-1',
      lemma: 'obscure',
      surface: 'Obscure',
      sentenceIndex: 0,
      partOfSpeech: 'adj.',
      definitionCn: '晦涩的',
      translationCn: '晦涩的理论与实践保持一致。',
      isWord: true,
    },
  ],
  selectedTokenIds: [],
  requiresAuthToComplete: false,
};

describe('api client runtime selection', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('uses the mobile local client without fetch when the mobile runtime flag is set', async () => {
    vi.stubEnv('VITE_WORD_GOD_RUNTIME', 'mobile');
    vi.stubGlobal('fetch', vi.fn());
    vi.doMock('../mobile/mobile-passages.generated', () => ({
      mobilePassages: [mobilePassageFixture],
    }));

    const { getCurrentUser, getRandomPassage } = await import('./client');
    const currentUser = await getCurrentUser();
    const passage = await getRandomPassage();

    expect(currentUser.user).toEqual({
      id: 'local-user',
      email: 'local@wordgod.app',
    });
    expect(passage.requiresAuthToComplete).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
