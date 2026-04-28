import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  AuthResponse,
  ReadingPassageResponse,
  VocabularyDetailResponse,
  VocabularyListResponse,
} from '@word-god/contracts';
import request from 'supertest';
import { configureApiApp } from '../src/app-bootstrap';
import { AppModule } from '../src/app.module';

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

  beforeEach(async () => {
    app = await createTestApp('memory');
  });

  afterEach(async () => {
    await app.close();
    delete process.env.WORD_GOD_STORE;
  });

  it('returns a readable passage for guests', async () => {
    const response = await request(app.getHttpServer())
      .get('/reading/passages/random')
      .expect(200);
    const responseBody = response.body as ReadingPassageResponse;

    expect(responseBody.passage.id).toBeDefined();
    expect(responseBody.tokens.length).toBeGreaterThan(0);
    expect(responseBody.requiresAuthToComplete).toBe(true);
    expect(responseBody.passage.title).not.toBe('Memory and Method');
    expect(responseBody.passage.sourceUrl).not.toContain('example.com');
    expect(responseBody.passage.id).toMatch(/^kaoyan-\d{4}-english-/);
  });

  it('returns a readable passage when store mode is not configured', async () => {
    await app.close();
    app = await createTestApp('unset');

    const response = await request(app.getHttpServer())
      .get('/reading/passages/random')
      .expect(200);
    const responseBody = response.body as ReadingPassageResponse;

    expect(responseBody.passage.id).toMatch(/^kaoyan-\d{4}-english-/);
    expect(responseBody.tokens.length).toBeGreaterThan(0);
  });

  it('allows the frontend dev origin to request passages with credentials', async () => {
    const response = await request(app.getHttpServer())
      .options('/reading/passages/random')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('registers, completes a passage, and returns vocabulary entries', async () => {
    const agent = request.agent(app.getHttpServer());
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

  it('returns vocabulary detail for a completed lemma', async () => {
    const agent = request.agent(app.getHttpServer());

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
