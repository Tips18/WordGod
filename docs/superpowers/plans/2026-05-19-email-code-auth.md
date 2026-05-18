# Email Code Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email verification codes for registration, email-code login, and password reset while preserving existing password login and cookie session behavior.

**Architecture:** Introduce shared contracts for email-code requests, an `EmailVerificationCode` persistence model in both memory and Prisma stores, and an `EmailCodeService` that owns code generation, throttling, hashing, verification, consumption, and mail delivery. `AuthService` will depend on `EmailCodeService` for register/login/reset flows and continue using the existing `AuthSession` cookie model for authenticated sessions.

**Tech Stack:** NestJS, Prisma/PostgreSQL, in-memory store, React/Vite, Vitest, Jest, Supertest, bcrypt, `node:crypto`, SMTP via `nodemailer`.

---

## File Structure

- Modify `packages/contracts/src/index.ts`: add email-code purpose and request/response DTOs.
- Modify `backend/prisma/schema.prisma`: add `EmailVerificationCode` model.
- Create `backend/prisma/migrations/202605190001_add_email_verification_codes/migration.sql`: create the table and indexes.
- Modify `backend/src/store/store.types.ts`: add `EmailVerificationCodeRecord`.
- Modify `backend/src/store/app-store.ts`: add email-code store methods.
- Modify `backend/src/store/in-memory-app.store.ts`: implement email-code methods.
- Modify `backend/src/store/prisma-app.store.ts`: implement email-code methods.
- Create `backend/src/auth/email-sender.ts`: define sender interface plus console and SMTP implementations.
- Create `backend/src/auth/email-code.service.ts`: implement email-code lifecycle.
- Create `backend/src/auth/email-code.service.spec.ts`: unit tests for code lifecycle.
- Modify `backend/src/auth/auth.service.ts`: require register codes, add email-code login and password reset.
- Modify `backend/src/auth/auth.service.spec.ts`: unit tests for new auth flows.
- Modify `backend/src/auth/auth.controller.ts`: expose `POST /auth/email-codes`, `POST /auth/login/email-code`, `POST /auth/password/reset`.
- Modify `backend/src/app.module.ts`: wire `EmailCodeService` and sender factory.
- Modify `backend/test/app.e2e-spec.ts`: add e2e coverage for send/register/login/reset.
- Modify `frontend/src/api/client.ts`: add email-code API calls.
- Modify `frontend/src/components/auth-form-card.tsx`: add password login, code login, register, reset password modes.
- Modify `frontend/src/pages/auth-page.tsx` and `frontend/src/pages/reading-page.tsx`: pass new auth form flows through.
- Modify `frontend/src/app.behavior.spec.tsx`: add frontend behavior tests.
- Modify `README.md`, `backend/README.md`, `frontend/README.md`, `docs/business/PRD.md`, `docs/technical/ARCHITECTURE.md`, `docs/technical/DATABASE.md`, `docs/technical/CODE_NOTES.md`: document the scope change and configuration.

## Task 1: Shared Contracts And Database Shape

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/202605190001_add_email_verification_codes/migration.sql`
- Modify: `docs/technical/DATABASE.md` later in Task 6

- [ ] **Step 1: Update shared contract types**

Add these exports to `packages/contracts/src/index.ts` near the auth DTOs:

```ts
/**
 * `EmailCodePurpose` 定义邮箱验证码使用场景。
 */
export type EmailCodePurpose = 'register' | 'login' | 'reset-password';

/**
 * `SendEmailCodeRequest` 描述发送邮箱验证码入参。
 */
export interface SendEmailCodeRequest {
  email: string;
  purpose: EmailCodePurpose;
}

/**
 * `SendEmailCodeResponse` 描述验证码发送接口响应。
 */
export interface SendEmailCodeResponse {
  success: true;
}

/**
 * `RegisterRequest` 描述注册入参。
 */
export interface RegisterRequest {
  email: string;
  password: string;
  emailCode: string;
}

/**
 * `EmailCodeLoginRequest` 描述邮箱验证码登录入参。
 */
export interface EmailCodeLoginRequest {
  email: string;
  emailCode: string;
  rememberLogin?: boolean;
}

/**
 * `ResetPasswordRequest` 描述验证码重置密码入参。
 */
export interface ResetPasswordRequest {
  email: string;
  emailCode: string;
  newPassword: string;
  rememberLogin?: boolean;
}
```

Keep the existing `LoginRequest` unchanged.

- [ ] **Step 2: Add Prisma model**

Add this model to `backend/prisma/schema.prisma` after `AuthSession`:

```prisma
model EmailVerificationCode {
  id           String    @id @default(uuid())
  email        String
  purpose      String
  codeHash     String
  expiresAt    DateTime
  consumedAt   DateTime?
  attemptCount Int       @default(0)
  lastSentAt   DateTime
  createdAt    DateTime  @default(now())

  @@index([email, purpose, createdAt])
  @@index([expiresAt])
}
```

- [ ] **Step 3: Add migration SQL**

Create `backend/prisma/migrations/202605190001_add_email_verification_codes/migration.sql`:

```sql
CREATE TABLE "EmailVerificationCode" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastSentAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailVerificationCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailVerificationCode_email_purpose_createdAt_idx"
  ON "EmailVerificationCode"("email", "purpose", "createdAt");

CREATE INDEX "EmailVerificationCode_expiresAt_idx"
  ON "EmailVerificationCode"("expiresAt");
```

- [ ] **Step 4: Run type build to expose contract breakage**

Run:

```powershell
corepack pnpm --filter @word-god/contracts build
```

Expected: contracts build passes. Backend/frontend may still fail until later tasks consume the new request shapes.

- [ ] **Step 5: Commit**

```powershell
git add packages/contracts/src/index.ts backend/prisma/schema.prisma backend/prisma/migrations/202605190001_add_email_verification_codes/migration.sql
git commit -m "feat: add email code contracts and schema"
```

## Task 2: Store Support For Email Codes

**Files:**
- Modify: `backend/src/store/store.types.ts`
- Modify: `backend/src/store/app-store.ts`
- Modify: `backend/src/store/in-memory-app.store.ts`
- Modify: `backend/src/store/prisma-app.store.ts`
- Create or modify tests: `backend/src/store/prisma-app.store.spec.ts` if it already exists in the worktree; otherwise cover via `email-code.service.spec.ts` in Task 3.

- [ ] **Step 1: Add store record type**

In `backend/src/store/store.types.ts`, add:

```ts
/**
 * `EmailVerificationCodeRecord` 描述邮箱验证码实体。
 */
