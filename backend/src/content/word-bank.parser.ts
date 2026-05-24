import { PassageRecord } from '../store/store.types';

/**
 * `ExtractedReadingText` 描述一篇 Text 可供抽样的正文段落。
 */
export interface ExtractedReadingText {
  textIndex: number;
  paragraphs: string[];
}

/**
 * `ExtractedWordBankPaper` 描述从单份词库 Markdown 中提取出的阅读文章。
 */
export interface ExtractedWordBankPaper {
  fileName: string;
  year: number;
  paper: string;
  sourceUrl: string;
  texts: ExtractedReadingText[];
  warnings: string[];
}

/**
 * `SelectedWordBankPassage` 描述可入库的 WordCram 自然段。
 */
export interface SelectedWordBankPassage {
  id: string;
  examType: 'kaoyan';
  year: number;
  paper: string;
  questionType: 'reading';
  passageIndex: number;
  textIndex: number;
  paragraphIndex: number;
  title: string;
  content: string;
  sourceUrl: string;
  sourceDomain: string;
  publishedAt: string;
}

/**
 * `extractMetadataValue` 从旧版 Markdown metadata 区域读取指定字段。
 */
function extractMetadataValue(markdown: string, key: string): string | null {
  const match = markdown.match(new RegExp(`^- ${key}: (.+)$`, 'm'));

  return match?.[1]?.trim() ?? null;
}

/**
 * `normalizePaperName` 将英文试卷名规范化为产品展示名。
 */
function normalizePaperName(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'english i' || normalized === 'i') {
    return '英语一';
  }

  if (normalized === 'english ii' || normalized === 'ii') {
    return '英语二';
  }

  return value.trim();
}

/**
 * `toPaperSlug` 将中文试卷名转换为稳定 id 片段。
 */
function toPaperSlug(value: string): string {
  return value === '英语一' ? 'english-i' : 'english-ii';
}

/**
 * `extractWordCramMetadata` 从 WordCram 文章文件名和引用头读取试卷信息。
 */
function extractWordCramMetadata(
  markdown: string,
  fileName: string,
): { year: number; paper: string; sourceUrl: string } {
  const fileMatch = fileName.match(
    /^(\d{4})-kaoyan-english-(i|ii)-articles\.md$/,
  );
  const sourceMatch = markdown.match(/^>\s*Source:\s*(.+)$/m);

  if (fileMatch?.[1] && fileMatch[2] && sourceMatch?.[1]) {
    return {
      year: Number(fileMatch[1]),
      paper: normalizePaperName(fileMatch[2]),
      sourceUrl: sourceMatch[1].trim(),
    };
  }

  const year = Number(extractMetadataValue(markdown, 'Year'));
  const paper = normalizePaperName(
    extractMetadataValue(markdown, 'Paper') ?? '',
  );
  const sourceUrl = extractMetadataValue(markdown, 'Source URL');

  if (!year || !paper || !sourceUrl) {
    throw new Error(`${fileName} 缺少 WordCram 来源或试卷 metadata`);
  }

  return { year, paper, sourceUrl };
}

/**
 * `isTextHeaderAt` 判断当前行是否为 Text 1-4 标题。
 */
function isTextHeaderAt(
  lines: string[],
  index: number,
): { textIndex: number; consumed: number } | null {
  const current = (lines[index]?.trim() ?? '').replace(/^#+\s*/, '');
  const compact = current.replace(/\s+/g, '').toLowerCase();
  const compactMatch = compact.match(/^text([1-4])$/);

  if (compactMatch?.[1]) {
    return {
      textIndex: Number(compactMatch[1]),
      consumed: 1,
    };
  }

  if (compact.toLowerCase() === 'text') {
    const nextLine = lines[index + 1]?.trim() ?? '';

    if (/^[1-4]$/.test(nextLine)) {
      return {
        textIndex: Number(nextLine),
        consumed: 2,
      };
    }
  }

  return null;
}

/**
 * `isPageMarker` 判断当前行是否为 Markdown 页码标题或 PDF 页码残留。
 */
function isPageMarker(line: string): boolean {
  const trimmed = line.trim();

  return (
    /^### Page \d+$/i.test(trimmed) ||
    /第\s*\d+\s*页\s*共\s*\d+\s*页/.test(trimmed)
  );
}

/**
 * `isNoiseLine` 判断当前行是否应从正文候选中剔除。
 */
function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();

  return (
    !trimmed ||
    isPageMarker(trimmed) ||
    /^Section\b/i.test(trimmed) ||
    /^Part [A-Z]\b/i.test(trimmed) ||
    /^Directions:?$/i.test(trimmed) ||
    /^Read the following/i.test(trimmed) ||
    /^Answer the questions/i.test(trimmed) ||
    /^Mark your answers/i.test(trimmed) ||
    /^\d{1,2}\./.test(trimmed) ||
    /^\[[A-D]\]/.test(trimmed) ||
    /^[A-D]\.$/.test(trimmed)
  );
}

/**
 * `cleanupParagraph` 合并 PDF 抽取行并修正常见空格噪声。
 */
