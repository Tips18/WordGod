import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * `PrismaService` 封装 Prisma Client 生命周期，供未来切换真实 PostgreSQL 时复用。
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * `onModuleInit` 在模块启动时建立数据库连接。
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /**
   * `onModuleDestroy` 在模块销毁时关闭数据库连接。
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
