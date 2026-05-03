/**
 * `ExamType` 定义 V1 支持的考试类型。
 */
export type ExamType = 'kaoyan';

/**
 * `QuestionType` 定义段落所属题型。
 */
export type QuestionType = 'reading' | 'cloze';

/**
 * `PassageToken` 描述前端可点击的单词 token。
 */
export interface PassageToken {
  id: string;
  lemma: string;
  surface: string;
  sentenceIndex: number;
  partOfSpeech: string;
  definitionCn: string;
  translationCn: string;
  isWord: boolean;
}

/**
 * `PassageSentence` 描述段落中的句子与译文。
 */
export interface PassageSentence {
  index: number;
  text: string;
  translation: string;
}

/**
 * `PassageSummary` 描述真题段落的展示元信息。
 */
export interface PassageSummary {
  id: string;
  examType: ExamType;
  year: number;
  paper: string;
  questionType: QuestionType;
  passageIndex: number;
  title: string;
  content: string;
  sourceUrl: string;
}

/**
 * `ReadingPassageResponse` 描述阅读页加载所需的完整数据。
 */
export interface ReadingPassageResponse {
  passage: PassageSummary;
  sentences: PassageSentence[];
  tokens: PassageToken[];
  selectedTokenIds: string[];
  requiresAuthToComplete: boolean;
}

/**
 * `SyncReadingAttemptRequest` 描述整段的当前选择状态。
 */
export interface SyncReadingAttemptRequest {
  selectedTokenIds: string[];
}

/**
 * `CompleteReadingAttemptResponse` 描述完成当前段落后的返回结果。
 */
export interface CompleteReadingAttemptResponse {
  completedPassageId: string;
  savedLemmaCount: number;
  nextPassage: ReadingPassageResponse;
}

/**
 * `AuthUser` 描述登录用户的最小信息。
 */
export interface AuthUser {
  id: string;
  email: string;
}

/**
 * `AuthResponse` 描述认证接口响应。
 */
export interface AuthResponse {
  user: AuthUser;
}

/**
 * `RegisterRequest` 描述注册入参。
 */
export interface RegisterRequest {
  email: string;
  password: string;
}

/**
 * `LoginRequest` 描述登录入参。
 */
export interface LoginRequest {
  email: string;
  password: string;
  rememberLogin?: boolean;
}

/**
 * `VocabularyContextDto` 描述生词上下文。
 */
export interface VocabularyContextDto {
  sentenceText: string;
  sentenceTranslation: string;
  markedAt: string;
  passageId: string;
}

/**
 * `VocabularyEntryDto` 描述生词本列表条目。
 */
export interface VocabularyEntryDto {
  lemma: string;
  surface: string;
  partOfSpeech: string;
  definitionCn: string;
  markCount: number;
  lastMarkedAt: string;
  contexts: VocabularyContextDto[];
}

/**
 * `VocabularyListResponse` 描述生词本列表返回结构。
 */
export interface VocabularyListResponse {
  items: VocabularyEntryDto[];
}

/**
 * `VocabularyDetailResponse` 描述单个生词详情。
 */
export interface VocabularyDetailResponse {
  item: VocabularyEntryDto;
}
