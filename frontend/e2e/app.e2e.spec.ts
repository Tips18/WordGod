import { expect, test } from '@playwright/test';

/**
 * `mockReadingFlow` 为阅读页提供统一的接口拦截。
 */
async function mockReadingFlow() {
  let completed = false;

  return {
    /**
     * `attachTo` 将当前测试的接口拦截逻辑附加到页面。
     */
    async attachTo(page: import('@playwright/test').Page) {
      await page.route('**/reading/passages/random', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            passage: {
              id: completed ? 'passage-2' : 'passage-1',
              examType: 'kaoyan',
              year: completed ? 2023 : 2024,
              paper: '英语一',
              questionType: 'reading',
              passageIndex: completed ? 2 : 1,
              title: completed ? 'Attention and Choice' : 'Memory and Method',
              content: completed ? 'Obscure symbols shape memory.' : 'Obscure theories align with practice.',
              sourceUrl: 'https://example.com',
            },
            sentences: [
              {
                index: 0,
                text: completed ? 'Obscure symbols shape memory.' : 'Obscure theories align with practice.',
                translation: completed ? '晦涩的符号塑造记忆。' : '晦涩的理论与实践保持一致。',
              },
            ],
            tokens: [
              {
                id: completed ? 'p2-t1' : 'p1-t1',
                lemma: 'obscure',
                surface: 'Obscure',
                sentenceIndex: 0,
                partOfSpeech: 'adj.',
                definitionCn: '晦涩的',
                translationCn: completed ? '晦涩的符号塑造记忆。' : '晦涩的理论与实践保持一致。',
                isWord: true,
              },
            ],
            selectedTokenIds: [],
            requiresAuthToComplete: true,
          }),
        });
      });

      let attemptCount = 0;
      await page.route('**/reading/attempts/*', async (route) => {
        if (route.request().method() === 'PUT' && attemptCount === 0) {
          attemptCount += 1;
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ message: '需要登录' }),
          });
          return;
        }

        if (route.request().method() === 'PUT') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
          return;
        }

        completed = true;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
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
        });
      });

      await page.route('**/auth/login', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'user-1',
              email: 'reader@example.com',
            },
          }),
        });
      });
    },
  };
}

test('guest is intercepted on next and can continue after login', async ({ page }) => {
  const readingFlow = await mockReadingFlow();

  await readingFlow.attachTo(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Obscure' }).click();
  await page.getByRole('button', { name: '下一篇' }).click();

  await expect(page.getByRole('dialog', { name: '登录后继续' })).toBeVisible();

  await page.getByLabel('邮箱').fill('reader@example.com');
  await page.getByLabel('密码').fill('Passw0rd!');
  await page.getByRole('button', { name: '登录并继续' }).click();

  await expect(page.getByText('Attention and Choice')).toBeVisible();
});

test('vocabulary list opens detail contexts', async ({ page }) => {
  await page.route('**/vocabulary', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
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
        ],
      }),
    });
  });

  await page.route('**/vocabulary/obscure', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
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
    });
  });

  await page.goto('/vocabulary');
  await page.getByRole('link', { name: /obscure/i }).click();

  await expect(page.getByText('晦涩的争论缓慢地重塑公共政策。')).toBeVisible();
});
