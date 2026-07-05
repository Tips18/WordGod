import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { upsertEcdictMarkdownEntries } from './ecdict.importer';
import {
  extractPassageSegments,
  ingestNormalizedPassages,
  restoreClozeAnswers,
} from './parser';
import {
  createDeepSeekBatch,
  createWordBankImportPaths,
  extractWordBankPassages,
  fetchDeepSeekBatchOutput,
  readBatchEnrichments,
  upsertEnrichedPassages,
  writeDeepSeekBatchInput,
} from './word-bank.importer';

interface SourceFixture {
  url: string;
  html: string;
  examType: 'kaoyan';
  year: number;
  paper: string;
  questionType: 'reading' | 'cloze';
}

const workspaceRoot = join(process.cwd(), '..');
const cacheRoot = join(workspaceRoot, 'content-cache');
const rawFile = join(cacheRoot, 'raw-sources.json');
const normalizedFile = join(cacheRoot, 'normalized-passages.json');
const translatedFile = join(cacheRoot, 'translated-passages.json');
const ingestedPassagesFile = join(cacheRoot, 'ingested-passages.json');
const ingestedLexiconFile = join(cacheRoot, 'ingested-lexicon.json');
const wordBankImportPaths = createWordBankImportPaths(workspaceRoot);
const defaultEcdictMarkdownFile = join(workspaceRoot, '词库', 'ecdict.md');

/**
 * `loadWorkspaceEnv` 为直接运行的内容命令加载仓库根目录环境变量。
 */
function loadWorkspaceEnv() {
  const envFile = join(workspaceRoot, '.env');

  if (!existsSync(envFile)) {
    return;
  }

  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);

    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}

loadWorkspaceEnv();

const fixtures: SourceFixture[] = [
  {
    url: 'https://example.com/kaoyan/2024/text-1',
    examType: 'kaoyan',
    year: 2024,
    paper: '英语一',
    questionType: 'reading',
    html: `
      <article data-source="kaoyan">
        <h1>2024 考研英语 Text 1</h1>
        <p>Obscure theories align with patient practice.</p>
        <p>Obscure archives challenge confident readers.</p>
      </article>
    `,
  },
  {
    url: 'https://example.com/kaoyan/2024/cloze-1',
    examType: 'kaoyan',
    year: 2024,
    paper: '英语一',
    questionType: 'cloze',
    html: `
      <article data-source="kaoyan">
        <h1>2024 考研英语 完形 1</h1>
        <p>The [[1|obscure]] archive [[2|reshapes]] memory.</p>
      </article>
    `,
  },
];

/**
 * `ensureCacheDir` 确保内容缓存目录存在。
 */
async function ensureCacheDir() {
  await mkdir(cacheRoot, { recursive: true });
}

/**
 * `runCrawl` 将白名单来源的原始 HTML 写入缓存。
 */
async function runCrawl() {
  await ensureCacheDir();
  await writeFile(rawFile, JSON.stringify(fixtures, null, 2), 'utf8');
}

/**
 * `runNormalize` 解析原始 HTML 并生成规范化段落列表。
 */
async function runNormalize() {
  await ensureCacheDir();
  const rawSources = JSON.parse(
    await readFile(rawFile, 'utf8'),
  ) as SourceFixture[];
  const normalized = rawSources.flatMap((source) => {
    const extracted = extractPassageSegments(source.html, source.url);

    return extracted.paragraphs.map((paragraph) => ({
      title: extracted.title,
      paragraph: restoreClozeAnswers(paragraph),
      sourceUrl: source.url,
      examType: source.examType,
      year: source.year,
      paper: source.paper,
      questionType: source.questionType,
    }));
  });

  await writeFile(normalizedFile, JSON.stringify(normalized, null, 2), 'utf8');
}

/**
 * `runTranslate` 为规范化段落填充占位翻译结果。
 */
async function runTranslate() {
  await ensureCacheDir();
  const normalized = JSON.parse(
    await readFile(normalizedFile, 'utf8'),
  ) as Array<{
    title: string;
    paragraph: string;
    sourceUrl: string;
    examType: 'kaoyan';
    year: number;
    paper: string;
    questionType: 'reading' | 'cloze';
  }>;
  const translated = normalized.map((item) => ({
    ...item,
    translation: `自动翻译：${item.paragraph}`,
  }));

  await writeFile(translatedFile, JSON.stringify(translated, null, 2), 'utf8');
}

/**
 * `runIngest` 将翻译后的段落转换为段落与词典产物。
 */
async function runIngest() {
  await ensureCacheDir();
  const translated = JSON.parse(
    await readFile(translatedFile, 'utf8'),
  ) as Array<{
    title: string;
    paragraph: string;
    translation: string;
    sourceUrl: string;
    examType: 'kaoyan';
    year: number;
    paper: string;
    questionType: 'reading' | 'cloze';
  }>;
  const ingested = ingestNormalizedPassages(translated);

  await writeFile(
    ingestedPassagesFile,
    JSON.stringify(ingested.passages, null, 2),
    'utf8',
  );
  await writeFile(
    ingestedLexiconFile,
    JSON.stringify(ingested.lexiconEntries, null, 2),
    'utf8',
  );
}

