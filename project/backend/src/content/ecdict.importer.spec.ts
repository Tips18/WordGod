import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { upsertEcdictMarkdownEntries } from './ecdict.importer';

interface LexiconUpsertArgs {
  where: { lemma: string };
  create: {
    id: string;
    lemma: string;
    surface: string;
    partOfSpeech: string;
    definitionCn: string;
    inflections: string[];
  };
  update: {
    surface: string;
    partOfSpeech: string;
    definitionCn: string;
    inflections: string[];
  };
}

describe('ecdict importer', () => {
  let tempDirectory: string;
  let dictionaryPath: string;

  beforeEach(async () => {
    tempDirectory = await mkdtemp(join(tmpdir(), 'word-god-ecdict-import-'));
    dictionaryPath = join(tempDirectory, 'ecdict.md');
    await writeFile(
      dictionaryPath,
      [
        '# ECDICT 英汉词典',
        '',
        '## Align',
        '',
        '- 中文释义:',
        '  - vi. 排列, 排成一行, 结盟',
        '  - vt. 使结盟, 使成一行, 校正',
        '',
        '## ability',
        '',
        '- 词性: `n.`',
        '- 中文释义:',
        '  - n. 能力, 才干',
        '',
      ].join('\n'),
      'utf8',
    );
  });

  afterEach(async () => {
    await rm(tempDirectory, { force: true, recursive: true });
  });

  it('upserts parsed ECDICT Markdown entries into LexiconEntry in batches', async () => {
    const upsert = jest.fn<Promise<LexiconUpsertArgs>, [LexiconUpsertArgs]>(
      (args) => Promise.resolve(args),
    );
    const transaction = jest.fn((operations: unknown[]) =>
      Promise.resolve(operations),
    );
    const prisma = {
      lexiconEntry: { upsert },
      $transaction: transaction,
    };

    const importedCount = await upsertEcdictMarkdownEntries(
      prisma,
      dictionaryPath,
      1,
    );

    expect(importedCount).toBe(2);
    expect(transaction).toHaveBeenCalledTimes(2);
    const alignCall = upsert.mock.calls.find(
      ([args]) => args.where.lemma === 'align',
    )?.[0];

    expect(alignCall?.create).toEqual(
      expect.objectContaining({
        lemma: 'align',
        surface: 'Align',
        partOfSpeech: 'vi./vt.',
        definitionCn: 'vi. 排列, 排成一行, 结盟；vt. 使结盟, 使成一行, 校正',
        inflections: [],
      }),
    );
    expect(alignCall?.update).toEqual({
      surface: 'Align',
      partOfSpeech: 'vi./vt.',
      definitionCn: 'vi. 排列, 排成一行, 结盟；vt. 使结盟, 使成一行, 校正',
      inflections: [],
    });
  });
});
