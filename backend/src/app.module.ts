import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { ReadingController } from './reading/reading.controller';
import { ReadingService } from './reading/reading.service';
import { PrismaService } from './prisma/prisma.service';
import { APP_STORE, AppStore } from './store/app-store';
import { InMemoryAppStore } from './store/in-memory-app.store';
import { PrismaAppStore } from './store/prisma-app.store';
import { seedPassages } from './store/seed-passages';
import { VocabularyController } from './vocabulary/vocabulary.controller';
import { VocabularyService } from './vocabulary/vocabulary.service';

/**
 * `createAppStore` 根据环境变量选择 PostgreSQL 或内存应用存储。
 */
function createAppStore(prismaService: PrismaService): AppStore {
  if (process.env.WORD_GOD_STORE === 'memory') {
    return new InMemoryAppStore({
      passages: seedPassages,
    });
  }

  return new PrismaAppStore(prismaService);
}

/**
 * `createAuthService` 使用配置好的应用存储创建认证服务。
 */
function createAuthService(store: AppStore): AuthService {
  return new AuthService(
    store,
    process.env.JWT_SECRET ?? 'word-god-dev-secret',
  );
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
      provide: AuthService,
      useFactory: createAuthService,
      inject: [APP_STORE],
    },
    VocabularyService,
    ReadingService,
  ],
})
export class AppModule {}
