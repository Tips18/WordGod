import type {
  AuthResponse,
  CompleteReadingAttemptResponse,
  LoginRequest,
  ReadingPassageResponse,
  RegisterRequest,
  SyncReadingAttemptRequest,
  VocabularyDetailResponse,
  VocabularyListResponse,
} from '@word-god/contracts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

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
  return requestJson<ReadingPassageResponse>('/reading/passages/random');
}

/**
 * `syncReadingAttempt` 以覆盖方式同步当前段落的所有选择。
 */
export function syncReadingAttempt(
  passageId: string,
  payload: SyncReadingAttemptRequest,
): Promise<{ success: true }> {
  return requestJson<{ success: true }>(`/reading/attempts/${passageId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * `completeReadingAttempt` 结算当前段落并获取下一段。
 */
export function completeReadingAttempt(passageId: string): Promise<CompleteReadingAttemptResponse> {
  return requestJson<CompleteReadingAttemptResponse>(`/reading/attempts/${passageId}/complete`, {
    method: 'POST',
  });
}

/**
 * `login` 使用邮箱和密码登录。
 */
export function login(payload: LoginRequest): Promise<AuthResponse> {
  return requestJson<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * `register` 使用邮箱和密码注册。
 */
export function register(payload: RegisterRequest): Promise<AuthResponse> {
  return requestJson<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * `logout` 结束当前会话。
 */
export function logout(): Promise<{ success: true }> {
  return requestJson<{ success: true }>('/auth/logout', {
    method: 'POST',
  });
}

/**
 * `listVocabulary` 获取当前用户的生词本列表。
 */
export function listVocabulary(): Promise<VocabularyListResponse> {
  return requestJson<VocabularyListResponse>('/vocabulary');
}

/**
 * `getVocabularyDetail` 获取指定 lemma 的生词详情。
 */
export function getVocabularyDetail(lemma: string): Promise<VocabularyDetailResponse> {
  return requestJson<VocabularyDetailResponse>(`/vocabulary/${lemma}`);
}

/**
 * `getCurrentUser` 获取当前登录用户信息。
 */
export function getCurrentUser(): Promise<{ user: { id: string; email: string } } | { user: null }> {
  return requestJson<{ user: { id: string; email: string } } | { user: null }>('/auth/me');
}
