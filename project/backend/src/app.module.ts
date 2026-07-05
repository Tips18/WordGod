import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import {
  ConsoleEmailSender,
  EMAIL_SENDER,
  EmailSender,
  SmtpEmailSender,
} from './auth/email-sender';
import { EmailCodeService } from './auth/email-code.service';
import { ReadingController } from './reading/reading.controller';
import { EcdictDictionaryService } from './reading/ecdict-dictionary.service';
import { ReadingService } from './reading/reading.service';
import { PassageTranslator } from './reading/passage-translator';
import { PrismaService } from './prisma/prisma.service';
import { APP_STORE, AppStore } from './store/app-store';
import { InMemoryAppStore } from './store/in-memory-app.store';
import { PrismaAppStore } from './store/prisma-app.store';
import { seedPassages } from './store/seed-passages';
import { VocabularyController } from './vocabulary/vocabulary.controller';
import { VocabularyService } from './vocabulary/vocabulary.service';

/**
 * `resolveDefaultMemoryStorePath` 返回本地内存模式运行态数据文件路径。
 */
function resolveDefaultMemoryStorePath(): string {
  const cwd = process.cwd();
  const workspaceRoot =
    cwd.split(/[\\/]/).at(-1) === 'backend' ? resolve(cwd, '..') : cwd;

  return resolve(workspaceRoot, '.dev-data', 'memory-store.json');
}

/**
 * `createAppStore` 根据环境变量选择 PostgreSQL 或内存应用存储。
 */
function createAppStore(prismaService: PrismaService): AppStore {
  if (process.env.WORD_GOD_STORE === 'prisma') {
    return new PrismaAppStore(prismaService);
  }

  return new InMemoryAppStore(
    {
      passages: seedPassages,
    },
    {
      persistencePath:
        process.env.WORD_GOD_MEMORY_STORE_PATH ??
        resolveDefaultMemoryStorePath(),
    },
  );
}

/**
 * `createAuthService` 使用配置好的应用存储创建认证服务。
 */
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

/**
 * `createEmailSender` 根据 SMTP 环境变量选择真实邮件发送或本地日志发送。
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
 * `AppModule` 组装 V1 所需的控制器、服务和默认数据源。
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
  ],
  controllers: [
    AppController,
    AuthController,
    ReadingController,
    VocabularyController,
  ],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_STORE,
      useFactory: createAppStore,
      inject: [PrismaService],
    },
    {
      provide: EMAIL_SENDER,
      useFactory: createEmailSender,
    },
    EmailCodeService,
    {
      provide: AuthService,
      useFactory: createAuthService,
      inject: [APP_STORE, EmailCodeService],
    },
    VocabularyService,
    EcdictDictionaryService,
    PassageTranslator,
    ReadingService,
  ],
})
export class AppModule {}
