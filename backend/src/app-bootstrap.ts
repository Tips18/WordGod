import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

const DEFAULT_ALLOWED_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

/**
 * `getAllowedCorsOrigins` 汇总默认前端开发源与环境变量里的额外源。
 */
function getAllowedCorsOrigins(): string[] {
  const configuredOrigins =
    process.env.CORS_ALLOWED_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  return [...new Set([...DEFAULT_ALLOWED_CORS_ORIGINS, ...configuredOrigins])];
}

/**
 * `validateCorsOrigin` 只允许本地前端和显式配置源携带 Cookie 访问 API。
 */
function validateCorsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
): void {
  if (!origin || getAllowedCorsOrigins().includes(origin)) {
    callback(null, true);
    return;
  }

  callback(null, false);
}

/**
 * `configureApiApp` 挂载 API 运行所需的 CORS、Cookie 和校验中间件。
 */
export function configureApiApp(app: INestApplication): void {
  app.enableCors({
    origin: validateCorsOrigin,
    credentials: true,
  });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
}