export interface EmailVerificationCodeRecord {
  id: string;
  email: string;
  purpose: 'register' | 'login' | 'reset-password';
  codeHash: string;
  expiresAt: string;
  consumedAt: string | null;
  attemptCount: number;
  lastSentAt: string;
  createdAt: string;
}
```

Update imports and `StoreSeed`:

```ts
emailVerificationCodes: EmailVerificationCodeRecord[];
```

- [ ] **Step 2: Add store interface methods**

In `backend/src/store/app-store.ts`, import `EmailVerificationCodeRecord` and add:

```ts
  saveEmailVerificationCode(
    code: Omit<EmailVerificationCodeRecord, 'id'> & { id?: string },
  ): MaybePromise<EmailVerificationCodeRecord>;
  listEmailVerificationCodes(
    email: string,
    purpose: EmailVerificationCodeRecord['purpose'],
  ): MaybePromise<EmailVerificationCodeRecord[]>;
  invalidateEmailVerificationCodes(
    email: string,
    purpose: EmailVerificationCodeRecord['purpose'],
    consumedAt: string,
  ): MaybePromise<void>;
```

- [ ] **Step 3: Implement in-memory store**

In `backend/src/store/in-memory-app.store.ts`:

```ts
  private readonly emailVerificationCodes: EmailVerificationCodeRecord[];
```

Initialize in constructor:

```ts
this.emailVerificationCodes = [...(seed?.emailVerificationCodes ?? [])];
```

Add methods:

```ts
  /**
   * `saveEmailVerificationCode` 写入或更新邮箱验证码记录。
   */
  saveEmailVerificationCode(
    code: Omit<EmailVerificationCodeRecord, 'id'> & { id?: string },
  ): EmailVerificationCodeRecord {
    const existingIndex = code.id
      ? this.emailVerificationCodes.findIndex((item) => item.id === code.id)
      : -1;
    const savedCode: EmailVerificationCodeRecord = {
      id: code.id ?? randomUUID(),
      ...code,
    };

    if (existingIndex >= 0) {
      this.emailVerificationCodes[existingIndex] = savedCode;
      return savedCode;
    }

    this.emailVerificationCodes.push(savedCode);
    return savedCode;
  }

  /**
   * `listEmailVerificationCodes` 返回指定邮箱和用途的验证码记录。
   */
  listEmailVerificationCodes(
    email: string,
    purpose: EmailVerificationCodeRecord['purpose'],
  ): EmailVerificationCodeRecord[] {
    return this.emailVerificationCodes
      .filter((code) => code.email === email && code.purpose === purpose)
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      );
  }

  /**
   * `invalidateEmailVerificationCodes` 作废指定邮箱和用途的未消费验证码。
   */
  invalidateEmailVerificationCodes(
    email: string,
    purpose: EmailVerificationCodeRecord['purpose'],
    consumedAt: string,
  ): void {
    for (const code of this.emailVerificationCodes) {
      if (code.email === email && code.purpose === purpose && !code.consumedAt) {
        code.consumedAt = consumedAt;
      }
    }
  }
```

- [ ] **Step 4: Implement Prisma store**

In `backend/src/store/prisma-app.store.ts`, add a converter:

```ts
/**
 * `toEmailVerificationCodeRecord` 将 Prisma 验证码实体转换为存储实体。
 */
function toEmailVerificationCodeRecord(code: {
  id: string;
  email: string;
  purpose: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  attemptCount: number;
  lastSentAt: Date;
  createdAt: Date;
}): EmailVerificationCodeRecord {
  return {
    id: code.id,
    email: code.email,
    purpose: code.purpose as EmailVerificationCodeRecord['purpose'],
    codeHash: code.codeHash,
    expiresAt: toIsoString(code.expiresAt),
    consumedAt: code.consumedAt ? toIsoString(code.consumedAt) : null,
    attemptCount: code.attemptCount,
    lastSentAt: toIsoString(code.lastSentAt),
    createdAt: toIsoString(code.createdAt),
  };
}
```

Add methods:

```ts
  /**
   * `saveEmailVerificationCode` 写入或更新邮箱验证码记录。
   */
  async saveEmailVerificationCode(
    code: Omit<EmailVerificationCodeRecord, 'id'> & { id?: string },
  ): Promise<EmailVerificationCodeRecord> {
    const savedCode = code.id
      ? await this.prisma.emailVerificationCode.upsert({
          where: { id: code.id },
          create: {
            id: code.id,
            email: code.email,
            purpose: code.purpose,
            codeHash: code.codeHash,
            expiresAt: new Date(code.expiresAt),
            consumedAt: code.consumedAt ? new Date(code.consumedAt) : null,
            attemptCount: code.attemptCount,
            lastSentAt: new Date(code.lastSentAt),
            createdAt: new Date(code.createdAt),
          },
          update: {
            codeHash: code.codeHash,
            expiresAt: new Date(code.expiresAt),
            consumedAt: code.consumedAt ? new Date(code.consumedAt) : null,
            attemptCount: code.attemptCount,
            lastSentAt: new Date(code.lastSentAt),
          },
        })
      : await this.prisma.emailVerificationCode.create({
          data: {
            email: code.email,
            purpose: code.purpose,
            codeHash: code.codeHash,
            expiresAt: new Date(code.expiresAt),
            consumedAt: code.consumedAt ? new Date(code.consumedAt) : null,
            attemptCount: code.attemptCount,
            lastSentAt: new Date(code.lastSentAt),
            createdAt: new Date(code.createdAt),
          },
        });

    return toEmailVerificationCodeRecord(savedCode);
  }

  /**
   * `listEmailVerificationCodes` 返回指定邮箱和用途的验证码记录。
   */
  async listEmailVerificationCodes(
    email: string,
    purpose: EmailVerificationCodeRecord['purpose'],
  ): Promise<EmailVerificationCodeRecord[]> {
    const codes = await this.prisma.emailVerificationCode.findMany({
      where: { email, purpose },
      orderBy: { createdAt: 'desc' },
    });

    return codes.map(toEmailVerificationCodeRecord);
  }

  /**
   * `invalidateEmailVerificationCodes` 作废指定邮箱和用途的未消费验证码。
   */
  async invalidateEmailVerificationCodes(
    email: string,
    purpose: EmailVerificationCodeRecord['purpose'],
    consumedAt: string,
  ): Promise<void> {
    await this.prisma.emailVerificationCode.updateMany({
      where: {
        email,
        purpose,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(consumedAt),
      },
    });
  }
