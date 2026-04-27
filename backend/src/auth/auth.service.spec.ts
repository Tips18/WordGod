import { AuthService } from './auth.service';
import { InMemoryAppStore } from '../store/in-memory-app.store';

describe('AuthService', () => {
  let store: InMemoryAppStore;
  let service: AuthService;

  beforeEach(() => {
    store = new InMemoryAppStore();
    service = new AuthService(store, 'test-secret');
  });

  it('registers a new user with a hashed password and persisted refresh session', async () => {
    const result = await service.register({
      email: 'reader@example.com',
      password: 'Passw0rd!',
    });

    const savedUser = store.findUserByEmail('reader@example.com');
    const sessions = store.listSessionsForUser(result.user.id);

    expect(result.user.email).toBe('reader@example.com');
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(savedUser?.passwordHash).not.toBe('Passw0rd!');
    expect(savedUser?.passwordHash.length).toBeGreaterThan(20);
    expect(sessions).toHaveLength(1);
  });

  it('rejects login when the password is incorrect', async () => {
    await service.register({
      email: 'reader@example.com',
      password: 'Passw0rd!',
    });

    await expect(
      service.login({
        email: 'reader@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrow('邮箱或密码错误');
  });

  it('removes the persisted refresh session on logout', async () => {
    const result = await service.register({
      email: 'reader@example.com',
      password: 'Passw0rd!',
    });

    await service.logout(result.refreshToken);

    expect(store.listSessionsForUser(result.user.id)).toHaveLength(0);
  });
});
