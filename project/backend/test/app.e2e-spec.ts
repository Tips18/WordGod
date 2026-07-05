import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  AuthResponse,
  ReadingPassageResponse,
  VocabularyDetailResponse,
  VocabularyListResponse,
} from '@word-god/contracts';
import type { Response as SupertestResponse } from 'supertest';
import request from 'supertest';
import { configureApiApp } from '../src/app-bootstrap';
import { AppModule } from '../src/app.module';

const REMEMBER_REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const SHORT_REFRESH_MAX_AGE_SECONDS = 24 * 60 * 60;

describe('AppController (e2e)', () => {
  let app: INestApplication;

  /**
   * `createTestApp` 按指定存储模式创建 e2e 测试应用。
   */
  async function createTestApp(
    storeMode: 'memory' | 'unset' = 'memory',
  ): Promise<INestApplication> {
    if (storeMode === 'unset') {
      delete process.env.WORD_GOD_STORE;
    } else {
      process.env.WORD_GOD_STORE = storeMode;
    }

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const testApp = moduleFixture.createNestApplication();

    configureApiApp(testApp);
    await testApp.init();

    return testApp;
  }

  /**
   * `getHttpServer` 将 Nest 测试服务器规整为 supertest 可识别类型。
   */
  function getHttpServer(): Server {
    return app.getHttpServer() as Server;
  }

  /**
   * `getSetCookieHeaders` 规整 supertest 响应中的 Set-Cookie 头集合。
   */
  function getSetCookieHeaders(response: SupertestResponse): string[] {
    const header = response.headers['set-cookie'];

    if (Array.isArray(header)) {
      return header;
    }

    return typeof header === 'string' ? [header] : [];
  }

  /**
   * `findSetCookieHeader` 按 cookie 名称查找单个 Set-Cookie 头。
   */
  function findSetCookieHeader(
    response: SupertestResponse,
    cookieName: string,
  ): string {
    const cookieHeader = getSetCookieHeaders(response).find((header) =>
      header.startsWith(`${cookieName}=`),
    );

    expect(cookieHeader).toBeDefined();
    return cookieHeader as string;
  }

  /**
   * `toRequestCookiePair` 从 Set-Cookie 头中提取后续请求可携带的键值对。
   */
  function toRequestCookiePair(cookieHeader: string): string {
    return cookieHeader.split(';')[0];
  }

  beforeEach(async () => {
    app = await createTestApp('memory');
  });

  afterEach(async () => {
    await app.close();
    delete process.env.WORD_GOD_STORE;
  });

  it('returns a readable passage for guests', async () => {
    const response = await request(getHttpServer())
      .get('/reading/passages/random')
      .expect(200);
    const responseBody = response.body as ReadingPassageResponse;

    expect(responseBody.passage.id).toBeDefined();
    expect(responseBody.tokens.length).toBeGreaterThan(0);
    expect(responseBody.requiresAuthToComplete).toBe(true);
    expect(responseBody.passage.title).not.toBe('Memory and Method');
    expect(responseBody.passage.sourceUrl).not.toContain('example.com');
    expect(responseBody.passage.id).toMatch(/^kaoyan-\d{4}-english-/);
    expect(
      responseBody.passage.content.split(/\s+/).filter(Boolean).length,
    ).toBeGreaterThan(100);
    expect(responseBody.tokens.length).toBeGreaterThan(50);
  });

  it('returns a readable passage when store mode is not configured', async () => {
    await app.close();
    app = await createTestApp('unset');

    const response = await request(getHttpServer())
      .get('/reading/passages/random')
      .expect(200);
    const responseBody = response.body as ReadingPassageResponse;

    expect(responseBody.passage.id).toMatch(/^kaoyan-\d{4}-english-/);
    expect(responseBody.tokens.length).toBeGreaterThan(0);
  });

  it('allows the frontend dev origin to request passages with credentials', async () => {
    const response = await request(getHttpServer())
      .options('/reading/passages/random')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  /**
   * `allowsLocalhostFallbackVitePorts` 验证 Vite 自动换端口后本地首页仍可跨域请求 API。
   */
  it('allows localhost fallback Vite ports to request passages with credentials', async () => {
    const response = await request(getHttpServer())
      .options('/reading/passages/random')
      .set('Origin', 'http://localhost:5174')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5174',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('registers, completes a passage, and returns vocabulary entries', async () => {
    const agent = request.agent(getHttpServer());
    const registerResponse = await agent.post('/auth/register').send({
      email: 'reader@example.com',
      password: 'Passw0rd!',
    });
    const passageResponse = await agent
      .get('/reading/passages/random')
      .expect(200);
    const registerBody = registerResponse.body as AuthResponse;
    const passageBody = passageResponse.body as ReadingPassageResponse;
    const selectedTokenIds = passageBody.tokens
      .slice(0, 2)
      .map((token: { id: string }) => token.id);

    expect(registerBody.user.email).toBe('reader@example.com');

    await agent
      .put(`/reading/attempts/${passageBody.passage.id}`)
      .send({ selectedTokenIds })
      .expect(200);

    await agent
      .post(`/reading/attempts/${passageBody.passage.id}/complete`)
      .expect(201);

    const vocabularyResponse = await agent.get('/vocabulary').expect(200);
    const vocabularyBody = vocabularyResponse.body as VocabularyListResponse;

    expect(vocabularyBody.items.length).toBeGreaterThan(0);
    expect(vocabularyBody.items[0].markCount).toBeGreaterThan(0);
  });

  it('allows a registered account to log in directly with normalized email', async () => {
    const agent = request.agent(getHttpServer());

    await agent.post('/auth/register').send({
      email: ' Reader@Example.COM ',
      password: 'Passw0rd!',
    });
    await agent.post('/auth/logout').expect(201);

    const loginResponse = await agent
      .post('/auth/login')
      .send({
        email: 'reader@example.com',
        password: 'Passw0rd!',
      })
      .expect(201);
    const loginBody = loginResponse.body as AuthResponse;

    expect(loginBody.user.email).toBe('reader@example.com');

    await agent.get('/vocabulary').expect(200);
  });

  it('sets a 30 day refresh cookie when login omits rememberLogin', async () => {
    const agent = request.agent(getHttpServer());

    await agent.post('/auth/register').send({
      email: 'reader@example.com',
      password: 'Passw0rd!',
    });
    await agent.post('/auth/logout').expect(201);

    const loginResponse = await agent
      .post('/auth/login')
      .send({
        email: 'reader@example.com',
        password: 'Passw0rd!',
      })
      .expect(201);
    const refreshCookie = findSetCookieHeader(
      loginResponse,
      'word_god_refresh_token',
    );

    expect(refreshCookie).toContain(
      `Max-Age=${REMEMBER_REFRESH_MAX_AGE_SECONDS}`,
    );
  });

  it('sets a 24 hour refresh cookie when rememberLogin is false', async () => {
    const agent = request.agent(getHttpServer());

    await agent.post('/auth/register').send({
      email: 'reader@example.com',
      password: 'Passw0rd!',
    });
    await agent.post('/auth/logout').expect(201);

    const loginResponse = await agent
      .post('/auth/login')
      .send({
        email: 'reader@example.com',
        password: 'Passw0rd!',
        rememberLogin: false,
      })
      .expect(201);
    const refreshCookie = findSetCookieHeader(
      loginResponse,
      'word_god_refresh_token',
    );

    expect(refreshCookie).toContain(`Max-Age=${SHORT_REFRESH_MAX_AGE_SECONDS}`);
  });

  it('restores /auth/me from a valid refresh cookie and rewrites access cookie', async () => {
    const registerResponse = await request(getHttpServer())
      .post('/auth/register')
      .send({
        email: 'reader@example.com',
        password: 'Passw0rd!',
      })
      .expect(201);
    const registerBody = registerResponse.body as AuthResponse;
    const refreshCookie = toRequestCookiePair(
      findSetCookieHeader(registerResponse, 'word_god_refresh_token'),
    );

    const meResponse = await request(getHttpServer())
      .get('/auth/me')
      .set('Cookie', refreshCookie)
      .expect(200);

    expect(meResponse.body).toEqual({
      user: {
        id: registerBody.user.id,
        email: 'reader@example.com',
      },
    });
    expect(findSetCookieHeader(meResponse, 'word_god_access_token')).toContain(
      'Max-Age=900',
    );
  });

  it('returns vocabulary detail for a completed lemma', async () => {
    const agent = request.agent(getHttpServer());

    await agent.post('/auth/register').send({
      email: 'reader@example.com',
      password: 'Passw0rd!',
    });

    const passageResponse = await agent
      .get('/reading/passages/random')
      .expect(200);
    const passageBody = passageResponse.body as ReadingPassageResponse;
    const selectedToken = passageBody.tokens[0];

    await agent.put(`/reading/attempts/${passageBody.passage.id}`).send({
      selectedTokenIds: [selectedToken.id],
    });
    await agent
      .post(`/reading/attempts/${passageBody.passage.id}/complete`)
      .expect(201);

    const detailResponse = await agent
      .get(`/vocabulary/${selectedToken.lemma}`)
      .expect(200);
    const detailBody = detailResponse.body as VocabularyDetailResponse;

    expect(detailBody.item.lemma).toBe(selectedToken.lemma);
    expect(detailBody.item.contexts).toHaveLength(1);
  });
});
