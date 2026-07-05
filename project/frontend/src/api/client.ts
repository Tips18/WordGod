import type {
  AuthResponse,
  CompleteReadingAttemptResponse,
  EmailCodeLoginRequest,
  LoginRequest,
  ReadingPassageResponse,
  RegisterRequest,
  ResetPasswordRequest,
  SendEmailCodeRequest,
  SendEmailCodeResponse,
  SyncReadingAttemptRequest,
  VocabularyDetailResponse,
  VocabularyListResponse,
} from '@word-god/contracts';
import type { MobileLocalClient } from './mobile-local-client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const IS_MOBILE_RUNTIME = import.meta.env.VITE_WORD_GOD_RUNTIME === 'mobile';
let mobileClientPromise: Promise<MobileLocalClient> | null = null;

/**
 * `getMobileClient` 懒加载移动端本地客户端和离线题库资源。
 */
async function getMobileClient(): Promise<MobileLocalClient> {
  mobileClientPromise ??= Promise.all([
    import('./mobile-local-client'),
    import('../mobile/mobile-passages.generated'),
  ]).then(([clientModule, passageModule]) =>
    clientModule.createMobileLocalClient({
      passages: passageModule.mobilePassages,
    }),
  );

  return mobileClientPromise;
}

/**
 * `ApiError` 封装后端接口返回的错误状态。
 */
export class ApiError extends Error {
  public readonly status: number;

  /**
   * `constructor` 记录错误状态码与消息。
   */
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * `requestJson` 发送带 cookies 的 JSON 请求并处理异常状态。
 */
async function requestJson<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError((payload as { message?: string } | null)?.message ?? '请求失败', response.status);
  }

  return payload as TResponse;
}

/**
 * `getRandomPassage` 获取阅读页需要展示的随机段落。
 */
export function getRandomPassage(): Promise<ReadingPassageResponse> {
  if (IS_MOBILE_RUNTIME) {
    return getMobileClient().then((client) => client.getRandomPassage());
  }

  return requestJson<ReadingPassageResponse>('/reading/passages/random');
}

/**
 * `syncReadingAttempt` 以覆盖方式同步当前段落的所有选择。
 */
export function syncReadingAttempt(
  passageId: string,
  payload: SyncReadingAttemptRequest,
): Promise<{ success: true }> {
  if (IS_MOBILE_RUNTIME) {
    return getMobileClient().then((client) =>
      client.syncReadingAttempt(passageId, payload),
    );
  }

  return requestJson<{ success: true }>(`/reading/attempts/${passageId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * `completeReadingAttempt` 结算当前段落并获取下一段。
 */
export function completeReadingAttempt(passageId: string): Promise<CompleteReadingAttemptResponse> {
  if (IS_MOBILE_RUNTIME) {
    return getMobileClient().then((client) =>
      client.completeReadingAttempt(passageId),
    );
  }

  return requestJson<CompleteReadingAttemptResponse>(`/reading/attempts/${passageId}/complete`, {
    method: 'POST',
  });
}

/**
 * `login` 使用邮箱和密码登录。
 */
export function login(payload: LoginRequest): Promise<AuthResponse> {
  if (IS_MOBILE_RUNTIME) {
    void payload;
    return getMobileClient().then((client) => client.getCurrentUser());
  }

  return requestJson<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * `register` 使用邮箱和密码注册。
 */
export function register(payload: RegisterRequest): Promise<AuthResponse> {
  if (IS_MOBILE_RUNTIME) {
    void payload;
    return getMobileClient().then((client) => client.getCurrentUser());
  }

  return requestJson<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * `sendEmailCode` 请求后端向指定邮箱发送一次性验证码。
 */
export function sendEmailCode(payload: SendEmailCodeRequest): Promise<SendEmailCodeResponse> {
  if (IS_MOBILE_RUNTIME) {
    void payload;
    return Promise.resolve({ success: true });
  }

  return requestJson<SendEmailCodeResponse>('/auth/email-codes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * `loginWithEmailCode` 使用邮箱验证码完成登录。
 */
export function loginWithEmailCode(payload: EmailCodeLoginRequest): Promise<AuthResponse> {
  if (IS_MOBILE_RUNTIME) {
    void payload;
    return getMobileClient().then((client) => client.getCurrentUser());
  }

  return requestJson<AuthResponse>('/auth/login/email-code', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * `resetPassword` 使用邮箱验证码重置密码并建立登录会话。
 */
export function resetPassword(payload: ResetPasswordRequest): Promise<AuthResponse> {
  if (IS_MOBILE_RUNTIME) {
    void payload;
    return getMobileClient().then((client) => client.getCurrentUser());
  }

  return requestJson<AuthResponse>('/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * `logout` 结束当前会话。
 */
export function logout(): Promise<{ success: true }> {
  if (IS_MOBILE_RUNTIME) {
    return Promise.resolve({ success: true });
  }

  return requestJson<{ success: true }>('/auth/logout', {
    method: 'POST',
  });
}

/**
 * `listVocabulary` 获取当前用户的生词本列表。
 */
export function listVocabulary(): Promise<VocabularyListResponse> {
  if (IS_MOBILE_RUNTIME) {
    return getMobileClient().then((client) => client.listVocabulary());
  }

  return requestJson<VocabularyListResponse>('/vocabulary');
}

/**
 * `getVocabularyDetail` 获取指定 lemma 的生词详情。
 */
export function getVocabularyDetail(lemma: string): Promise<VocabularyDetailResponse> {
  if (IS_MOBILE_RUNTIME) {
    return getMobileClient().then((client) =>
      client.getVocabularyDetail(lemma),
    );
  }

  return requestJson<VocabularyDetailResponse>(`/vocabulary/${lemma}`);
}

/**
 * `getCurrentUser` 获取当前登录用户信息。
 */
export function getCurrentUser(): Promise<{ user: { id: string; email: string } } | { user: null }> {
  if (IS_MOBILE_RUNTIME) {
    return getMobileClient().then((client) => client.getCurrentUser());
  }

  return requestJson<{ user: { id: string; email: string } } | { user: null }>('/auth/me');
}
