import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  extractPassageSegments,
  ingestNormalizedPassages,
  restoreClozeAnswers,
} from './parser';

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

  throw new Error(`Unsupported command: ${command}`);
}

void main();