```

- [ ] **Step 5: Run backend type check through tests**

Run:

```powershell
corepack pnpm --filter backend test -- auth.service.spec.ts
```

Expected: existing auth tests may fail because `RegisterRequest` now requires `emailCode`; this is acceptable until Task 4 updates auth flows. Store-level TypeScript errors must be fixed before moving on.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/store/store.types.ts backend/src/store/app-store.ts backend/src/store/in-memory-app.store.ts backend/src/store/prisma-app.store.ts
git commit -m "feat: persist email verification codes"
```

## Task 3: Email Sender And EmailCodeService

**Files:**
- Create: `backend/src/auth/email-sender.ts`
- Create: `backend/src/auth/email-code.service.ts`
- Create: `backend/src/auth/email-code.service.spec.ts`
- Modify: `backend/package.json`, `pnpm-lock.yaml` during dependency install

- [ ] **Step 1: Add SMTP dependency**

Run:

```powershell
corepack pnpm --filter backend add nodemailer
corepack pnpm --filter backend add -D @types/nodemailer
```

Expected: `backend/package.json` and `pnpm-lock.yaml` change.

- [ ] **Step 2: Write failing service tests**

Create `backend/src/auth/email-code.service.spec.ts`:

```ts
import { BadRequestException, TooManyRequestsException } from '@nestjs/common';
import { compare } from 'bcrypt';
import { EmailCodeService } from './email-code.service';
import type { EmailSender } from './email-sender';
import { InMemoryAppStore } from '../store/in-memory-app.store';

/**
 * `createSender` 构造可断言邮件内容的测试发送器。
 */
function createSender(): EmailSender & {
  sentMessages: Array<{ to: string; subject: string; text: string }>;
} {
  return {
    sentMessages: [],
    async send(message) {
      this.sentMessages.push(message);
    },
  };
}

describe('EmailCodeService', () => {
  it('sends a six digit code and stores only a hash', async () => {
    const store = new InMemoryAppStore();
    const sender = createSender();
    const service = new EmailCodeService(store, sender, {
      now: () => new Date('2026-05-19T00:00:00.000Z'),
      generateCode: () => '123456',
    });

    await service.sendCode({
      email: ' Reader@Example.COM ',
      purpose: 'register',
    });

    const [savedCode] = store.listEmailVerificationCodes(
      'reader@example.com',
      'register',
    );

    expect(sender.sentMessages[0]).toMatchObject({
      to: 'reader@example.com',
      subject: '我不是词神验证码',
    });
    expect(sender.sentMessages[0].text).toContain('123456');
    expect(savedCode.codeHash).not.toBe('123456');
    await expect(compare('123456', savedCode.codeHash)).resolves.toBe(true);
  });

  it('rejects repeated sends inside the cooldown window', async () => {
    const store = new InMemoryAppStore();
    const sender = createSender();
    const service = new EmailCodeService(store, sender, {
      now: () => new Date('2026-05-19T00:00:00.000Z'),
      generateCode: () => '123456',
    });

    await service.sendCode({
      email: 'reader@example.com',
      purpose: 'login',
    });

    await expect(
      service.sendCode({
        email: 'reader@example.com',
        purpose: 'login',
      }),
    ).rejects.toThrow(TooManyRequestsException);
  });

  it('consumes a valid code once and rejects reuse', async () => {
    const store = new InMemoryAppStore();
    const sender = createSender();
    const service = new EmailCodeService(store, sender, {
      now: () => new Date('2026-05-19T00:00:00.000Z'),
      generateCode: () => '123456',
    });

    await service.sendCode({
      email: 'reader@example.com',
      purpose: 'reset-password',
    });
    await service.consumeCode({
      email: 'reader@example.com',
      purpose: 'reset-password',
      emailCode: '123456',
    });

    await expect(
      service.consumeCode({
        email: 'reader@example.com',
        purpose: 'reset-password',
        emailCode: '123456',
      }),
    ).rejects.toThrow('验证码错误或已过期');
  });

  it('increments attempts and rejects after five wrong codes', async () => {
    const store = new InMemoryAppStore();
    const sender = createSender();
    const service = new EmailCodeService(store, sender, {
      now: () => new Date('2026-05-19T00:00:00.000Z'),
      generateCode: () => '123456',
    });

    await service.sendCode({
      email: 'reader@example.com',
      purpose: 'login',
    });

    for (let index = 0; index < 5; index += 1) {
      await expect(
        service.consumeCode({
          email: 'reader@example.com',
          purpose: 'login',
          emailCode: '000000',
        }),
      ).rejects.toThrow(BadRequestException);
    }

    await expect(
      service.consumeCode({
        email: 'reader@example.com',
        purpose: 'login',
        emailCode: '123456',
      }),
    ).rejects.toThrow('验证码尝试次数过多，请重新获取');
  });
});
```

- [ ] **Step 3: Run tests to verify RED**

Run:

```powershell
corepack pnpm --filter backend test -- email-code.service.spec.ts
```

Expected: FAIL because `email-code.service.ts` and `email-sender.ts` do not exist.

- [ ] **Step 4: Implement email sender**

Create `backend/src/auth/email-sender.ts`:

```ts
import nodemailer from 'nodemailer';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/**
 * `ConsoleEmailSender` 在本地开发中把验证码邮件输出到控制台。
 */
export class ConsoleEmailSender implements EmailSender {
  /**
   * `send` 输出邮件内容供本地调试使用。
   */
  async send(message: EmailMessage): Promise<void> {
    console.info(
      `[email-code] to=${message.to} subject=${message.subject} text=${message.text}`,
    );
  }
}

/**
 * `SmtpEmailSender` 使用 SMTP 发送验证码邮件。
 */
export class SmtpEmailSender implements EmailSender {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  /**
   * `constructor` 初始化 SMTP 连接配置。
   */
  constructor(config: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  }) {
    this.from = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  /**
   * `send` 通过 SMTP 投递邮件。
   */
  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}
```

