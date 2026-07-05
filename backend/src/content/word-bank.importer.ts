import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { basename, join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  BatchRequestLine,
  DeepSeekBatchOutputLine,
  buildBatchRequestLine,
  EnrichedPassage,
  parseBatchOutputLine,
} from './deepseek-enrichment';
import {
  extractReadingTextCandidates,
  SelectedWordBankPassage,
  selectWordBankPassages,
  toPassageRecord,
} from './word-bank.parser';

/**
 * `WordBankImportPaths` 描述内容导入过程使用的文件路径。
 */
export interface WordBankImportPaths {
  workspaceRoot: string;
  wordBankRoots: string[];
  cacheRoot: string;
  extractedPassagesFile: string;
  extractionWarningsFile: string;
  batchInputFile: string;
  batchMetaFile: string;
  batchOutputFile: string;
  importErrorsFile: string;
}

/**
 * `DeepSeekBatchMetadata` 描述本地 DeepSeek 批处理队列元数据。
 */
export interface DeepSeekBatchMetadata {
  batchId: string;
  inputFile: string;
  outputFile: string;
  requestCount: number;
  createdAt: string;
}

/**
 * `DeepSeekBatchRunSummary` 描述一次本地 DeepSeek 队列执行结果。
 */
export interface DeepSeekBatchRunSummary {
  requestedCount: number;
  skippedCount: number;
  writtenCount: number;
  failedCount: number;
  outputFile: string;
}

/**
 * `createWordBankImportPaths` 根据工作区根目录生成导入产物路径。
 */
export function createWordBankImportPaths(
  workspaceRoot: string,
): WordBankImportPaths {
  const cacheRoot = join(workspaceRoot, 'content-cache');

  return {
    workspaceRoot,
    wordBankRoots: [
      join(workspaceRoot, '真题题库', 'wordcram-kaoyan', 'articles'),
      join(workspaceRoot, '真题题库', 'kaoyan-english-ii', 'articles'),
    ],
    cacheRoot,
    extractedPassagesFile: join(cacheRoot, 'wordcram-article-passages.json'),
    extractionWarningsFile: join(cacheRoot, 'wordcram-article-warnings.json'),
    batchInputFile: join(cacheRoot, 'deepseek-translation-batch-input.jsonl'),
    batchMetaFile: join(cacheRoot, 'deepseek-translation-batch.json'),
    batchOutputFile: join(cacheRoot, 'deepseek-translation-batch-output.jsonl'),
    importErrorsFile: join(
      cacheRoot,
      'deepseek-translation-import-errors.json',
    ),
  };
}

/**
 * `hasEnglishOneAndTwoPassages` 判断缓存是否已经包含英语一和英语二。
 */
function hasEnglishOneAndTwoPassages(
  passages: SelectedWordBankPassage[],
): boolean {
  const paperSet = new Set(passages.map((passage) => passage.paper));

  return paperSet.has('英语一') && paperSet.has('英语二');
}

/**
 * `ensureCacheRoot` 确保内容缓存目录存在。
 */
async function ensureCacheRoot(paths: WordBankImportPaths): Promise<void> {
  await mkdir(paths.cacheRoot, { recursive: true });
}

/**
 * `listWordBankMarkdownFiles` 返回需要处理的 WordCram 文章 Markdown 文件。
 */
async function listWordBankMarkdownFiles(
  paths: WordBankImportPaths,
): Promise<string[]> {
  const markdownFiles: string[] = [];

  for (const wordBankRoot of paths.wordBankRoots) {
    if (!existsSync(wordBankRoot)) {
      continue;
    }

    const fileNames = await readdir(wordBankRoot);

    markdownFiles.push(
      ...fileNames
        .filter((fileName) =>
          /^\d{4}-kaoyan-english-(i|ii)-articles\.md$/.test(fileName),
        )
        .map((fileName) => join(wordBankRoot, fileName)),
    );
  }

  return markdownFiles.sort((left, right) =>
    basename(left).localeCompare(basename(right)),
  );
}

/**
 * `extractWordBankPassages` 从 WordCram 文章文件中抽取并持久化每个自然段。
 */
