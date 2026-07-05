import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const passageCachePath = join(
  workspaceRoot,
  'content-cache',
  'wordcram-article-passages.json',
);
const translationCachePath = join(
  workspaceRoot,
  'content-cache',
  'mobile-sentence-translations.json',
);
const ecdictPath = join(workspaceRoot, '词库', 'ecdict.md');
const outputPath = join(
  workspaceRoot,
  'frontend',
  'src',
  'mobile',
  'mobile-passages.generated.ts',
);
const unavailableTranslation = '翻译暂不可用，请稍后重试。';
const allowPlaceholderTranslations =
  process.env.WORD_GOD_ALLOW_PLACEHOLDER_TRANSLATIONS === '1' ||
  process.argv.includes('--allow-placeholder-translations');

/**
 * `readJsonFile` 读取并解析指定 JSON 文件。
 */
function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

/**
 * `normalizeTokenKey` 将英文词面规整为词典匹配键。
 */
function normalizeTokenKey(value) {
  return value.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');
}

/**
 * `splitSentences` 将英文自然段拆成句子数组。
 */
function splitSentences(content) {
  const sentenceMatches = content.match(/[^.!?]+[.!?]+(?:["']+)?/g) ?? [
    content,
  ];

  return sentenceMatches.map((sentence, index) => ({
    index,
    text: sentence.trim(),
    translation: unavailableTranslation,
  }));
}

/**
 * `findSentenceIndex` 根据字符偏移查找 token 所属句子。
 */
function findSentenceIndex(sentences, offset) {
  let cursor = 0;

  for (const sentence of sentences) {
    cursor += sentence.text.length + 1;

    if (offset < cursor) {
      return sentence.index;
    }
  }

  return Math.max(sentences.length - 1, 0);
}

/**
 * `extractNeededLemmas` 从段落集合中提取 APK 需要的词典 lemma。
 */
function extractNeededLemmas(passages) {
  const lemmas = new Set();

  for (const passage of passages) {
    const matches = passage.content.matchAll(/[A-Za-z]+(?:['-][A-Za-z]+)*/g);

    for (const match of matches) {
      const lemma = normalizeTokenKey(match[0]);

      if (lemma) {
        lemmas.add(lemma);
      }
    }
  }

  return lemmas;
}

/**
 * `parseChineseDefinitions` 从 ECDICT 词条块中提取中文释义行。
 */
function parseChineseDefinitions(blockLines) {
  const definitions = [];
  let inChineseDefinitionBlock = false;

  for (const line of blockLines) {
    if (line.trim() === '- 中文释义:') {
      inChineseDefinitionBlock = true;
      continue;
    }

    if (inChineseDefinitionBlock && line.startsWith('- ')) {
      break;
    }

    if (inChineseDefinitionBlock) {
      const match = line.match(/^\s+-\s+(.+)$/);

      if (match?.[1]) {
        definitions.push(match[1].trim());
      }
    }
  }

  return definitions;
}

/**
 * `guessPartOfSpeechFromDefinition` 从 ECDICT 中文释义前缀推断词性。
 */
function guessPartOfSpeechFromDefinition(definition) {
  const match = definition.match(/^([a-z]+\.)\s+/i);

  return match?.[1] ?? '';
}

/**
 * `normalizeDefinition` 移除 ECDICT 中文释义中的词性前缀。
 */
function normalizeDefinition(definition) {
  return definition.replace(/^[a-z]+\.\s+/i, '').trim();
}

/**
 * `parseEcdictSubset` 从 ECDICT Markdown 中提取 APK 需要的瘦身词典。
 */
function parseEcdictSubset(neededLemmas) {
  if (!existsSync(ecdictPath)) {
    return new Map();
  }

  const markdown = readFileSync(ecdictPath, 'utf8');
  const lines = markdown.split(/\r?\n/);
  const entries = new Map();
  let currentLemma = null;
  let currentBlock = [];

  /**
   * `flushCurrentEntry` 在遇到下一个词条时保存当前需要的词典块。
   */
  function flushCurrentEntry() {
    if (!currentLemma || !neededLemmas.has(currentLemma)) {
      return;
    }

    const definitions = parseChineseDefinitions(currentBlock);
    const firstDefinition = definitions[0] ?? '';

    entries.set(currentLemma, {
      partOfSpeech: guessPartOfSpeechFromDefinition(firstDefinition) || 'n.',
      definitionCn: definitions.map(normalizeDefinition).join('；'),
    });
  }

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);

    if (headingMatch?.[1]) {
      flushCurrentEntry();
      currentLemma = normalizeTokenKey(headingMatch[1]);
      currentBlock = [];
      continue;
    }

    if (currentLemma) {
      currentBlock.push(line);
    }
  }

  flushCurrentEntry();

  return entries;
}

/**
 * `guessPartOfSpeech` 为词典缺失的 token 提供轻量词性回退。
 */
function guessPartOfSpeech(lemma) {
  if (lemma.endsWith('ly')) {
    return 'adv.';
  }

  if (lemma.endsWith('ing') || lemma.endsWith('ed')) {
    return 'v.';
  }

  if (
    lemma.endsWith('ion') ||
    lemma.endsWith('ment') ||
    lemma.endsWith('ness') ||
    lemma.endsWith('ity')
  ) {
    return 'n.';
  }

  return 'n.';
}

/**
 * `resolveDefinition` 查询瘦身词典或生成轻量释义回退。
 */
function resolveDefinition(lemma, lexicon) {
  const entry = lexicon.get(lemma);

  if (entry?.definitionCn) {
    return entry;
  }

  return {
    partOfSpeech: guessPartOfSpeech(lemma),
    definitionCn: `词典释义待补齐：${lemma}`,
  };
}

/**
 * `buildTokens` 从完整英文段落生成可点击 token。
 */
function buildTokens(content, sentences, lexicon) {
  const matches = [...content.matchAll(/[A-Za-z]+(?:['-][A-Za-z]+)*/g)];

  return matches.map((match, index) => {
    const surface = match[0];
    const lemma = normalizeTokenKey(surface);
    const definition = resolveDefinition(lemma, lexicon);
    const sentenceIndex = findSentenceIndex(sentences, match.index ?? 0);
    const sentence = sentences[sentenceIndex];

    return {
      id: `token-${index}-${lemma.replace(/[^a-z0-9]+/g, '-')}`,
      lemma,
      surface,
      sentenceIndex,
      partOfSpeech: definition.partOfSpeech,
      definitionCn: definition.definitionCn,
      translationCn: sentence?.translation ?? unavailableTranslation,
      isWord: true,
    };
  });
}

/**
 * `createTranslationLookup` 读取可选的移动端句子译文缓存。
 */
function createTranslationLookup() {
  if (!existsSync(translationCachePath)) {
    return new Map();
  }

  const records = readJsonFile(translationCachePath);

  return new Map(
    records.map((record) => [
      `${record.passageId}:${record.sentenceIndex}`,
      record.translation,
    ]),
  );
}

/**
 * `applyTranslations` 将句子译文缓存写入段落句子。
 */
function applyTranslations(passage, sentences, translationLookup) {
  return sentences.map((sentence) => {
    const translation =
      translationLookup.get(`${passage.id}:${sentence.index}`) ??
      unavailableTranslation;

    return {
      ...sentence,
      translation,
    };
  });
}

/**
 * `hasPlaceholderTranslation` 判断译文是否为不可交付的占位内容。
 */
function hasPlaceholderTranslation(value) {
  const normalizedValue = String(value ?? '').trim();

  return (
    !normalizedValue ||
    normalizedValue === unavailableTranslation ||
    normalizedValue.startsWith('自动翻译：') ||
    normalizedValue.startsWith('自动翻译:') ||
    normalizedValue.includes('待补齐') ||
    normalizedValue.includes('暂不可用')
  );
}

/**
 * `assertTranslationQuality` 在严格模式下阻止占位译文进入 APK 资源。
 */
function assertTranslationQuality(passages) {
  if (allowPlaceholderTranslations) {
    return;
  }

  const firstPlaceholder = passages
    .flatMap((passage) =>
      passage.sentences.map((sentence) => ({
        passageId: passage.passage.id,
        sentence,
      })),
    )
    .find((item) => hasPlaceholderTranslation(item.sentence.translation));

  if (firstPlaceholder) {
    throw new Error(
      [
        '移动端题库缺少真实中文译文。',
        `首个缺失位置：${firstPlaceholder.passageId}#${firstPlaceholder.sentence.index}`,
        `请写入 ${translationCachePath}，或仅临时构建时设置 WORD_GOD_ALLOW_PLACEHOLDER_TRANSLATIONS=1。`,
      ].join('\n'),
    );
  }
}

/**
 * `buildMobilePassage` 将缓存段落转换为前端离线客户端消费的响应结构。
 */
function buildMobilePassage(passage, lexicon, translationLookup) {
  const translatedSentences = applyTranslations(
    passage,
    splitSentences(passage.content),
    translationLookup,
  );

  return {
    passage: {
      id: passage.id,
      examType: passage.examType,
      year: passage.year,
      paper: passage.paper,
      questionType: passage.questionType,
      passageIndex: passage.passageIndex,
      textIndex: passage.textIndex,
      paragraphIndex: passage.paragraphIndex,
      title: passage.title,
      content: passage.content,
      sourceUrl: passage.sourceUrl,
    },
    sentences: translatedSentences,
    tokens: buildTokens(passage.content, translatedSentences, lexicon),
    selectedTokenIds: [],
    requiresAuthToComplete: false,
  };
}

/**
 * `writeGeneratedAsset` 将移动端题库写成可被 Vite 导入的 TS 模块。
 */
function writeGeneratedAsset(passages) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    [
      "import type { ReadingPassageResponse } from '@word-god/contracts';",
      '',
      'export const mobilePassages: ReadingPassageResponse[] = ',
      JSON.stringify(passages, null, 2),
      ';',
      '',
    ].join('\n'),
    'utf8',
  );
}

/**
 * `main` 生成 APK 离线题库资源。
 */
function main() {
  if (!existsSync(passageCachePath)) {
    throw new Error(`缺少段落缓存：${passageCachePath}`);
  }

  const sourcePassages = readJsonFile(passageCachePath);
  const neededLemmas = extractNeededLemmas(sourcePassages);
  const lexicon = parseEcdictSubset(neededLemmas);
  const translationLookup = createTranslationLookup();
  const mobilePassages = sourcePassages.map((passage) =>
    buildMobilePassage(passage, lexicon, translationLookup),
  );

  assertTranslationQuality(mobilePassages);
  writeGeneratedAsset(mobilePassages);
  console.log(`Generated ${mobilePassages.length} mobile passages.`);
}

main();
