import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  buildBatchRequestLine,
  EnrichedPassage,
  parseBatchOutputLine,
} from './openai-enrichment';
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
 * `OpenAiBatchMetadata` 描述已提交的 OpenAI Batch 任务。
 */
export interface OpenAiBatchMetadata {
  batchId: string;
  inputFileId: string;
  outputFileId: string | null;
  createdAt: string;
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
    batchInputFile: join(cacheRoot, 'openai-translation-batch-input.jsonl'),
    batchMetaFile: join(cacheRoot, 'openai-translation-batch.json'),
    batchOutputFile: join(cacheRoot, 'openai-translation-batch-output.jsonl'),
    importErrorsFile: join(cacheRoot, 'openai-translation-import-errors.json'),
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
 * `writeOpenAiBatchInput` 将抽中段落转换为 OpenAI Batch JSONL。
 */
export async function writeOpenAiBatchInput(
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
 * `uploadOpenAiBatchInput` 上传 Batch 输入文件并返回文件 id。
 */
async function uploadOpenAiBatchInput(
  apiKey: string,
  batchInput: string,
): Promise<string> {
  const formData = new FormData();

  formData.append('purpose', 'batch');
  formData.append(
    'file',
    new Blob([batchInput], { type: 'application/jsonl' }),
    'word-god-batch.jsonl',
  );

  const response = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });
  const payload = (await response.json()) as {
    id?: string;
    error?: { message?: string };
  };

  if (!response.ok || !payload.id) {
    throw new Error(payload.error?.message ?? 'OpenAI 文件上传失败');
  }

  return payload.id;
}

/**
 * `createOpenAiBatch` 创建 OpenAI Batch 任务并保存元数据。
 */
export async function createOpenAiBatch(
  paths: WordBankImportPaths,
  apiKey: string,
): Promise<OpenAiBatchMetadata> {
  const batchInput = await readFile(paths.batchInputFile, 'utf8');
  const inputFileId = await uploadOpenAiBatchInput(apiKey, batchInput);
  const response = await fetch('https://api.openai.com/v1/batches', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input_file_id: inputFileId,
      endpoint: '/v1/responses',
      completion_window: '24h',
      metadata: {
        project: 'word-god',
        purpose: 'kaoyan-passage-enrichment',
      },
    }),
  });
  const payload = (await response.json()) as {
    id?: string;
    output_file_id?: string | null;
    error?: { message?: string };
  };

  if (!response.ok || !payload.id) {
    throw new Error(payload.error?.message ?? 'OpenAI Batch 创建失败');
  }

  const metadata: OpenAiBatchMetadata = {
    batchId: payload.id,
    inputFileId,
    outputFileId: payload.output_file_id ?? null,
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
 * `fetchOpenAiBatchOutput` 下载已完成 Batch 的输出 JSONL。
 */
export async function fetchOpenAiBatchOutput(
  paths: WordBankImportPaths,
  apiKey: string,
): Promise<void> {
  const metadata = JSON.parse(
    await readFile(paths.batchMetaFile, 'utf8'),
  ) as OpenAiBatchMetadata;
  const batchResponse = await fetch(
    `https://api.openai.com/v1/batches/${metadata.batchId}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );
  const batchPayload = (await batchResponse.json()) as {
    output_file_id?: string | null;
    error?: { message?: string };
  };
  const outputFileId = batchPayload.output_file_id ?? metadata.outputFileId;

  if (!batchResponse.ok || !outputFileId) {
    throw new Error(
      batchPayload.error?.message ?? 'OpenAI Batch 尚未生成输出文件',
    );
  }

  const outputResponse = await fetch(
    `https://api.openai.com/v1/files/${outputFileId}/content`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );

  if (!outputResponse.ok) {
    throw new Error('OpenAI Batch 输出下载失败');
  }

  await writeFile(paths.batchOutputFile, await outputResponse.text(), 'utf8');
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