export async function extractWordBankPassages(
  paths: WordBankImportPaths,
  forceResample = false,
): Promise<SelectedWordBankPassage[]> {
  await ensureCacheRoot(paths);

  if (!forceResample && existsSync(paths.extractedPassagesFile)) {
    const cachedPassages = JSON.parse(
      await readFile(paths.extractedPassagesFile, 'utf8'),
    ) as SelectedWordBankPassage[];

    if (hasEnglishOneAndTwoPassages(cachedPassages)) {
      return cachedPassages;
    }
  }

  const files = await listWordBankMarkdownFiles(paths);
  const selectedPassages: SelectedWordBankPassage[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    const markdown = await readFile(file, 'utf8');
    const extracted = extractReadingTextCandidates(markdown, basename(file));

    selectedPassages.push(...selectWordBankPassages(extracted));
    warnings.push(...extracted.warnings);
  }

  await writeFile(
    paths.extractedPassagesFile,
    JSON.stringify(selectedPassages, null, 2),
    'utf8',
  );
  await writeFile(
    paths.extractionWarningsFile,
    JSON.stringify(warnings, null, 2),
    'utf8',
  );

  return selectedPassages;
}

/**
 * `writeDeepSeekBatchInput` 将抽中段落转换为 DeepSeek 本地批处理 JSONL。
 */
export async function writeDeepSeekBatchInput(
  paths: WordBankImportPaths,
  passages: SelectedWordBankPassage[],
  model: string,
): Promise<void> {
  await ensureCacheRoot(paths);
  const lines = passages.map((passage) =>
    JSON.stringify(buildBatchRequestLine(passage, model)),
  );

  await writeFile(paths.batchInputFile, `${lines.join('\n')}\n`, 'utf8');
}

/**
 * `readDeepSeekBatchInput` 读取并校验 DeepSeek 本地批处理请求行。
 */
async function readDeepSeekBatchInput(
  paths: WordBankImportPaths,
): Promise<BatchRequestLine[]> {
  const lines = (await readFile(paths.batchInputFile, 'utf8'))
    .split(/\r?\n/)
    .filter(Boolean);

  return lines.map((line, index) => {
    const request = JSON.parse(line) as BatchRequestLine;

    if (
      !request.custom_id ||
      request.method !== 'POST' ||
      request.url !== '/chat/completions'
    ) {
      throw new Error(`DeepSeek 批处理输入第 ${index + 1} 行无效`);
    }

    return request;
  });
}

/**
 * `createDeepSeekBatch` 创建本地 DeepSeek 批处理元数据。
 */
export async function createDeepSeekBatch(
  paths: WordBankImportPaths,
): Promise<DeepSeekBatchMetadata> {
  await ensureCacheRoot(paths);
  const requests = await readDeepSeekBatchInput(paths);

  const metadata: DeepSeekBatchMetadata = {
    batchId: `deepseek-local-${Date.now()}`,
    inputFile: paths.batchInputFile,
    outputFile: paths.batchOutputFile,
    requestCount: requests.length,
    createdAt: new Date().toISOString(),
  };

  await writeFile(
    paths.batchMetaFile,
    JSON.stringify(metadata, null, 2),
    'utf8',
  );

  return metadata;
}

/**
 * `readCompletedDeepSeekOutputIds` 从现有输出 JSONL 中读取已完成的段落 id。
 */
async function readCompletedDeepSeekOutputIds(
  paths: WordBankImportPaths,
): Promise<Set<string>> {
  const completedIds = new Set<string>();

  if (!existsSync(paths.batchOutputFile)) {
    return completedIds;
  }

  const lines = (await readFile(paths.batchOutputFile, 'utf8'))
    .split(/\r?\n/)
    .filter(Boolean);

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as { custom_id?: unknown };

      if (typeof parsed.custom_id === 'string' && parsed.custom_id) {
        completedIds.add(parsed.custom_id);
      }
    } catch {
      continue;
    }
  }

  return completedIds;
}

/**
 * `parseDeepSeekResponseBody` 将 DeepSeek HTTP 响应文本转换为可写入 JSONL 的对象。
 */
function parseDeepSeekResponseBody(responseText: string): unknown {
  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return { raw: responseText };
  }
}

/**
 * `requestDeepSeekEnrichment` 调用 DeepSeek Chat Completions 并返回可落盘响应。
 */
async function requestDeepSeekEnrichment(
  apiKey: string,
  body: BatchRequestLine['body'],
): Promise<DeepSeekBatchOutputLine['response']> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const responseBody = parseDeepSeekResponseBody(await response.text());

  return {
    status_code: response.status,
    body: responseBody,
  };
}

/**
 * `fetchDeepSeekBatchOutput` 执行本地 DeepSeek 队列并把新增结果追加到输出 JSONL。
 */
