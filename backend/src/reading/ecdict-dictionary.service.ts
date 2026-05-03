import { createReadStream, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { PassageToken } from '@word-god/contracts';
import { APP_STORE } from '../store/app-store';
import type { AppStore } from '../store/app-store';
import type { LexiconEntryRecord } from '../store/store.types';

export interface EcdictMarkdownEntry {
  word: string;
  partOfSpeech: string;
  definitionCn: string;
}

/**
 * `normalizeLookupKey` 将词典词头和 token 表面词规整为查询键。
 */
function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * `extractBacktickValue` 从 Markdown 行中提取反引号包裹的字段值。
 */
function extractBacktickValue(line: string): string {
  return line.match(/`([^`]*)`/)?.[1]?.trim() ?? '';
}

/**
 * `extractBulletValue` 从 Markdown 列表项中提取正文。
 */
function extractBulletValue(line: string): string {
  return line.replace(/^\s*-\s*/, '').trim();
}

/**
 * `derivePartOfSpeech` 从中文释义前缀中推导 ECDICT 缺失的词性字段。
 */
function derivePartOfSpeech(definitions: string[]): string {
  const allowedTags = new Set([
    'n.',
    'v.',
    'vt.',
    'vi.',
    'adj.',
    'adv.',
    'prep.',
    'conj.',
    'pron.',
    'num.',
    'int.',
    'art.',
    'aux.',
    'abbr.',
  ]);
  const tags: string[] = [];

  for (const definition of definitions) {
    for (const match of definition.matchAll(/\b([a-z]+)\./gi)) {
      const tag = `${match[1].toLowerCase()}.`;

      if (allowedTags.has(tag) && !tags.includes(tag)) {
        tags.push(tag);
      }
    }
  }

  return tags.join('/');
}

/**
 * `createEntry` 将当前解析到的 Markdown 片段转换为词典条目。
 */
function createEntry(
  word: string | null,
  partOfSpeech: string,
  definitions: string[],
): [string, EcdictMarkdownEntry] | null {
  if (!word || definitions.length === 0) {
    return null;
  }

  return [
    normalizeLookupKey(word),
    {
      word,
      partOfSpeech: partOfSpeech || derivePartOfSpeech(definitions),
      definitionCn: definitions.join('；'),
    },
  ];
}

/**
 * `streamEcdictMarkdownEntries` 从 ECDICT Markdown 文件中流式解析英汉词条。
 */
export async function* streamEcdictMarkdownEntries(
  dictionaryPath: string,
): AsyncGenerator<[string, EcdictMarkdownEntry]> {
  const lines = createInterface({
    input: createReadStream(dictionaryPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  let currentWord: string | null = null;
  let currentPartOfSpeech = '';
  let currentDefinitions: string[] = [];
  let activeSection: 'definitionCn' | 'other' = 'other';

  for await (const line of lines) {
    if (line.startsWith('## ')) {
      const entry = createEntry(
        currentWord,
        currentPartOfSpeech,
        currentDefinitions,
      );

      if (entry) {
        yield entry;
      }

      currentWord = line.slice(3).trim();
      currentPartOfSpeech = '';
      currentDefinitions = [];
      activeSection = 'other';
      continue;
    }

    if (line.startsWith('- 词性:')) {
      currentPartOfSpeech = extractBacktickValue(line);
      activeSection = 'other';
      continue;
    }

    if (line.startsWith('- 中文释义:')) {
      activeSection = 'definitionCn';
      continue;
    }

    if (line.startsWith('- ')) {
      activeSection = 'other';
      continue;
    }

    if (activeSection === 'definitionCn' && line.trimStart().startsWith('- ')) {
      currentDefinitions.push(extractBulletValue(line));
    }
  }

  const entry = createEntry(
    currentWord,
    currentPartOfSpeech,
    currentDefinitions,
  );

  if (entry) {
    yield entry;
  }
}

/**
 * `parseEcdictMarkdownFile` 从 ECDICT Markdown 文件中解析英汉词条。
 */
export async function parseEcdictMarkdownFile(
  dictionaryPath: string,
): Promise<Map<string, EcdictMarkdownEntry>> {
  const entries = new Map<string, EcdictMarkdownEntry>();

  for await (const [lemma, entry] of streamEcdictMarkdownEntries(
    dictionaryPath,
  )) {
    entries.set(lemma, entry);
  }

  return entries;
}

/**
 * `findWorkspaceRoot` 从当前目录向上查找包含 ECDICT Markdown 的仓库根目录。
 */
function findWorkspaceRoot(startDirectory = process.cwd()): string | null {
  let currentDirectory = resolve(startDirectory);

  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(join(currentDirectory, '词库', 'ecdict.md'))) {
      return currentDirectory;
    }

    const parentDirectory = dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return null;
    }

    currentDirectory = parentDirectory;
  }

  return null;
}

/**
 * `resolveDictionaryPath` 定位运行时可用的 ECDICT Markdown 文件。
 */
function resolveDictionaryPath(): string | null {
  const configuredPath = process.env.ECDICT_MARKDOWN_PATH;

  if (configuredPath && existsSync(configuredPath)) {
    return configuredPath;
  }

  const workspaceRoot = findWorkspaceRoot();

  return workspaceRoot ? join(workspaceRoot, '词库', 'ecdict.md') : null;
}

/**
 * `EcdictDictionaryService` 使用下载的 ECDICT Markdown 为 token 补齐词性和中文释义。
 */
@Injectable()
export class EcdictDictionaryService {
  private entriesPromise: Promise<Map<string, EcdictMarkdownEntry>> | null =
    null;

  /**
   * `constructor` 注入可选应用存储以优先读取已入库词典。
   */
  constructor(
    @Optional() @Inject(APP_STORE) private readonly store?: AppStore,
  ) {}

  /**
   * `enrichTokens` 用 ECDICT 词条覆盖可查询 token 的词性和中文释义。
   */
  async enrichTokens(tokens: PassageToken[]): Promise<PassageToken[]> {
    const persistedEntries = await this.getPersistedEntries(tokens);
    const entries = await this.getEntries();

    if (entries.size === 0 && persistedEntries.size === 0) {
      return tokens;
    }

    return tokens.map((token) => {
      if (!token.isWord) {
        return token;
      }

      const entry =
        persistedEntries.get(normalizeLookupKey(token.lemma)) ??
        persistedEntries.get(normalizeLookupKey(token.surface)) ??
        entries.get(normalizeLookupKey(token.lemma)) ??
        entries.get(normalizeLookupKey(token.surface));

      if (!entry) {
        return token;
      }

      return {
        ...token,
        partOfSpeech: entry.partOfSpeech || token.partOfSpeech,
        definitionCn: entry.definitionCn,
      };
    });
  }

  /**
   * `getPersistedEntries` 从数据库词典中查找本次 token 需要的词条。
   */
  private async getPersistedEntries(
    tokens: PassageToken[],
  ): Promise<Map<string, LexiconEntryRecord>> {
    const persistedEntries = new Map<string, LexiconEntryRecord>();

    if (!this.store) {
      return persistedEntries;
    }

    const keys = [
      ...new Set(
        tokens
          .filter((token) => token.isWord)
          .flatMap((token) => [
            normalizeLookupKey(token.lemma),
            normalizeLookupKey(token.surface),
          ]),
      ),
    ];

    for (const key of keys) {
      const entry = await this.store.findLexiconEntry(key);

      if (entry) {
        persistedEntries.set(key, entry);
      }
    }

    return persistedEntries;
  }

  /**
   * `getEntries` 懒加载并缓存 ECDICT Markdown 词条。
   */
  private async getEntries(): Promise<Map<string, EcdictMarkdownEntry>> {
    if (!this.entriesPromise) {
      this.entriesPromise = this.loadEntries();
    }

    return this.entriesPromise;
  }

  /**
   * `loadEntries` 读取词典文件，失败时返回空词典以保持阅读流程可用。
   */
  private async loadEntries(): Promise<Map<string, EcdictMarkdownEntry>> {
    const dictionaryPath = resolveDictionaryPath();

    if (!dictionaryPath) {
      return new Map<string, EcdictMarkdownEntry>();
    }

    try {
      return await parseEcdictMarkdownFile(dictionaryPath);
    } catch {
      return new Map<string, EcdictMarkdownEntry>();
    }
  }
}
