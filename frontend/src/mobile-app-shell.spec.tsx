import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReadingPassageResponse } from '@word-god/contracts';

const UNAVAILABLE_TRANSLATION = '翻译暂不可用，请稍后重试。';

const mobilePassagesFixture: ReadingPassageResponse[] = [
  {
    passage: {
      id: 'mobile-passage-1',
      examType: 'kaoyan',
      year: 2026,
      paper: '英语一',
      questionType: 'reading',
      passageIndex: 1,
      textIndex: 1,
      paragraphIndex: 1,
      title: 'Mobile Fixture 1',
      content: 'Obscure theories align with practice.',
      sourceUrl: 'https://example.com/mobile-1',
    },
    sentences: [
      {
        index: 0,
        text: 'Obscure theories align with practice.',
        translation: '晦涩的理论与实践保持一致。',
      },
      {
        index: 1,
        text: 'Practice requires context.',
        translation: UNAVAILABLE_TRANSLATION,
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
      {
        id: 'mobile-token-unavailable-translation',
        lemma: 'practice',
        surface: 'practice',
        sentenceIndex: 1,
        partOfSpeech: 'n.',
        definitionCn: '实践',
        translationCn: UNAVAILABLE_TRANSLATION,
        isWord: true,
      },
    ],
    selectedTokenIds: ['mobile-token-1'],
    requiresAuthToComplete: false,
  },
  {
    passage: {
      id: 'mobile-passage-2',
      examType: 'kaoyan',
      year: 2025,
      paper: '英语二',
      questionType: 'reading',
      passageIndex: 2,
      textIndex: 2,
      paragraphIndex: 1,
      title: 'Mobile Fixture 2',
      content: 'Patient readers compare contexts.',
      sourceUrl: 'https://example.com/mobile-2',
    },
    sentences: [
      {
        index: 0,
        text: 'Patient readers compare contexts.',
        translation: '耐心的读者会比较语境。',
      },
    ],
    tokens: [
      {
        id: 'mobile-token-2',
        lemma: 'patient',
        surface: 'Patient',
        sentenceIndex: 0,
        partOfSpeech: 'adj.',
        definitionCn: '耐心的',
        translationCn: '耐心的读者会比较语境。',
        isWord: true,
      },
    ],
    selectedTokenIds: [],
    requiresAuthToComplete: false,
  },
];

/**
 * `renderMobileAppShell` 在 mobile runtime 下动态加载应用壳层。
 */
async function renderMobileAppShell(initialEntries: string[] = ['/']) {
  vi.resetModules();
  vi.stubEnv('VITE_WORD_GOD_RUNTIME', 'mobile');
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(Math, 'random').mockReturnValue(0);
  vi.doMock('./mobile/mobile-passages.generated', () => ({
    mobilePassages: mobilePassagesFixture,
  }));

  const { AppShell } = await import('./App');
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AppShell />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('mobile AppShell behaviors', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    window.localStorage.clear();
  });

  it('uses the offline local user shell without account controls or status chips', async () => {
    await renderMobileAppShell(['/']);

    expect(await screen.findByText('我不是词神')).toBeInTheDocument();
    expect(screen.queryByText('本机离线')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '登录 / 注册' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '退出登录' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '下载手机版 APK' }),
    ).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('continues to the next passage locally without opening an auth dialog', async () => {
    await renderMobileAppShell(['/']);

    await userEvent.click(await screen.findByRole('button', { name: '下一篇' }));

    expect(
      screen.queryByRole('dialog', { name: '登录后继续' }),
    ).not.toBeInTheDocument();
    expect(await screen.findByText('Mobile Fixture 2')).toBeInTheDocument();
    expect(screen.queryByText(/已沉淀/)).not.toBeInTheDocument();
  });

  it('places the next passage action after the selected word list in mobile flow', async () => {
    await renderMobileAppShell(['/']);

    const selectedWords = await screen.findByRole('complementary', {
      name: '本篇已选',
    });
    const nextButton = await screen.findByRole('button', { name: '下一篇' });

    expect(
      selectedWords.compareDocumentPosition(nextButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('opens a closable word detail popup near the selected word on mobile', async () => {
    await renderMobileAppShell(['/']);

    await userEvent.click(await screen.findByRole('button', { name: 'Obscure' }));

    const wordDialog = await screen.findByRole('dialog', {
      name: '单词详情',
    });

    expect(wordDialog).toHaveTextContent('Obscure');
    expect(wordDialog).toHaveTextContent('adj.');
    expect(wordDialog).toHaveTextContent('晦涩的');
    expect(wordDialog).toHaveTextContent('Obscure theories align with practice.');
    expect(wordDialog).toHaveTextContent('晦涩的理论与实践保持一致。');

    await userEvent.click(
      screen.getByRole('button', { name: '关闭单词详情' }),
    );

    expect(
      screen.queryByRole('dialog', { name: '单词详情' }),
    ).not.toBeInTheDocument();
  });

  it('closes the mobile word detail popup when tapping outside it', async () => {
    await renderMobileAppShell(['/']);

    await userEvent.click(await screen.findByRole('button', { name: 'Obscure' }));

    expect(
      await screen.findByRole('dialog', { name: '单词详情' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByText('Mobile Fixture 1'));

    expect(
      screen.queryByRole('dialog', { name: '单词详情' }),
    ).not.toBeInTheDocument();
  });

  it('hides unavailable translation placeholders in the mobile word detail popup', async () => {
    await renderMobileAppShell(['/']);

    await userEvent.click(await screen.findByRole('button', { name: 'practice.' }));

    const wordDialog = await screen.findByRole('dialog', {
      name: '单词详情',
    });

    expect(wordDialog).toHaveTextContent('practice');
    expect(wordDialog).toHaveTextContent('Practice requires context.');
    expect(wordDialog).not.toHaveTextContent(UNAVAILABLE_TRANSLATION);
  });
});
