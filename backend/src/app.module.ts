import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { ReadingController } from './reading/reading.controller';
import { ReadingService } from './reading/reading.service';
import { InMemoryAppStore } from './store/in-memory-app.store';
import { seedPassages } from './store/seed-passages';
import { VocabularyController } from './vocabulary/vocabulary.controller';
import { VocabularyService } from './vocabulary/vocabulary.service';

/**
 * `AppModule` 组装 V1 所需的控制器、服务和默认数据源。
 */
@Module({
  imports: [],
  controllers: [
    AppController,
    AuthController,
    ReadingController,
    VocabularyController,
  ],
  providers: [
    AppService,
    {
      provide: InMemoryAppStore,
      useFactory: () =>
        new InMemoryAppStore({
          passages: seedPassages,
        }),
    },
    {
      provide: AuthService,
      useFactory: (store: InMemoryAppStore) =>
        new AuthService(store, 'word-god-dev-secret'),
      inject: [InMemoryAppStore],
    },
    VocabularyService,
    ReadingService,
  ],
})
export class AppModule {}
