import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemoryAppStore } from './in-memory-app.store';

/**
 * `createTempStorePath` 创建单测专用的临时持久化文件路径。
 */
function createTempStorePath(): { directory: string; storePath: string } {
  const directory = mkdtempSync(join(tmpdir(), 'word-god-memory-store-'));

  return {
    directory,
    storePath: join(directory, 'memory-store.json'),
  };
}

describe('InMemoryAppStore', () => {
  it('restores saved users from the persistence file on a new store instance', () => {
    const { directory, storePath } = createTempStorePath();

    try {
      const firstStore = new InMemoryAppStore(undefined, {
        persistencePath: storePath,
      });

      firstStore.saveUser({
        email: 'reader@example.com',
        passwordHash: 'hashed-password',
        createdAt: '2026-05-24T00:00:00.000Z',
        updatedAt: '2026-05-24T00:00:00.000Z',
      });

      const secondStore = new InMemoryAppStore(undefined, {
        persistencePath: storePath,
      });

      expect(secondStore.findUserByEmail('reader@example.com')).toMatchObject({
        email: 'reader@example.com',
        passwordHash: 'hashed-password',
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