function cleanupParagraph(lines: string[]): string {
  return lines
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:?!])/g, '$1')
    .replace(/([“"'])\s+/g, '$1')
    .replace(/\s+([”"'])/g, '$1')
    .trim();
}

/**
 * `questionStartForText` 返回当前 Text 对应的题号起点。
 */
function questionStartForText(textIndex: number): RegExp {
  return new RegExp(`^${21 + (textIndex - 1) * 5}\\.`);
}

/**
 * `extractParagraphCandidates` 从 Text 片段中提取正文段落候选。
 */
function extractParagraphCandidates(
  lines: string[],
  textIndex: number,
): string[] {
  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];
  const questionStart = questionStartForText(textIndex);

  for (let index = 0; index < lines.length; index += 1) {
    const header = isTextHeaderAt(lines, index);
    const trimmed = lines[index]?.trim() ?? '';

    if (
      header ||
      questionStart.test(trimmed) ||
      /^Section III\b/i.test(trimmed)
    ) {
      break;
    }

    if (isNoiseLine(trimmed)) {
      if (currentParagraph.length > 0) {
        paragraphs.push(cleanupParagraph(currentParagraph));
        currentParagraph = [];
      }
      continue;
    }

    currentParagraph.push(trimmed);
  }

  if (currentParagraph.length > 0) {
    paragraphs.push(cleanupParagraph(currentParagraph));
  }

  return paragraphs.filter((paragraph) => {
    const wordCount = paragraph.split(/\s+/).filter(Boolean).length;

    return (
      wordCount >= 20 &&
      !/^\d{1,2}\./.test(paragraph) &&
      !/^\[[A-D]\]/.test(paragraph)
    );
  });
}

/**
 * `findTextHeaderPositions` 找到 Markdown 中所有 Text 1-4 标题位置。
 */
function findTextHeaderPositions(
  lines: string[],
): Array<{ textIndex: number; lineIndex: number; bodyStart: number }> {
  const positions: Array<{
    textIndex: number;
    lineIndex: number;
    bodyStart: number;
  }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const header = isTextHeaderAt(lines, index);

    if (header) {
      positions.push({
        textIndex: header.textIndex,
        lineIndex: index,
        bodyStart: index + header.consumed,
      });
      index += header.consumed - 1;
    }
  }

  return positions;
}

/**
 * `extractReadingTextCandidates` 从词库 Markdown 中抽取 Text 1-4 正文段候选。
 */
export function extractReadingTextCandidates(
  markdown: string,
  fileName: string,
): ExtractedWordBankPaper {
  const { year, paper, sourceUrl } = extractWordCramMetadata(
    markdown,
    fileName,
  );
  const lines = markdown.split(/\r?\n/);
  const positions = findTextHeaderPositions(lines);
  const warnings: string[] = [];
  const texts = [1, 2, 3, 4].flatMap((textIndex) => {
    const position = positions.find((item) => item.textIndex === textIndex);

    if (!position) {
      warnings.push(`${fileName} 缺少 Text ${textIndex}`);
      return [];
    }

    const nextPosition = positions.find(
      (item) =>
        item.lineIndex > position.lineIndex && item.textIndex > textIndex,
    );
    const segmentEnd = nextPosition?.lineIndex ?? lines.length;
    const paragraphs = extractParagraphCandidates(
      lines.slice(position.bodyStart, segmentEnd),
      textIndex,
    );

    if (paragraphs.length === 0) {
      warnings.push(`${fileName} 的 Text ${textIndex} 未提取到正文段落`);
      return [];
    }

    return {
      textIndex,
      paragraphs,
    };
  });

  return {
    fileName,
    year,
    paper,
    sourceUrl,
    texts,
    warnings,
  };
}

/**
 * `selectWordBankPassages` 将每个 WordCram 自然段转换为稳定 Passage。
 */
export function selectWordBankPassages(
  paper: ExtractedWordBankPaper,
): SelectedWordBankPassage[] {
  return paper.texts.flatMap((text) => {
    const paperSlug = toPaperSlug(paper.paper);

    return text.paragraphs.map((paragraph, index) => {
      const paragraphIndex = index + 1;
      const baseId = `kaoyan-${paper.year}-${paperSlug}-reading-text-${text.textIndex}`;
      const id =
        paragraphIndex === 1 ? baseId : `${baseId}-paragraph-${paragraphIndex}`;

      return {
        id,
        examType: 'kaoyan',
        year: paper.year,
        paper: paper.paper,
        questionType: 'reading',
        passageIndex: text.textIndex,
        textIndex: text.textIndex,
        paragraphIndex,
        title: `${paper.year} ${paper.paper} Text ${text.textIndex} Paragraph ${paragraphIndex}`,
        content: paragraph,
        sourceUrl: paper.sourceUrl,
        sourceDomain: new URL(paper.sourceUrl).hostname,
        publishedAt: new Date(
          `${paper.year}-01-01T00:00:00.000Z`,
        ).toISOString(),
      };
    });
  });
}

/**
 * `toPassageRecord` 将抽中的词库段落和富化结果合并为可入库段落。
 */
export function toPassageRecord(
  selected: SelectedWordBankPassage,
  enriched: Pick<PassageRecord, 'sentences' | 'tokens'>,
): PassageRecord {
  return {
    ...selected,
    sentences: enriched.sentences,
    tokens: enriched.tokens,
  };
}