/**
 * `getDeepSeekModel` 读取内容富化使用的 DeepSeek 模型名。
 */
function getDeepSeekModel(): string {
  return process.env.DEEPSEEK_TRANSLATION_MODEL ?? 'deepseek-v4-flash';
}

/**
 * `getDeepSeekApiKey` 读取 DeepSeek API Key 并在缺失时给出明确错误。
 */
function getDeepSeekApiKey(): string {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error('缺少 DEEPSEEK_API_KEY，无法调用 DeepSeek 内容富化');
  }

  return apiKey;
}

/**
 * `hasFlag` 判断命令行是否包含指定参数。
 */
function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

/**
 * `getEcdictMarkdownFile` 返回 ECDICT 入库命令使用的 Markdown 文件。
 */
function getEcdictMarkdownFile(): string {
  const dictionaryPath =
    process.env.ECDICT_MARKDOWN_PATH ?? defaultEcdictMarkdownFile;

  if (!existsSync(dictionaryPath)) {
    throw new Error(`ECDICT Markdown 文件不存在：${dictionaryPath}`);
  }

  return dictionaryPath;
}

/**
 * `runExtractWordBank` 从 WordCram articles 抽取每个 Text 的自然段。
 */
async function runExtractWordBank() {
  const selected = await extractWordBankPassages(
    wordBankImportPaths,
    hasFlag('--force-resample'),
  );

  console.log(`Extracted ${selected.length} word-bank passages.`);
}

/**
 * `runCreateTranslationBatch` 生成 DeepSeek 本地富化队列。
 */
async function runCreateTranslationBatch() {
  const selected = await extractWordBankPassages(
    wordBankImportPaths,
    hasFlag('--force-resample'),
  );

  await writeDeepSeekBatchInput(
    wordBankImportPaths,
    selected,
    getDeepSeekModel(),
  );

  const metadata = await createDeepSeekBatch(wordBankImportPaths);

  console.log(
    `Created DeepSeek local batch ${metadata.batchId} with ${metadata.requestCount} requests.`,
  );
}

/**
 * `runImportTranslationBatch` 执行或读取 DeepSeek 本地输出并写入 PostgreSQL。
 */
async function runImportTranslationBatch() {
  const selected = await extractWordBankPassages(wordBankImportPaths, false);

  if (!hasFlag('--skip-download')) {
    const summary = await fetchDeepSeekBatchOutput(
      wordBankImportPaths,
      getDeepSeekApiKey(),
    );

    console.log(
      `DeepSeek local batch wrote ${summary.writtenCount} rows, skipped ${summary.skippedCount}, failed ${summary.failedCount}.`,
    );
  }

  const { enrichments, errors } =
    await readBatchEnrichments(wordBankImportPaths);
  const prisma = new PrismaClient();

  try {
    const importedCount = await upsertEnrichedPassages(
      prisma,
      selected,
      enrichments,
    );

    console.log(
      `Imported ${importedCount} passages. ${errors.length} batch rows failed validation.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * `runImportWordBank` 执行词库抽取并根据现有 DeepSeek 输出决定创建或入库。
 */
async function runImportWordBank() {
  const selected = await extractWordBankPassages(
    wordBankImportPaths,
    hasFlag('--force-resample'),
  );

  await writeDeepSeekBatchInput(
    wordBankImportPaths,
    selected,
    getDeepSeekModel(),
  );

  if (hasFlag('--skip-download')) {
    await runImportTranslationBatch();
    return;
  }

  const metadata = await createDeepSeekBatch(wordBankImportPaths);

  console.log(
    `Created DeepSeek local batch ${metadata.batchId}. Run import-translation-batch to call DeepSeek and import results.`,
  );
}

/**
 * `runImportEcdict` 将下载的 ECDICT Markdown 词典写入 PostgreSQL。
 */
async function runImportEcdict() {
  const prisma = new PrismaClient();

  try {
    const importedCount = await upsertEcdictMarkdownEntries(
      prisma,
      getEcdictMarkdownFile(),
    );

    console.log(`Imported ${importedCount} ECDICT lexicon entries.`);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * `main` 根据命令行子命令分发内容处理流程。
 */
async function main() {
  const command = process.argv[2];

  if (command === 'crawl') {
    await runCrawl();
    return;
  }

  if (command === 'normalize') {
    await runNormalize();
    return;
  }

  if (command === 'translate') {
    await runTranslate();
    return;
  }

  if (command === 'ingest') {
    await runIngest();
    return;
  }

  if (command === 'extract-word-bank') {
    await runExtractWordBank();
    return;
  }

  if (command === 'create-translation-batch') {
    await runCreateTranslationBatch();
    return;
  }

  if (command === 'import-translation-batch') {
    await runImportTranslationBatch();
    return;
  }

  if (command === 'import-word-bank') {
    await runImportWordBank();
    return;
  }

  if (command === 'import-ecdict') {
    await runImportEcdict();
    return;
  }

  throw new Error(`Unsupported command: ${command}`);
}

void main();
