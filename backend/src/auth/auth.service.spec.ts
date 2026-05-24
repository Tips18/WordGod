import type { LoginRequest } from '@word-god/contracts';
import type { Response } from 'express';
import { EmailCodeService } from './email-code.service';
import type { EmailSender } from './email-sender';
import { AuthService } from './auth.service';
import { InMemoryAppStore } from '../store/in-memory-app.store';

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

/**
 * `createCapturingSender` 创建可复用最近验证码的测试邮件发送器。
 */
function createCapturingSender(): EmailSender & { lastCode: string | null } {
  return {
    lastCode: null,
    sendEmailCode({ code }) {
      this.lastCode = code;
      return Promise.resolve();
    },
  };
}

describe('AuthService', () => {
  let store: InMemoryAppStore;
  let service: AuthService;
  let emailCodeService: EmailCodeService;
  let sender: EmailSender & { lastCode: string | null };

  beforeEach(() => {
    store = new InMemoryAppStore();
    sender = createCapturingSender();
    emailCodeService = new EmailCodeService(store, sender);
    service = new AuthService(store, 'test-secret', emailCodeService);
  });

  /**
   * `registerUser` 通过验证码注册流程创建测试用户。
   */
  async function registerUser(email = 'reader@example.com') {
    await emailCodeService.sendCode({
      email,
      purpose: 'register',
    });

    return service.register({
      email,
      password: 'Passw0rd!',
      emailCode: sender.lastCode ?? '',
    });
  }

  it('registers a new user with a hashed password and persisted refresh session', async () => {
    const result = await registerUser();

    const savedUser = store.findUserByEmail('reader@example.com');
    const sessions = store.listSessionsForUser(result.user.id);

    expect(result.user.email).toBe('reader@example.com');
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(savedUser?.passwordHash).not.toBe('Passw0rd!');
    expect(savedUser?.passwordHash.length).toBeGreaterThan(20);
    expect(sessions).toHaveLength(1);
  });

  it('rejects registration without a valid register email code', async () => {
    await expect(
      service.register({
        email: 'reader@example.com',
        password: 'Passw0rd!',
        emailCode: '000000',
      }),
    ).rejects.toThrow('验证码错误或已过期');
  });

  it('rejects login when the password is incorrect', async () => {
    await registerUser();

    await expect(
      service.login({
        email: 'reader@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrow('邮箱或密码错误');
  });

  it('rejects registration when email or password is blank', async () => {
    await expect(
      service.register({
        email: ' ',
        password: 'Passw0rd!',
        emailCode: '123456',
      }),
    ).rejects.toThrow('请输入有效邮箱');

    await emailCodeService.sendCode({
      email: 'reader@example.com',
      purpose: 'register',
    });

    await expect(
      service.register({
        email: 'reader@example.com',
        password: ' ',
        emailCode: sender.lastCode ?? '',
      }),
    ).rejects.toThrow('请输入密码');
  });

  it('rejects malformed login payloads before password comparison', async () => {
    const malformedLoginPayload = {
      password: 'Passw0rd!',
    } as unknown as LoginRequest;

    await expect(service.login(malformedLoginPayload)).rejects.toThrow(
      '请输入有效邮箱',
    );
  });

  it('logs in an existing user when the email casing or whitespace changes', async () => {
    await registerUser(' Reader@Example.COM ');

    const result = await service.login({
      email: 'reader@example.com',
      password: 'Passw0rd!',
    });

    expect(result.user.email).toBe('reader@example.com');
  });

  it('creates a 30 day refresh session when login omits rememberLogin', async () => {
    const registered = await registerUser();

    await service.logout(registered.refreshToken);

    const result = await service.login({
      email: 'reader@example.com',
      password: 'Passw0rd!',
    });
    const [session] = store.listSessionsForUser(result.user.id);

    expectDurationNear(getSessionDurationMs(session), 30 * DAY_MS);
  });

  it('creates a 24 hour refresh session when rememberLogin is false', async () => {
    const registered = await registerUser();

    await service.logout(registered.refreshToken);

    const result = await service.login({
      email: 'reader@example.com',
      password: 'Passw0rd!',
      rememberLogin: false,
    });
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
    const result = await registerUser();

    await service.logout(result.refreshToken);

    expect(store.listSessionsForUser(result.user.id)).toHaveLength(0);
  });

  it('logs in with a valid email code and preserves short sessions', async () => {
    await registerUser();
    await emailCodeService.sendCode({
      email: 'reader@example.com',
      purpose: 'login',
    });

    const result = await service.loginWithEmailCode({
      email: 'reader@example.com',
      emailCode: sender.lastCode ?? '',
      rememberLogin: false,
    });
    const sessions = store.listSessionsForUser(result.user.id);

    expect(result.user.email).toBe('reader@example.com');
    expectDurationNear(getSessionDurationMs(sessions.at(-1)!), DAY_MS);
  });

  it('rejects reset password email code requests for unknown emails', async () => {
    await expect(
      service.sendEmailCode({
        email: 'missing@example.com',
        purpose: 'reset-password',
      }),
    ).rejects.toThrow('邮箱未注册，请先注册');

    expect(sender.lastCode).toBeNull();
  });

  it('resets password with a valid email code and rejects the old password', async () => {
    await registerUser();
    await emailCodeService.sendCode({
      email: 'reader@example.com',
      purpose: 'reset-password',
    });

    await service.resetPassword({
      email: 'reader@example.com',
      emailCode: sender.lastCode ?? '',
      newPassword: 'NewPassw0rd!',
      rememberLogin: false,
    });

    await expect(
      service.login({
        email: 'reader@example.com',
        password: 'Passw0rd!',
      }),
    ).rejects.toThrow('邮箱或密码错误');
    await expect(
      service.login({
        email: 'reader@example.com',
        password: 'NewPassw0rd!',
      }),
    ).resolves.toMatchObject({
      user: { email: 'reader@example.com' },
    });
  });
});
