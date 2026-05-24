import { PrismaAppStore } from './prisma-app.store';

/**
 * `createStore` 构造可观察 Prisma 查询参数的存储实例。
 */
function createStore(passageFindMany: jest.Mock): PrismaAppStore {
  return new PrismaAppStore({
    passage: {
      findMany: passageFindMany,
    },
  } as never);
}

describe('PrismaAppStore', () => {
  it('lists only approved Kaoyan reading article sources', async () => {
    const passageFindMany = jest.fn().mockResolvedValue([]);
    const store = createStore(passageFindMany);

    await store.listPassages();

    expect(passageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          examType: 'kaoyan',
          questionType: 'reading',
          sourceDomain: {
            in: [
              'wordcram.com.cn',
              'jixun.iqihang.com',
              'kaoyan.eol.cn',
              'zhenti.burningvocabulary.cn',
            ],
          },
        },
      }),
    );
  });
});
