import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './App';

/**
 * `createJsonResponse` 生成测试用的 JSON 响应对象。
 */
function createJsonResponse(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * `renderApp` 使用查询客户端和内存路由渲染应用。
 */
function renderApp(initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
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

/**
 * `mockGuestSession` 将当前用户接口设置为未登录状态。
 */
function mockGuestSession(): void {
  vi.mocked(fetch).mockResolvedValueOnce(
    createJsonResponse(200, { user: null }),
  );
}

/**
 * `mockLoggedInSession` 将当前用户接口设置为已登录状态。
 */
function mockLoggedInSession(): void {
  vi.mocked(fetch).mockResolvedValueOnce(
    createJsonResponse(200, {
      user: { id: 'user-1', email: 'reader@example.com' },
    }),
  );
}

describe('AppShell behaviors', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders a passage and toggles token selection with a live detail card', async () => {
    mockGuestSession();
    vi.mocked(fetch).mockResolvedValueOnce(
      createJsonResponse(200, {
        passage: {
          id: 'passage-1',
          examType: 'kaoyan',
          year: 2024,
          paper: '英语一',
          questionType: 'reading',
          passageIndex: 1,
          title: 'Memory and Method',
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
            id: 'p1-t1',
            lemma: 'obscure',
            surface: 'Obscure',
            sentenceIndex: 0,
            partOfSpeech: 'adj.',
            definitionCn: '晦涩的',
            translationCn: '晦涩的理论与实践保持一致。',
            isWord: true,
          },
          {
            id: 'p1-t2',
            lemma: 'align',
            surface: 'align',
            sentenceIndex: 0,
            partOfSpeech: 'v.',
            definitionCn: '使一致',
            translationCn: '晦涩的理论与实践保持一致。',
            isWord: true,
          },
        ],
        selectedTokenIds: [],
        requiresAuthToComplete: true,
      }),
    );

    renderApp();

    const article = await screen.findByRole('article');
    const tokenButton = await screen.findByRole('button', { name: 'Obscure' });

    expect(within(article).getByText(/theories/)).toBeInTheDocument();
    expect(within(article).getByText(/practice/)).toBeInTheDocument();
    await userEvent.click(tokenButton);

    expect(tokenButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('晦涩的')).toBeInTheDocument();
    expect(screen.getByText('Obscure theories align with practice.')).toBeInTheDocument();
  });

  it('renders live note as a sticky desktop margin rail', async () => {
    mockGuestSession();
    vi.mocked(fetch).mockResolvedValueOnce(
      createJsonResponse(200, {
        passage: {
          id: 'passage-1',
          examType: 'kaoyan',
          year: 2024,
          paper: '英语一',
          questionType: 'reading',
          passageIndex: 1,
          title: 'Memory and Method',
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
            id: 'p1-t1',
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
        requiresAuthToComplete: true,
      }),
    );

    renderApp();

    const appContainer = await screen.findByTestId('app-container');
    const readingLayout = await screen.findByTestId('reading-layout');
    const liveNote = await screen.findByRole('complementary', {
      name: 'Live Note',
    });

    expect(appContainer).toHaveClass('max-w-[104rem]');
    expect(readingLayout).toHaveClass('xl:grid-cols-[minmax(0,1fr)_minmax(44rem,44rem)_minmax(0,1fr)]');
    expect(readingLayout).toHaveClass('2xl:grid-cols-[minmax(0,1fr)_minmax(44rem,56rem)_minmax(0,1fr)]');
    expect(liveNote).toHaveClass('xl:sticky');
    expect(liveNote).toHaveClass('xl:top-6');
    expect(liveNote).toHaveClass('xl:justify-self-start');
    expect(liveNote).toHaveClass('xl:max-h-[calc(100vh-3rem)]');
    expect(liveNote).toHaveClass('xl:overflow-y-auto');
  });

  it('shows the loading error instead of keeping the passage spinner forever', async () => {
    mockGuestSession();
    vi.mocked(fetch).mockRejectedValueOnce(new Error('网络连接失败'));

    renderApp();

    expect(await screen.findByText('网络连接失败')).toBeInTheDocument();
    expect(screen.queryByText('正在载入真题段落...')).not.toBeInTheDocument();
  });

  it('shows an already logged in status instead of the auth link when a user session exists', async () => {
    mockLoggedInSession();

    renderApp(['/auth']);

    expect(await screen.findByRole('button', { name: '退出登录' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '登录 / 注册' }),
    ).not.toBeInTheDocument();
  });

  it('opens the auth dialog when a guest tries to continue to the next passage', async () => {
    mockGuestSession();
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          passage: {
            id: 'passage-1',
            examType: 'kaoyan',
            year: 2024,
            paper: '英语一',
            questionType: 'reading',
            passageIndex: 1,
            title: 'Memory and Method',
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
              id: 'p1-t1',
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
          requiresAuthToComplete: true,
        }),
      )
      .mockResolvedValueOnce(createJsonResponse(401, { message: '需要登录' }));

    renderApp();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Obscure' }),
    );
    await userEvent.click(screen.getByRole('button', { name: '下一篇' }));

    expect(
      await screen.findByRole('dialog', { name: '登录后继续' }),
    ).toBeInTheDocument();
  });

  it('logs in from the auth dialog and continues to the next passage', async () => {
    mockGuestSession();
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          passage: {
            id: 'passage-1',
            examType: 'kaoyan',
            year: 2024,
            paper: '英语一',
            questionType: 'reading',
            passageIndex: 1,
            title: 'Memory and Method',
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
              id: 'p1-t1',
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
          requiresAuthToComplete: true,
        }),
      )
      .mockResolvedValueOnce(createJsonResponse(401, { message: '需要登录' }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          user: { id: 'user-1', email: 'reader@example.com' },
        }),
      )
      .mockResolvedValueOnce(createJsonResponse(200, { success: true }))
      .mockResolvedValueOnce(
        createJsonResponse(201, {
          completedPassageId: 'passage-1',
          savedLemmaCount: 1,
          nextPassage: {
            passage: {
              id: 'passage-2',
              examType: 'kaoyan',
              year: 2023,
              paper: '英语一',
              questionType: 'reading',
              passageIndex: 2,
              title: 'Attention and Choice',
              content: 'Obscure symbols shape memory.',
              sourceUrl: 'https://example.com',
            },
            sentences: [
              {
                index: 0,
                text: 'Obscure symbols shape memory.',
                translation: '晦涩的符号塑造记忆。',
              },
            ],
            tokens: [
              {
                id: 'p2-t1',
                lemma: 'obscure',
                surface: 'Obscure',
                sentenceIndex: 0,
                partOfSpeech: 'adj.',
                definitionCn: '晦涩的',
                translationCn: '晦涩的符号塑造记忆。',
                isWord: true,
              },
            ],
            selectedTokenIds: [],
            requiresAuthToComplete: true,
          },
        }),
      );

    renderApp();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Obscure' }),
    );
    await userEvent.click(screen.getByRole('button', { name: '下一篇' }));
    await userEvent.type(
      await screen.findByLabelText('邮箱'),
      'reader@example.com',
    );
    await userEvent.type(screen.getByLabelText('密码'), 'Passw0rd!');
    const rememberLoginCheckbox = await screen.findByRole('checkbox', {
      name: '30天内记住登录',
    });

    expect(rememberLoginCheckbox).toBeChecked();
    await userEvent.click(rememberLoginCheckbox);
    await userEvent.click(screen.getByRole('button', { name: '登录并继续' }));

    await waitFor(() => {
      expect(screen.getByText('Attention and Choice')).toBeInTheDocument();
    });

    const loginCall = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url).includes('/auth/login'));
    const loginInit = loginCall?.[1] as RequestInit | undefined;

    expect(JSON.parse(loginInit?.body as string)).toEqual({
      email: 'reader@example.com',
      password: 'Passw0rd!',
      rememberLogin: false,
    });
  });

  it('submits remember login by default from the standalone auth page', async () => {
    mockGuestSession();
    vi.mocked(fetch).mockResolvedValueOnce(
      createJsonResponse(200, {
        user: { id: 'user-1', email: 'reader@example.com' },
      }),
    );

    renderApp(['/auth?redirect=/auth']);

    const rememberLoginCheckbox = await screen.findByRole('checkbox', {
      name: '30天内记住登录',
    });

    expect(rememberLoginCheckbox).toBeChecked();

    await userEvent.type(screen.getByLabelText('邮箱'), 'reader@example.com');
    await userEvent.type(screen.getByLabelText('密码'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: '确定' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    const loginCall = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url).includes('/auth/login'));
    const loginInit = loginCall?.[1] as RequestInit | undefined;

    expect(JSON.parse(loginInit?.body as string)).toEqual({
      email: 'reader@example.com',
      password: 'Passw0rd!',
      rememberLogin: true,
    });
  });

  it('renders a sorted vocabulary list and opens detail content', async () => {
    mockGuestSession();
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          items: [
            {
              lemma: 'obscure',
              surface: 'obscure',
              partOfSpeech: 'adj.',
              definitionCn: '晦涩的',
              markCount: 4,
              lastMarkedAt: '2026-04-26T00:00:00.000Z',
              contexts: [],
            },
            {
              lemma: 'align',
              surface: 'align',
              partOfSpeech: 'v.',
              definitionCn: '使一致',
              markCount: 2,
              lastMarkedAt: '2026-04-25T00:00:00.000Z',
              contexts: [],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          item: {
            lemma: 'obscure',
            surface: 'obscure',
            partOfSpeech: 'adj.',
            definitionCn: '晦涩的',
            markCount: 4,
            lastMarkedAt: '2026-04-26T00:00:00.000Z',
            contexts: [
              {
                sentenceText: 'Obscure debates slowly reshape public policy.',
                sentenceTranslation: '晦涩的争论缓慢地重塑公共政策。',
                markedAt: '2026-04-26T00:00:00.000Z',
                passageId: 'passage-4',
              },
            ],
          },
        }),
      );

    renderApp(['/vocabulary']);

    const detailLink = await screen.findByRole('link', { name: /obscure/i });
    const items = await screen.findAllByRole('listitem');

    expect(items[0]).toHaveTextContent('obscure');

    await userEvent.click(detailLink);

    await waitFor(() => {
      expect(
        screen.getByText('Obscure debates slowly reshape public policy.'),
      ).toBeInTheDocument();
    });
  });
});
