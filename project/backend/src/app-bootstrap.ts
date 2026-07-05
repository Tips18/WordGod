import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

const LOCAL_DEVELOPMENT_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
]);

/**
 * `getConfiguredCorsOrigins` 汇总环境变量里显式放行的跨域访问源。
 */
function getConfiguredCorsOrigins(): string[] {
  return (
    process.env.CORS_ALLOWED_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  );
}

/**
 * `isLocalDevelopmentOrigin` 判断请求源是否为本机前端开发服务。
 */
function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const parsedOrigin = new URL(origin);

    return (
      ['http:', 'https:'].includes(parsedOrigin.protocol) &&
      LOCAL_DEVELOPMENT_HOSTS.has(parsedOrigin.hostname)
    );
  } catch {
    return false;
  }
}

/**
 * `validateCorsOrigin` 只允许本地前端和显式配置源携带 Cookie 访问 API。
 */
function validateCorsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
): void {
  if (
    !origin ||
    isLocalDevelopmentOrigin(origin) ||
    getConfiguredCorsOrigins().includes(origin)
  ) {
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
