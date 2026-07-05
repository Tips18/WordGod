import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { streamEcdictMarkdownEntries } from '../reading/ecdict-dictionary.service';

interface EcdictImporterPrisma {
  lexiconEntry: Pick<PrismaClient['lexiconEntry'], 'upsert'>;
  $transaction: PrismaClient['$transaction'];
}

/**
 * `upsertEcdictMarkdownEntries` 将 ECDICT Markdown 词条批量写入 LexiconEntry。
 */
export async function upsertEcdictMarkdownEntries(
  prisma: EcdictImporterPrisma,
  dictionaryPath: string,
  batchSize = 500,
): Promise<number> {
  let importedCount = 0;
  let batch: Array<ReturnType<EcdictImporterPrisma['lexiconEntry']['upsert']>> =
    [];

  for await (const [lemma, entry] of streamEcdictMarkdownEntries(
    dictionaryPath,
  )) {
    batch.push(
      prisma.lexiconEntry.upsert({
        where: { lemma },
        create: {
          id: randomUUID(),
          lemma,
          surface: entry.word,
          partOfSpeech: entry.partOfSpeech,
          definitionCn: entry.definitionCn,
          inflections: [],
        },
        update: {
          surface: entry.word,
          partOfSpeech: entry.partOfSpeech,
          definitionCn: entry.definitionCn,
          inflections: [],
        },
      }),
    );

    if (batch.length >= batchSize) {
      await prisma.$transaction(batch);
      importedCount += batch.length;
      batch = [];
    }
  }

  if (batch.length > 0) {
    await prisma.$transaction(batch);
    importedCount += batch.length;
  }

  return importedCount;
}
