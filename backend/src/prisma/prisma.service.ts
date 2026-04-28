import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * `PrismaService` 封装 Prisma Client 生命周期并按需建立数据库连接。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  /**
   * `onModuleDestroy` 在模块销毁时关闭数据库连接。
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