- [ ] **Step 5: Implement EmailCodeService**

Create `backend/src/auth/email-code.service.ts`:

```ts
import {
  BadRequestException,
  Injectable,
  TooManyRequestsException,
} from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import type {
  EmailCodePurpose,
  SendEmailCodeRequest,
} from '@word-god/contracts';
import { randomInt } from 'node:crypto';
import { APP_STORE } from '../store/app-store';
import type { AppStore } from '../store/app-store';
import type { EmailVerificationCodeRecord } from '../store/store.types';
import type { EmailSender } from './email-sender';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MS = 10 * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export interface EmailCodeServiceOptions {
  now?: () => Date;
  generateCode?: () => string;
}

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

/**
 * `normalizeEmail` 将邮箱输入规整为验证码存储键。
 */
function normalizeEmail(email: unknown): string {
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
 * `normalizeEmailCode` 校验用户输入的验证码格式。
 */
function normalizeEmailCode(emailCode: unknown): string {
  if (typeof emailCode !== 'string' || !/^\d{6}$/.test(emailCode.trim())) {
    throw new BadRequestException('验证码错误或已过期');
  }

  return emailCode.trim();
}

/**
 * `EmailCodeService` 负责邮箱验证码的发送、校验和作废。
 */
@Injectable()
export class EmailCodeService {
  private readonly now: () => Date;
  private readonly generateCode: () => string;

  /**
   * `constructor` 注入存储、邮件发送器和可测试的时间/随机数依赖。
   */
  constructor(
    @Inject(APP_STORE) private readonly store: AppStore,
    @Inject(EMAIL_SENDER) private readonly sender: EmailSender,
    options: EmailCodeServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.generateCode =
      options.generateCode ??
      (() => randomInt(0, 1_000_000).toString().padStart(6, '0'));
  }

  /**
   * `sendCode` 生成验证码、保存哈希并发送邮件。
   */
  async sendCode(input: SendEmailCodeRequest): Promise<{ success: true }> {
    const email = normalizeEmail(input.email);
    const purpose = input.purpose;
    const now = this.now();
    const [latestCode] = await this.store.listEmailVerificationCodes(
      email,
      purpose,
    );

    if (
      latestCode &&
      !latestCode.consumedAt &&
      now.getTime() - new Date(latestCode.lastSentAt).getTime() <
        SEND_COOLDOWN_MS
    ) {
      throw new TooManyRequestsException('验证码发送太频繁，请稍后再试');
    }

    const emailCode = this.generateCode();
    const codeHash = await hash(emailCode, 10);
    const timestamp = now.toISOString();

    await this.store.invalidateEmailVerificationCodes(email, purpose, timestamp);
    await this.store.saveEmailVerificationCode({
      email,
      purpose,
      codeHash,
      expiresAt: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
      consumedAt: null,
      attemptCount: 0,
      lastSentAt: timestamp,
      createdAt: timestamp,
    });

    await this.sender.send({
      to: email,
      subject: '我不是词神验证码',
      text: `你的${this.getPurposeLabel(purpose)}验证码是 ${emailCode}，10 分钟内有效。`,
    });

    return { success: true };
  }

  /**
   * `consumeCode` 校验验证码并在成功后标记消费。
   */
  async consumeCode(input: {
    email: unknown;
    purpose: EmailCodePurpose;
    emailCode: unknown;
  }): Promise<string> {
    const email = normalizeEmail(input.email);
    const emailCode = normalizeEmailCode(input.emailCode);
    const [latestCode] = await this.store.listEmailVerificationCodes(
      email,
      input.purpose,
    );

    if (!latestCode || latestCode.consumedAt) {
      throw new BadRequestException('验证码错误或已过期');
    }

    if (latestCode.attemptCount >= MAX_ATTEMPTS) {
      throw new BadRequestException('验证码尝试次数过多，请重新获取');
    }

    if (new Date(latestCode.expiresAt).getTime() <= this.now().getTime()) {
      throw new BadRequestException('验证码错误或已过期');
    }

    const matched = await compare(emailCode, latestCode.codeHash);

    if (!matched) {
      await this.store.saveEmailVerificationCode({
        ...latestCode,
        attemptCount: latestCode.attemptCount + 1,
      });
      throw new BadRequestException('验证码错误或已过期');
    }

    await this.store.saveEmailVerificationCode({
      ...latestCode,
      consumedAt: this.now().toISOString(),
    });

    return email;
  }

  /**
   * `getPurposeLabel` 将验证码用途转换为邮件正文说明。
   */
  private getPurposeLabel(purpose: EmailVerificationCodeRecord['purpose']) {
    if (purpose === 'register') {
      return '注册';
    }

    if (purpose === 'reset-password') {
      return '重置密码';
    }

    return '登录';
  }
}
```

Add missing import `Inject` from `@nestjs/common` before running tests.

- [ ] **Step 6: Run tests to verify GREEN**

Run:

```powershell
corepack pnpm --filter backend test -- email-code.service.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add backend/package.json pnpm-lock.yaml backend/src/auth/email-sender.ts backend/src/auth/email-code.service.ts backend/src/auth/email-code.service.spec.ts
git commit -m "feat: add email code service"
```

## Task 4: Auth Service And Controller Flows

**Files:**
- Modify: `backend/src/auth/auth.service.ts`
- Modify: `backend/src/auth/auth.service.spec.ts`
- Modify: `backend/src/auth/auth.controller.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/test/app.e2e-spec.ts`

- [ ] **Step 1: Write failing AuthService tests**

Add tests to `backend/src/auth/auth.service.spec.ts`:

```ts
import { EmailCodeService } from './email-code.service';
import type { EmailSender } from './email-sender';

/**
 * `createEmailCodeService` 创建验证码服务和可控发送器。
 */
function createEmailCodeService(store: InMemoryAppStore): EmailCodeService {
  const sender: EmailSender = {
    async send() {
      return undefined;
    },
  };

  return new EmailCodeService(store, sender, {
    generateCode: () => '123456',
  });
}
```