export async function fetchDeepSeekBatchOutput(
  paths: WordBankImportPaths,
  apiKey: string,
): Promise<DeepSeekBatchRunSummary> {
  await ensureCacheRoot(paths);
  const requests = await readDeepSeekBatchInput(paths);
  const completedIds = await readCompletedDeepSeekOutputIds(paths);
  let skippedCount = 0;
  let writtenCount = 0;
  let failedCount = 0;

  for (const request of requests) {
    if (completedIds.has(request.custom_id)) {
      skippedCount += 1;
      continue;
    }

    let outputLine: DeepSeekBatchOutputLine;

    try {
      const response = await requestDeepSeekEnrichment(apiKey, request.body);

      if (response?.status_code && response.status_code >= 400) {
        failedCount += 1;
      }

      outputLine = {
        custom_id: request.custom_id,
        response,
      };
    } catch (error) {
      failedCount += 1;
      outputLine = {
        custom_id: request.custom_id,
        error: {
          message: error instanceof Error ? error.message : 'DeepSeek 调用失败',
        },
      };
    }

    await appendFile(
      paths.batchOutputFile,
      `${JSON.stringify(outputLine)}\n`,
      'utf8',
    );
    completedIds.add(request.custom_id);
    writtenCount += 1;
  }

  return {
    requestedCount: requests.length,
    skippedCount,
    writtenCount,
    failedCount,
    outputFile: paths.batchOutputFile,
  };
}

/**
 * `readBatchEnrichments` 读取 Batch 输出并返回可入库的富化结果。
 */
export async function readBatchEnrichments(
  paths: WordBankImportPaths,
): Promise<{
  enrichments: Map<string, EnrichedPassage>;
  errors: Array<{ line: string; message: string }>;
}> {
  const enrichments = new Map<string, EnrichedPassage>();
  const errors: Array<{ line: string; message: string }> = [];
  const lines = (await readFile(paths.batchOutputFile, 'utf8'))
    .split(/\r?\n/)
    .filter(Boolean);

  for (const line of lines) {
    try {
      const parsed = parseBatchOutputLine(line);

      enrichments.set(parsed.passageId, parsed.enriched);
    } catch (error) {
      errors.push({
        line,
        message: error instanceof Error ? error.message : '未知解析错误',
      });
    }
  }

  await writeFile(
    paths.importErrorsFile,
    JSON.stringify(errors, null, 2),
    'utf8',
  );

  return { enrichments, errors };
}

/**
 * `upsertEnrichedPassages` 将富化后的段落和词典数据写入 PostgreSQL。
 */
export async function upsertEnrichedPassages(
  prisma: PrismaClient,
  passages: SelectedWordBankPassage[],
  enrichments: Map<string, EnrichedPassage>,
): Promise<number> {
  let importedCount = 0;

  for (const selected of passages) {
    const enriched = enrichments.get(selected.id);

    if (!enriched) {
      continue;
    }

    const passage = toPassageRecord(selected, enriched);

    await prisma.$transaction([
      prisma.passage.upsert({
        where: { id: passage.id },
        create: {
          id: passage.id,
          examType: passage.examType,
          year: passage.year,
          paper: passage.paper,
          questionType: passage.questionType,
          passageIndex: passage.passageIndex,
          textIndex: passage.textIndex,
          paragraphIndex: passage.paragraphIndex,
          title: passage.title,
          sourceUrl: passage.sourceUrl,
          sourceDomain: passage.sourceDomain,
          content: passage.content,
          sentences: passage.sentences as unknown as Prisma.InputJsonValue,
          tokens: passage.tokens as unknown as Prisma.InputJsonValue,
          publishedAt: new Date(passage.publishedAt),
        },
        update: {
          title: passage.title,
          textIndex: passage.textIndex,
          paragraphIndex: passage.paragraphIndex,
          sourceUrl: passage.sourceUrl,
          sourceDomain: passage.sourceDomain,
          content: passage.content,
          sentences: passage.sentences as unknown as Prisma.InputJsonValue,
          tokens: passage.tokens as unknown as Prisma.InputJsonValue,
          publishedAt: new Date(passage.publishedAt),
        },
      }),
      ...passage.tokens.map((token) =>
        prisma.lexiconEntry.upsert({
          where: { lemma: token.lemma },
          create: {
            id: randomUUID(),
            lemma: token.lemma,
            surface: token.surface,
            partOfSpeech: token.partOfSpeech,
            definitionCn: token.definitionCn,
            inflections: [],
          },
          update: {
            surface: token.surface,
            partOfSpeech: token.partOfSpeech,
            definitionCn: token.definitionCn,
          },
        }),
      ),
    ]);

    importedCount += 1;
  }

  return importedCount;
}
