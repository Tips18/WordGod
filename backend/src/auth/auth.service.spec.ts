import { AuthService } from './auth.service';
import { InMemoryAppStore } from '../store/in-memory-app.store';
import type { LoginRequest } from '@word-god/contracts';
import type { Response } from 'express';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `getSessionDurationMs` 计算刷新会话从创建到过期的毫秒数。
 */
function getSessionDurationMs(session: {
  createdAt: string;
  expiresAt: string;
}): number {
  return (
    new Date(session.expiresAt).getTime() -
    new Date(session.createdAt).getTime()
  );
}

/**
 * `expectDurationNear` 断言会话时长处于预期值附近。
 */
function expectDurationNear(actualMs: number, expectedMs: number): void {
  expect(actualMs).toBeGreaterThanOrEqual(expectedMs - 60_000);
  expect(actualMs).toBeLessThanOrEqual(expectedMs + 60_000);
}

describe('AuthService', () => {
  let store: InMemoryAppStore;
  let service: AuthService;

  beforeEach(() => {
    store = new InMemoryAppStore();
    service = new AuthService(store, 'test-secret');
  });

  it('registers a new user with a hashed password and persisted refresh session', async () => {
    const result = await service.register({
      email: 'reader@example.com',
      password: 'Passw0rd!',
    });

    const savedUser = store.findUserByEmail('reader@example.com');
    const sessions = store.listSessionsForUser(result.user.id);

    expect(result.user.email).toBe('reader@example.com');
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(savedUser?.passwordHash).not.toBe('Passw0rd!');
    expect(savedUser?.passwordHash.length).toBeGreaterThan(20);
    expect(sessions).toHaveLength(1);
  });

  it('rejects login when the password is incorrect', async () => {
    await service.register({
      email: 'reader@example.com',
      password: 'Passw0rd!',
    });

    await expect(
      service.login({
        email: 'reader@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrow('邮箱或密码错误');
  });

  it('logs in an existing user when the email casing or whitespace changes', async () => {
    await service.register({
      email: ' Reader@Example.COM ',
      password: 'Passw0rd!',
    });

    const result = await service.login({
      email: 'reader@example.com',
      password: 'Passw0rd!',
    });

    expect(result.user.email).toBe('reader@example.com');
  });

  it('creates a 30 day refresh session when login omits rememberLogin', async () => {
    const registered = await service.register({
      email: 'reader@example.com',
      password: 'Passw0rd!',
    });

    await service.logout(registered.refreshToken);

    const result = await service.login({
      email: 'reader@example.com',
      password: 'Passw0rd!',
    });
    const [session] = store.listSessionsForUser(result.user.id);

    expectDurationNear(getSessionDurationMs(session), 30 * DAY_MS);
  });

  it('creates a 24 hour refresh session when rememberLogin is false', async () => {
    const registered = await service.register({
      email: 'reader@example.com',
      password: 'Passw0rd!',
    });

    await service.logout(registered.refreshToken);

    const result = await service.login({
      email: 'reader@example.com',
      password: 'Passw0rd!',
      rememberLogin: false,
    } as LoginRequest & { rememberLogin: false });
    const [session] = store.listSessionsForUser(result.user.id);

    expectDurationNear(getSessionDurationMs(session), DAY_MS);
  });

  it('writes the refresh cookie with the provided session max age', () => {
    const cookie = jest.fn();
    const response = { cookie } as unknown as Response;

    service.writeCookies(response, 'access-token', 'refresh-token', DAY_MS);

    expect(cookie).toHaveBeenNthCalledWith(
      2,
      'word_god_refresh_token',
      'refresh-token',
      expect.objectContaining({ maxAge: DAY_MS }),
    );
  });

  it('removes the persisted refresh session on logout', async () => {
    const result = await service.register({
      email: 'reader@example.com',
      password: 'Passw0rd!',
    });

    await service.logout(result.refreshToken);

    expect(store.listSessionsForUser(result.user.id)).toHaveLength(0);
  });
});