Update `beforeEach`:

```ts
service = new AuthService(
  store,
  'test-secret',
  createEmailCodeService(store),
);
```

Add tests:

```ts
  it('requires a valid register email code before creating a user', async () => {
    await expect(
      service.register({
        email: 'reader@example.com',
        password: 'Passw0rd!',
        emailCode: '000000',
      }),
    ).rejects.toThrow('验证码错误或已过期');

    expect(store.findUserByEmail('reader@example.com')).toBeUndefined();
  });

  it('registers after consuming a valid register email code', async () => {
    const emailCodeService = createEmailCodeService(store);
    service = new AuthService(store, 'test-secret', emailCodeService);

    await emailCodeService.sendCode({
      email: 'reader@example.com',
      purpose: 'register',
    });

    const result = await service.register({
      email: 'reader@example.com',
      password: 'Passw0rd!',
      emailCode: '123456',
    });

    expect(result.user.email).toBe('reader@example.com');
  });

  it('logs in with a valid login email code and rememberLogin false', async () => {
    const emailCodeService = createEmailCodeService(store);
    service = new AuthService(store, 'test-secret', emailCodeService);
    await emailCodeService.sendCode({
      email: 'reader@example.com',
      purpose: 'register',
    });
    const registered = await service.register({
      email: 'reader@example.com',
      password: 'Passw0rd!',
      emailCode: '123456',
    });
    await service.logout(registered.refreshToken);
    await emailCodeService.sendCode({
      email: 'reader@example.com',
      purpose: 'login',
    });

    const result = await service.loginWithEmailCode({
      email: 'reader@example.com',
      emailCode: '123456',
      rememberLogin: false,
    });
    const [session] = store.listSessionsForUser(result.user.id);

    expectDurationNear(getSessionDurationMs(session), DAY_MS);
  });

  it('resets password with a valid reset code and allows the new password', async () => {
    const emailCodeService = createEmailCodeService(store);
    service = new AuthService(store, 'test-secret', emailCodeService);
    await emailCodeService.sendCode({
      email: 'reader@example.com',
      purpose: 'register',
    });
    await service.register({
      email: 'reader@example.com',
      password: 'Passw0rd!',
      emailCode: '123456',
    });
    await emailCodeService.sendCode({
      email: 'reader@example.com',
      purpose: 'reset-password',
    });

    await service.resetPassword({
      email: 'reader@example.com',
      emailCode: '123456',
      newPassword: 'NewPassw0rd!',
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
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
corepack pnpm --filter backend test -- auth.service.spec.ts
```

Expected: FAIL because `AuthService` constructor and new methods are not implemented.

- [ ] **Step 3: Implement AuthService methods**

Modify `backend/src/auth/auth.service.ts` imports:

```ts
  EmailCodeLoginRequest,
  ResetPasswordRequest,
```

Inject `EmailCodeService` in constructor:

```ts
constructor(
  @Inject(APP_STORE) private readonly store: AppStore,
  private readonly jwtSecret: string,
  private readonly emailCodeService: EmailCodeService,
) {
  this.jwtService = new JwtService({ secret: jwtSecret });
}
```

Update `register` before `findUserByEmail`:

```ts
const email = await this.emailCodeService.consumeCode({
  email: input?.email,
  purpose: 'register',
  emailCode: input?.emailCode,
});
const password = normalizePassword(input?.password);
```

Add:

```ts
  /**
   * `loginWithEmailCode` 校验邮箱验证码并签发新会话。
   */
  async loginWithEmailCode(
    input: EmailCodeLoginRequest,
  ): Promise<AuthSessionResult> {
    const email = await this.emailCodeService.consumeCode({
      email: input?.email,
      purpose: 'login',
      emailCode: input?.emailCode,
    });
    const savedUser = await this.store.findUserByEmail(email);

    if (!savedUser) {
      throw new UnauthorizedException('邮箱或验证码错误');
    }

    return this.createSession(
      savedUser.id,
      savedUser.email,
      input.rememberLogin === false
        ? SHORT_REFRESH_COOKIE_MAX_AGE_MS
        : REMEMBER_REFRESH_COOKIE_MAX_AGE_MS,
    );
  }

  /**
   * `resetPassword` 校验重置验证码、更新密码并签发新会话。
   */
  async resetPassword(input: ResetPasswordRequest): Promise<AuthSessionResult> {
    const email = await this.emailCodeService.consumeCode({
      email: input?.email,
      purpose: 'reset-password',
      emailCode: input?.emailCode,
    });
    const savedUser = await this.store.findUserByEmail(email);

    if (!savedUser) {
      throw new UnauthorizedException('邮箱或验证码错误');
    }

    const passwordHash = await hash(normalizePassword(input?.newPassword), 10);
    const updatedUser = await this.store.saveUser({
      ...savedUser,
      passwordHash,
      updatedAt: new Date().toISOString(),
    });

    return this.createSession(
      updatedUser.id,
      updatedUser.email,
      input.rememberLogin === false
        ? SHORT_REFRESH_COOKIE_MAX_AGE_MS
        : REMEMBER_REFRESH_COOKIE_MAX_AGE_MS,
    );
  }
```

- [ ] **Step 4: Implement controller endpoints**

In `backend/src/auth/auth.controller.ts`, import new contract types:

```ts
  EmailCodeLoginRequest,
  ResetPasswordRequest,
  SendEmailCodeRequest,
```

Add endpoints:

```ts
  /**
   * `sendEmailCode` 发送指定用途的邮箱验证码。
   */
  @Post('email-codes')
  async sendEmailCode(
    @Body() input: SendEmailCodeRequest,
  ): Promise<{ success: true }> {
    return this.authService.sendEmailCode(input);
  }

  /**
   * `loginWithEmailCode` 使用邮箱验证码登录。
   */
  @Post('login/email-code')
  async loginWithEmailCode(
    @Body() input: EmailCodeLoginRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: { id: string; email: string } }> {
    const session = await this.authService.loginWithEmailCode(input);

    this.authService.writeCookies(
      response,
      session.accessToken,
      session.refreshToken,
      session.refreshTokenMaxAgeMs,
    );
    return { user: session.user };
  }

  /**
   * `resetPassword` 使用邮箱验证码重置密码并登录。
   */
  @Post('password/reset')
  async resetPassword(
    @Body() input: ResetPasswordRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: { id: string; email: string } }> {
    const session = await this.authService.resetPassword(input);

    this.authService.writeCookies(
      response,
      session.accessToken,
      session.refreshToken,
      session.refreshTokenMaxAgeMs,
    );
    return { user: session.user };
  }
```

