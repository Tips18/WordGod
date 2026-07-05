import { NestFactory } from '@nestjs/core';
import { configureApiApp } from './app-bootstrap';
import { AppModule } from './app.module';

/**
 * `bootstrap` 启动 Nest API 服务并挂载全局中间件。
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApiApp(app);

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
