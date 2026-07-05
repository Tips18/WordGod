import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { EmailCodePurpose } from '@word-god/contracts';
import { compare, hash } from 'bcrypt';
import { randomInt } from 'node:crypto';
import { APP_STORE } from '../store/app-store';
import type { AppStore } from '../store/app-store';
import { EMAIL_SENDER } from './email-sender';
import type { EmailSender } from './email-sender';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

/**
 * `normalizeEmail` 将邮箱输入规整为验证码存储和匹配使用的格式。
 */
export function normalizeEmail(email: unknown): string {
  if (typeof email !== 'string') {
    throw new BadRequestException('请输入有效邮箱');
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw new BadRequestException('请输入有效邮箱');
  }

  return normalizedEmail;
}

/**
 * `normalizeEmailCode` 校验用户输入的 6 位邮箱验证码。
 */
function normalizeEmailCode(code: unknown): string {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    throw new BadRequestException('验证码错误或已过期');
  }

  return code.trim();
}

/**
 * `createSixDigitCode` 生成包含前导零的 6 位数字验证码。
 */
function createSixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * `EmailCodeService` 负责邮箱验证码生成、发送、校验和消费。
 */
@Injectable()
export class EmailCodeService {
  /**
   * `constructor` 注入验证码存储和邮件发送适配器。
   */
  constructor(
    @Inject(APP_STORE) private readonly store: AppStore,
    @Inject(EMAIL_SENDER) private readonly sender: EmailSender,
  ) {}

  /**
   * `sendCode` 为指定邮箱和用途生成验证码并通过邮件发送。
   */
  async sendCode(input: {
    email: unknown;
    purpose: EmailCodePurpose;
  }): Promise<{ success: true }> {
    const email = normalizeEmail(input.email);
    const latestCode = await this.store.findLatestEmailCode(
      email,
      input.purpose,
    );
    const now = new Date();

    if (
      latestCode &&
      now.getTime() - new Date(latestCode.lastSentAt).getTime() <
        RESEND_COOLDOWN_MS
    ) {
      throw new HttpException(
        '验证码发送太频繁，请稍后再试',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.store.invalidateEmailCodes(
      email,
      input.purpose,
      now.toISOString(),
    );

    const code = createSixDigitCode();
    const codeHash = await hash(code, 10);

    await this.store.saveEmailCode({
      email,
      purpose: input.purpose,
      codeHash,
      expiresAt: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
      consumedAt: null,
      attemptCount: 0,
      lastSentAt: now.toISOString(),
      createdAt: now.toISOString(),
    });
    await this.sender.sendEmailCode({
      email,
      purpose: input.purpose,
      code,
      expiresInMinutes: CODE_TTL_MS / 60_000,
    });

    return { success: true };
  }

  /**
   * `verifyCode` 校验验证码并在成功后标记为已消费。
   */
  async verifyCode(
    emailInput: unknown,
    purpose: EmailCodePurpose,
    codeInput: unknown,
  ): Promise<void> {
    const email = normalizeEmail(emailInput);
    const code = normalizeEmailCode(codeInput);
    const savedCode = await this.store.findLatestEmailCode(email, purpose);

    if (
      !savedCode ||
      savedCode.consumedAt ||
      new Date(savedCode.expiresAt).getTime() <= Date.now()
    ) {
      throw new BadRequestException('验证码错误或已过期');
    }

    if (savedCode.attemptCount >= MAX_VERIFY_ATTEMPTS) {
      throw new BadRequestException('验证码尝试次数过多，请重新获取');
    }

    const matched = await compare(code, savedCode.codeHash);

    if (!matched) {
      await this.store.saveEmailCode({
        ...savedCode,
        attemptCount: savedCode.attemptCount + 1,
      });
      throw new BadRequestException('验证码错误或已过期');
    }

    await this.store.saveEmailCode({
      ...savedCode,
      consumedAt: new Date().toISOString(),
    });
  }
}