Add to `AuthService`:

```ts
  /**
   * `sendEmailCode` 为指定认证场景发送邮箱验证码。
   */
  async sendEmailCode(input: SendEmailCodeRequest): Promise<{ success: true }> {
    return this.emailCodeService.sendCode(input);
  }
```

- [ ] **Step 5: Wire app module**

In `backend/src/app.module.ts`, add:

```ts
import {
  ConsoleEmailSender,
  SmtpEmailSender,
  type EmailSender,
} from './auth/email-sender';
import { EMAIL_SENDER, EmailCodeService } from './auth/email-code.service';
```

Add factories:

```ts
/**
 * `createEmailSender` 根据 SMTP 环境变量创建邮件发送器。
 */
function createEmailSender(): EmailSender {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (host && user && pass && from) {
    return new SmtpEmailSender({
      host,
      port: Number(process.env.SMTP_PORT ?? '587'),
      secure: process.env.SMTP_SECURE === 'true',
      user,
      pass,
      from,
    });
  }

  return new ConsoleEmailSender();
}

/**
 * `createEmailCodeService` 使用应用存储和邮件发送器创建验证码服务。
 */
function createEmailCodeService(
  store: AppStore,
  sender: EmailSender,
): EmailCodeService {
  return new EmailCodeService(store, sender);
}
```

Update `createAuthService`:

```ts
function createAuthService(
  store: AppStore,
  emailCodeService: EmailCodeService,
): AuthService {
  return new AuthService(
    store,
    process.env.JWT_SECRET ?? 'word-god-dev-secret',
    emailCodeService,
  );
}
```

Register providers:

```ts
    {
      provide: EMAIL_SENDER,
      useFactory: createEmailSender,
    },
    {
      provide: EmailCodeService,
      useFactory: createEmailCodeService,
      inject: [APP_STORE, EMAIL_SENDER],
    },
    {
      provide: AuthService,
      useFactory: createAuthService,
      inject: [APP_STORE, EmailCodeService],
    },
```

- [ ] **Step 6: Add e2e test using console sender visibility**

Because console sender does not expose the code, use a deterministic testing module override if e2e already supports overrides. If not, add a test-only env `EMAIL_CODE_DEV_CODE=123456` consumed by `EmailCodeService` only when `NODE_ENV === 'test'`.

Add e2e assertions:

```ts
  it('registers with an email code, logs in with an email code, and resets password', async () => {
    const agent = request.agent(getHttpServer());

    await agent
      .post('/auth/email-codes')
      .send({ email: 'reader@example.com', purpose: 'register' })
      .expect(201);
    await agent
      .post('/auth/register')
      .send({
        email: 'reader@example.com',
        password: 'Passw0rd!',
        emailCode: '123456',
      })
      .expect(201);
    await agent.post('/auth/logout').expect(201);

    await agent
      .post('/auth/email-codes')
      .send({ email: 'reader@example.com', purpose: 'login' })
      .expect(201);
    await agent
      .post('/auth/login/email-code')
      .send({
        email: 'reader@example.com',
        emailCode: '123456',
        rememberLogin: false,
      })
      .expect(201);
    await agent.post('/auth/logout').expect(201);

    await agent
      .post('/auth/email-codes')
      .send({ email: 'reader@example.com', purpose: 'reset-password' })
      .expect(201);
    await agent
      .post('/auth/password/reset')
      .send({
        email: 'reader@example.com',
        emailCode: '123456',
        newPassword: 'NewPassw0rd!',
      })
      .expect(201);
    await agent.post('/auth/logout').expect(201);
    await agent
      .post('/auth/login')
      .send({ email: 'reader@example.com', password: 'NewPassw0rd!' })
      .expect(201);
  });
```

- [ ] **Step 7: Run backend tests**

Run:

```powershell
corepack pnpm --filter backend test -- auth.service.spec.ts email-code.service.spec.ts
corepack pnpm --filter backend test:e2e
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add backend/src/auth backend/src/app.module.ts backend/test/app.e2e-spec.ts
git commit -m "feat: add email code auth endpoints"
```

