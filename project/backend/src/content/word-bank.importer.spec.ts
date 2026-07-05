import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PassageSentence, PassageToken } from '@word-god/contracts';
import { SelectedWordBankPassage } from './word-bank.parser';
import {
  createWordBankImportPaths,
  extractWordBankPassages,
  fetchDeepSeekBatchOutput,
  upsertEnrichedPassages,
  writeDeepSeekBatchInput,
} from './word-bank.importer';

interface PassageUpsertArgs {
  create: {
    textIndex: number;
    paragraphIndex: number;
  };
  update: {
    textIndex: number;
    paragraphIndex: number;
  };
}

/**
 * `createPassage` 构造带自然段索引的导入测试段落。
 */
function createPassage(
  paragraphIndex: number,
): SelectedWordBankPassage & { textIndex: number; paragraphIndex: number } {
  return {
    id:
      paragraphIndex === 1
        ? 'kaoyan-2026-english-i-reading-text-1'
        : `kaoyan-2026-english-i-reading-text-1-paragraph-${paragraphIndex}`,
    examType: 'kaoyan',
    year: 2026,
    paper: '英语一',
    questionType: 'reading',
    passageIndex: 1,
    textIndex: 1,
    paragraphIndex,
    title: `2026 英语一 Text 1 Paragraph ${paragraphIndex}`,
    content: `Paragraph ${paragraphIndex} content has enough words for a reading passage unit.`,
    sourceUrl: 'https://wordcram.com.cn/tests/kaoyan/2026',
    sourceDomain: 'wordcram.com.cn',
    publishedAt: '2026-01-01T00:00:00.000Z',
  };
}

/**
 * `createEnrichment` 构造入库流程需要的富化结果。
 */
function createEnrichment(content: string): {
  sentences: PassageSentence[];
  tokens: PassageToken[];
} {
  return {
    sentences: [
      {
        index: 0,
        text: content,
        translation: '测试译文。',
      },
    ],
    tokens: [],
  };
}

describe('word bank importer', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('extracts English I and English II article passages into one cache set', async () => {
    const paths = createWordBankImportPaths(join(process.cwd(), '..'));
    const passages = await extractWordBankPassages(paths, true);
    const paperSet = new Set(passages.map((passage) => passage.paper));

    expect(passages).toHaveLength(1021);
    expect(paperSet).toEqual(new Set(['英语一', '英语二']));
    expect(
      passages.some(
        (passage) =>
          passage.id === 'kaoyan-2026-english-ii-reading-text-1' &&
          passage.sourceDomain === 'zhenti.burningvocabulary.cn',
      ),
    ).toBe(true);
    expect(
      passages.every(
        (passage) =>
          passage.questionType === 'reading' &&
          !passage.content.includes('____(1)____'),
      ),
    ).toBe(true);
  });

  it('upserts multiple paragraphs from the same text as distinct passages', async () => {
    const passageUpsert = jest.fn(
      (args: PassageUpsertArgs): PassageUpsertArgs => args,
    );
    const prisma = {
      passage: {
        upsert: passageUpsert,
      },
      lexiconEntry: {
        upsert: jest.fn(),
      },
      $transaction: jest.fn((operations: unknown[]) =>
        Promise.resolve(operations),
      ),
    } as unknown as PrismaClient;
    const passages = [createPassage(1), createPassage(2)];
    const enrichments = new Map(
      passages.map((passage) => [
        passage.id,
        createEnrichment(passage.content),
      ]),
    );

    const importedCount = await upsertEnrichedPassages(
      prisma,
      passages,
      enrichments,
    );

    expect(importedCount).toBe(2);
    expect(passageUpsert).toHaveBeenCalledTimes(2);
    expect(passageUpsert.mock.calls[0]?.[0].create.textIndex).toBe(1);
    expect(passageUpsert.mock.calls[0]?.[0].create.paragraphIndex).toBe(1);
    expect(passageUpsert.mock.calls[0]?.[0].update.textIndex).toBe(1);
    expect(passageUpsert.mock.calls[0]?.[0].update.paragraphIndex).toBe(1);
    expect(passageUpsert.mock.calls[1]?.[0].create.textIndex).toBe(1);
    expect(passageUpsert.mock.calls[1]?.[0].create.paragraphIndex).toBe(2);
    expect(passageUpsert.mock.calls[1]?.[0].update.textIndex).toBe(1);
    expect(passageUpsert.mock.calls[1]?.[0].update.paragraphIndex).toBe(2);
  });

  it('runs DeepSeek local batch only for missing output rows', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'word-bank-importer-'));

    try {
      const paths = createWordBankImportPaths(tempRoot);
      const passages = [createPassage(1), createPassage(2)];
      const completedOutput = {
        custom_id: passages[0].id,
        response: {
          status_code: 200,
          body: {
            choices: [
              {
                message: {
                  content: JSON.stringify(
                    createEnrichment(passages[0].content),
                  ),
                },
              },
            ],
          },
        },
      };
      const fetchMock = jest.fn(
        (_url: string, init?: RequestInit): Promise<Response> => {
          const requestBody = init?.body;

          if (typeof requestBody !== 'string') {
            throw new Error('DeepSeek mock expected a JSON string body');
          }

          const body = JSON.parse(requestBody) as {
            model: string;
            response_format: { type: string };
          };

          expect(body.model).toBe('deepseek-v4-flash');
          expect(body.response_format).toEqual({ type: 'json_object' });

          return Promise.resolve(
            new Response(
              JSON.stringify({
                choices: [
                  {
                    message: {
                      content: JSON.stringify(
                        createEnrichment(passages[1].content),
                      ),
                    },
                  },
                ],
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          );
        },
      );

      await writeDeepSeekBatchInput(paths, passages, 'deepseek-v4-flash');
      await writeFile(
        paths.batchOutputFile,
        `${JSON.stringify(completedOutput)}\n`,
        'utf8',
      );
      global.fetch = fetchMock as typeof fetch;

      const summary = await fetchDeepSeekBatchOutput(paths, 'sk-test');
      const outputLines = (await readFile(paths.batchOutputFile, 'utf8'))
        .trim()
        .split(/\r?\n/);

      expect(summary).toMatchObject({
        requestedCount: 2,
        skippedCount: 1,
        writtenCount: 1,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(outputLines).toHaveLength(2);
      expect(outputLines[1]).toContain(passages[1].id);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
