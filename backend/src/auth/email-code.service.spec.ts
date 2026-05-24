import { BadRequestException } from '@nestjs/common';
import { InMemoryAppStore } from '../store/in-memory-app.store';
import type { EmailSender } from './email-sender';
import { EmailCodeService } from './email-code.service';

/**
 * `createCapturingSender` 创建可读取最近验证码内容的测试邮件发送器。
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

describe('EmailCodeService', () => {
  let store: InMemoryAppStore;
  let sender: EmailSender & { lastCode: string | null };
  let service: EmailCodeService;

  beforeEach(() => {
    store = new InMemoryAppStore();
    sender = createCapturingSender();
    service = new EmailCodeService(store, sender);
  });

  it('sends a six digit code through the configured sender', async () => {
    await service.sendCode({
      email: ' Reader@Example.COM ',
      purpose: 'login',
    });

    const savedCode = store.findLatestEmailCode('reader@example.com', 'login');

    expect(sender.lastCode).toEqual(expect.stringMatching(/^\d{6}$/));
    expect(savedCode?.email).toBe('reader@example.com');
    expect(savedCode?.purpose).toBe('login');
    expect(savedCode?.codeHash).not.toBe(sender.lastCode);
  });

  it('rejects repeated sends for the same email and purpose within sixty seconds', async () => {
    await service.sendCode({
      email: 'reader@example.com',
      purpose: 'login',
    });

    await expect(
      service.sendCode({
        email: 'reader@example.com',
        purpose: 'login',
      }),
    ).rejects.toMatchObject({
      message: '验证码发送太频繁，请稍后再试',
      status: 429,
    });
  });

  it('consumes a matching code and rejects reuse', async () => {
    await service.sendCode({
      email: 'reader@example.com',
      purpose: 'login',
    });

    await service.verifyCode('reader@example.com', 'login', sender.lastCode);

    await expect(
      service.verifyCode('reader@example.com', 'login', sender.lastCode),
    ).rejects.toThrow('验证码错误或已过期');
  });

  it('rejects expired and incorrect codes', async () => {
    await service.sendCode({
      email: 'reader@example.com',
      purpose: 'reset-password',
    });

    const savedCode = store.findLatestEmailCode(
      'reader@example.com',
      'reset-password',
    );
    store.saveEmailCode({
      ...savedCode!,
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    });

    await expect(
      service.verifyCode(
        'reader@example.com',
        'reset-password',
        sender.lastCode,
      ),
    ).rejects.toThrow('验证码错误或已过期');

    await service.sendCode({
      email: 'other@example.com',
      purpose: 'login',
    });

    await expect(
      service.verifyCode('other@example.com', 'login', '000000'),
    ).rejects.toThrow('验证码错误或已过期');
  });

  it('rejects verification after five failed attempts', async () => {
    await service.sendCode({
      email: 'reader@example.com',
      purpose: 'login',
    });

    for (let attemptIndex = 0; attemptIndex < 5; attemptIndex += 1) {
      await expect(
        service.verifyCode('reader@example.com', 'login', '000000'),
      ).rejects.toBeInstanceOf(BadRequestException);
    }

    await expect(
      service.verifyCode('reader@example.com', 'login', sender.lastCode),
    ).rejects.toThrow('验证码尝试次数过多，请重新获取');
  });
});