## Task 5: Frontend API And Auth Form Modes

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/components/auth-form-card.tsx`
- Modify: `frontend/src/pages/auth-page.tsx`
- Modify: `frontend/src/pages/reading-page.tsx`
- Modify: `frontend/src/app.behavior.spec.tsx`

- [ ] **Step 1: Write failing frontend behavior tests**

Add tests to `frontend/src/app.behavior.spec.tsx`:

```tsx
  it('registers with an email code from the standalone auth page', async () => {
    mockGuestSession();
    vi.mocked(fetch)
      .mockResolvedValueOnce(createJsonResponse(201, { success: true }))
      .mockResolvedValueOnce(
        createJsonResponse(201, {
          user: { id: 'user-1', email: 'reader@example.com' },
        }),
      );

    renderApp(['/auth?redirect=/auth']);

    await userEvent.click(await screen.findByRole('button', { name: '去注册' }));
    await userEvent.type(screen.getByLabelText('邮箱'), 'reader@example.com');
    await userEvent.click(screen.getByRole('button', { name: '发送验证码' }));
    await userEvent.type(screen.getByLabelText('验证码'), '123456');
    await userEvent.type(screen.getByLabelText('密码'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: '确定' }));

    expect(
      await screen.findByRole('button', { name: '退出登录' }),
    ).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls[1][0]).toEqual(
      expect.stringContaining('/auth/register'),
    );
    expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]?.body as string)).toEqual({
      email: 'reader@example.com',
      password: 'Passw0rd!',
      emailCode: '123456',
    });
  });

  it('logs in with an email code and remember login false', async () => {
    mockGuestSession();
    vi.mocked(fetch)
      .mockResolvedValueOnce(createJsonResponse(201, { success: true }))
      .mockResolvedValueOnce(
        createJsonResponse(201, {
          user: { id: 'user-1', email: 'reader@example.com' },
        }),
      );

    renderApp(['/auth?redirect=/auth']);

    await userEvent.click(await screen.findByRole('button', { name: '验证码登录' }));
    await userEvent.type(screen.getByLabelText('邮箱'), 'reader@example.com');
    await userEvent.click(screen.getByRole('button', { name: '发送验证码' }));
    await userEvent.type(screen.getByLabelText('验证码'), '123456');
    await userEvent.click(
      screen.getByRole('checkbox', { name: '30天内记住登录' }),
    );
    await userEvent.click(screen.getByRole('button', { name: '确定' }));

    expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]?.body as string)).toEqual({
      email: 'reader@example.com',
      emailCode: '123456',
      rememberLogin: false,
    });
  });

  it('resets password with an email code and signs in', async () => {
    mockGuestSession();
    vi.mocked(fetch)
      .mockResolvedValueOnce(createJsonResponse(201, { success: true }))
      .mockResolvedValueOnce(
        createJsonResponse(201, {
          user: { id: 'user-1', email: 'reader@example.com' },
        }),
      );

    renderApp(['/auth?redirect=/auth']);

    await userEvent.click(await screen.findByRole('button', { name: '忘记密码' }));
    await userEvent.type(screen.getByLabelText('邮箱'), 'reader@example.com');
    await userEvent.click(screen.getByRole('button', { name: '发送验证码' }));
    await userEvent.type(screen.getByLabelText('验证码'), '123456');
    await userEvent.type(screen.getByLabelText('新密码'), 'NewPassw0rd!');
    await userEvent.click(screen.getByRole('button', { name: '确定' }));

    expect(
      await screen.findByRole('button', { name: '退出登录' }),
    ).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls[1][0]).toEqual(
      expect.stringContaining('/auth/password/reset'),
    );
  });
```

- [ ] **Step 2: Run frontend tests to verify RED**

Run:

```powershell
corepack pnpm --filter frontend test -- app.behavior.spec.tsx
```

Expected: FAIL because buttons and client methods do not exist.

- [ ] **Step 3: Add frontend API methods**

Modify `frontend/src/api/client.ts` imports and functions:

```ts
  EmailCodeLoginRequest,
  ResetPasswordRequest,
  SendEmailCodeRequest,
  SendEmailCodeResponse,
```

Add:

```ts
/**
 * `sendEmailCode` 发送指定认证用途的邮箱验证码。
 */
export function sendEmailCode(
  payload: SendEmailCodeRequest,
): Promise<SendEmailCodeResponse> {
  return requestJson<SendEmailCodeResponse>('/auth/email-codes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * `loginWithEmailCode` 使用邮箱验证码登录。
 */
export function loginWithEmailCode(
  payload: EmailCodeLoginRequest,
): Promise<AuthResponse> {
  return requestJson<AuthResponse>('/auth/login/email-code', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * `resetPassword` 使用邮箱验证码重置密码并登录。
 */
export function resetPassword(
  payload: ResetPasswordRequest,
): Promise<AuthResponse> {
  return requestJson<AuthResponse>('/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 4: Expand AuthFormCard values and modes**

In `frontend/src/components/auth-form-card.tsx`:

```ts
import type { EmailCodePurpose } from '@word-god/contracts';

export type AuthFormMode = 'password-login' | 'code-login' | 'register' | 'reset-password';

export interface AuthFormValues {
  email: string;
  password: string;
  emailCode: string;
  rememberLogin: boolean;
}

interface AuthFormCardProps {
  title: string;
  submitLabel: string;
  hint: string;
  initialMode?: AuthFormMode;
  onSendEmailCode: (email: string, purpose: EmailCodePurpose) => Promise<void>;
  onSubmit: (values: AuthFormValues, mode: AuthFormMode) => Promise<void>;
}
```

Add state:

```ts
const [mode, setMode] = useState<AuthFormMode>(initialMode);
const [emailCode, setEmailCode] = useState('');
const [countdown, setCountdown] = useState(0);
const [sendingCode, setSendingCode] = useState(false);
```

Add helper:

```ts
/**
 * `getCodePurpose` 将当前表单模式映射为验证码用途。
 */
function getCodePurpose(currentMode: AuthFormMode): EmailCodePurpose | null {
  if (currentMode === 'register') {
    return 'register';
  }

  if (currentMode === 'code-login') {
    return 'login';
  }

  if (currentMode === 'reset-password') {
    return 'reset-password';
  }

  return null;
}
```

Add send handler:

```ts
/**
 * `handleSendEmailCode` 发送当前模式所需的邮箱验证码。
 */
async function handleSendEmailCode() {
  const purpose = getCodePurpose(mode);

  if (!purpose) {
    return;
  }

  setSendingCode(true);
  setError(null);

  try {
    await onSendEmailCode(email, purpose);
    setCountdown(60);
  } catch (sendError) {
    setError(sendError instanceof Error ? sendError.message : '验证码发送失败');
  } finally {
    setSendingCode(false);
  }
}
```

Use `useEffect` for countdown:

```ts
useEffect(() => {
  if (countdown <= 0) {
    return undefined;
  }

  const timer = window.setTimeout(() => {
    setCountdown((currentCountdown) => Math.max(0, currentCountdown - 1));
  }, 1000);

  return () => window.clearTimeout(timer);
}, [countdown]);
```

Render mode switch buttons with visible text: `密码登录`、`验证码登录`、`去注册`、`忘记密码`、`去登录`. Render `验证码` input for all modes except `password-login`; render label `新密码` for reset mode and `密码` otherwise. Keep function comments for every helper.

- [ ] **Step 5: Update AuthPage submit wiring**

In `frontend/src/pages/auth-page.tsx`, import:

```ts
import { login, loginWithEmailCode, register, resetPassword, sendEmailCode } from '../api/client';
import type { AuthFormMode, AuthFormValues } from '../components/auth-form-card';
import type { EmailCodePurpose } from '@word-god/contracts';
```

Add:

```ts
/**
 * `handleSendEmailCode` 请求后端发送当前认证用途的验证码。
 */
async function handleSendEmailCode(email: string, purpose: EmailCodePurpose) {
  await sendEmailCode({ email, purpose });
}
```

Update submit:

```ts
async function handleSubmit(values: AuthFormValues, mode: AuthFormMode) {
  const authResponse =
    mode === 'register'
      ? await register({
          email: values.email,
          password: values.password,
          emailCode: values.emailCode,
        })
      : mode === 'code-login'
        ? await loginWithEmailCode({
            email: values.email,
            emailCode: values.emailCode,
            rememberLogin: values.rememberLogin,
          })
        : mode === 'reset-password'
          ? await resetPassword({
              email: values.email,
              emailCode: values.emailCode,
              newPassword: values.password,
              rememberLogin: values.rememberLogin,
            })
          : await login({
              email: values.email,
              password: values.password,
              rememberLogin: values.rememberLogin,
            });

  onAuthenticated?.(authResponse.user);
  navigate(redirectTo, { replace: true });
}
```

Pass `onSendEmailCode={handleSendEmailCode}` to `AuthFormCard`.

- [ ] **Step 6: Update ReadingPage dialog wiring**

Apply the same imports, `handleSendEmailCode`, and submit branching in `frontend/src/pages/reading-page.tsx`. For reading dialog title, keep `登录后继续`; after any auth mode succeeds, continue the current passage exactly as today.

- [ ] **Step 7: Run frontend tests**

Run:

```powershell
corepack pnpm --filter frontend test -- app.behavior.spec.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add frontend/src/api/client.ts frontend/src/components/auth-form-card.tsx frontend/src/pages/auth-page.tsx frontend/src/pages/reading-page.tsx frontend/src/app.behavior.spec.tsx
git commit -m "feat: add email code auth UI"
```

## Task 6: Documentation And Product Scope Update

**Files:**
- Modify: `README.md`
- Modify: `backend/README.md`
- Modify: `frontend/README.md`
- Modify: `docs/business/PRD.md`
- Modify: `docs/technical/ARCHITECTURE.md`
- Modify: `docs/technical/DATABASE.md`
- Modify: `docs/technical/CODE_NOTES.md`
- Modify: `docs/business/ITERATION_LOG.md`

- [ ] **Step 1: Update PRD**

In `docs/business/PRD.md`:

- Remove `邮件验证码与找回密码。` from “不做”.
- Add to “必做”:

```md
- 邮箱验证码能力：注册邮箱验证、邮箱验证码登录、找回并重置密码。
```

- Add acceptance criteria:

```md
- 注册前需要发送并填写有效邮箱验证码；验证码错误、过期或尝试次数过多时不得创建账号。
- 用户可选择邮箱验证码登录；验证码登录成功后沿用现有 30 天记住登录或 24 小时短会话规则。
- 用户可通过“忘记密码”发送重置密码验证码，验证成功后设置新密码并进入已登录状态。
- 验证码 10 分钟有效，同邮箱同用途 60 秒内不可重复发送，成功使用后立即作废。
```

- [ ] **Step 2: Update architecture docs**

In `docs/technical/ARCHITECTURE.md`, update auth module line:

```md
- `auth`：注册、密码登录、邮箱验证码登录、找回并重置密码、登出、当前会话识别和刷新会话恢复；验证码由统一服务管理生成、哈希存储、发送频控、过期、尝试次数和消费状态。
```

Add current implementation note for `EmailCodeService`, `EmailSender`, SMTP env vars, console sender fallback, and frontend auth modes.

- [ ] **Step 3: Update database docs**

In `docs/technical/DATABASE.md`, add `EmailVerificationCode` core table section with fields and indexes exactly matching Task 1.

- [ ] **Step 4: Update READMEs**

In `README.md`, `backend/README.md`, and `frontend/README.md`, document:

```md
邮箱验证码支持注册验证、验证码登录和重置密码。生产环境配置 `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`、`SMTP_FROM`、`SMTP_SECURE` 后通过 SMTP 发送；未配置时本地开发使用 console sender 输出验证码。
```

- [ ] **Step 5: Update code notes and iteration log**

Add bullets describing tests and the scope change.

- [ ] **Step 6: Commit**

```powershell
git add README.md backend/README.md frontend/README.md docs/business/PRD.md docs/technical/ARCHITECTURE.md docs/technical/DATABASE.md docs/technical/CODE_NOTES.md docs/business/ITERATION_LOG.md
git commit -m "docs: document email code auth"
```

## Task 7: Final Verification

**Files:**
- No expected code edits unless verification exposes failures.

- [ ] **Step 1: Run backend unit tests**

Run:

```powershell
corepack pnpm --filter backend test
```

Expected: all backend test suites pass.

- [ ] **Step 2: Run backend e2e tests**

Run:

```powershell
corepack pnpm --filter backend test:e2e
```

Expected: all backend e2e tests pass.

- [ ] **Step 3: Run frontend unit tests**

Run:

```powershell
corepack pnpm --filter frontend test
```

Expected: all frontend behavior tests pass.

- [ ] **Step 4: Run lint**

Run:

```powershell
corepack pnpm --filter backend exec eslint "{src,apps,libs,test}/**/*.ts"
corepack pnpm --filter frontend exec eslint .
```

Expected: 0 errors and 0 warnings.

- [ ] **Step 5: Run diff whitespace check**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors. LF/CRLF warnings may appear because the current worktree already has them; do not modify unrelated files to chase those warnings.

- [ ] **Step 6: Commit verification fixes only if needed**

If verification required code fixes, commit them:

```powershell
git add <fixed-files>
git commit -m "fix: stabilize email code auth verification"
```

## Self-Review

- Spec coverage: registration verification is covered in Tasks 3-5; email-code login is covered in Tasks 3-5; reset password is covered in Tasks 3-5; SMTP/console sender is covered in Tasks 3 and 6; persistence is covered in Tasks 1-2; docs are covered in Task 6.
- Placeholder scan: no placeholder markers or unspecified implementation steps remain.
- Type consistency: `EmailCodePurpose`, `SendEmailCodeRequest`, `EmailCodeLoginRequest`, `ResetPasswordRequest`, and `EmailVerificationCodeRecord` are introduced before use in later tasks.
