import { PassageToken } from '@word-god/contracts';
import { PassageRecord } from './store.types';

/**
 * `createToken` 生成测试内存题库使用的 token 数据。
 */
function createToken(
  token: Partial<PassageToken> & Pick<PassageToken, 'id' | 'lemma' | 'surface'>,
): PassageToken {
  return {
    sentenceIndex: 0,
    partOfSpeech: 'n.',
    definitionCn: '测试释义',
    translationCn: '测试翻译',
    isWord: true,
    ...token,
  };
}

/**
 * `seedPassages` 提供测试内存模式使用的真实考研阅读段落。
 */
export const seedPassages: PassageRecord[] = [
  {
    id: 'kaoyan-2022-english-i-reading-text-1',
    examType: 'kaoyan',
    year: 2022,
    paper: '英语一',
    questionType: 'reading',
    passageIndex: 1,
    title: '2022 英语一 Text 1',
    content:
      'People often complain that plastics are too durable. Water bottles, shopping bags, and other trash litter the planet.',
    sourceUrl:
      'https://raw.githubusercontent.com/Fantasia1999/kaoyanzhenti/main/2022-english-i.pdf',
    sourceDomain: 'raw.githubusercontent.com',
    sentences: [
      {
        index: 0,
        text: 'People often complain that plastics are too durable. Water bottles, shopping bags, and other trash litter the planet.',
        translation:
          '人们常常抱怨塑料太耐用了。水瓶、购物袋和其他垃圾遍布地球。',
      },
    ],
    tokens: [
      createToken({
        id: 'k2022-i-t1-people',
        lemma: 'people',
        surface: 'People',
        definitionCn: '人们',
      }),
      createToken({
        id: 'k2022-i-t1-complain',
        lemma: 'complain',
        surface: 'complain',
        partOfSpeech: 'v.',
        definitionCn: '抱怨',
      }),
      createToken({
        id: 'k2022-i-t1-plastics',
        lemma: 'plastic',
        surface: 'plastics',
        definitionCn: '塑料',
      }),
    ],
    publishedAt: '2022-01-01T00:00:00.000Z',
  },
  {
    id: 'kaoyan-2022-english-i-reading-text-2',
    examType: 'kaoyan',
    year: 2022,
    paper: '英语一',
    questionType: 'reading',
    passageIndex: 2,
    title: '2022 英语一 Text 2',
    content:
      'As the latest crop of students pen their undergraduate application forms, it may be worth considering how the value of a degree has changed.',
    sourceUrl:
      'https://raw.githubusercontent.com/Fantasia1999/kaoyanzhenti/main/2022-english-i.pdf',
    sourceDomain: 'raw.githubusercontent.com',
    sentences: [
      {
        index: 0,
        text: 'As the latest crop of students pen their undergraduate application forms, it may be worth considering how the value of a degree has changed.',
        translation:
          '当最新一批学生填写本科申请表时，值得思考学位的价值发生了怎样的变化。',
      },
    ],
    tokens: [
      createToken({
        id: 'k2022-i-t2-students',
        lemma: 'student',
        surface: 'students',
        definitionCn: '学生',
      }),
      createToken({
        id: 'k2022-i-t2-degree',
        lemma: 'degree',
        surface: 'degree',
        definitionCn: '学位',
      }),
    ],
    publishedAt: '2022-01-01T00:00:00.000Z',
  },
  {
    id: 'kaoyan-2023-english-i-reading-text-1',
    examType: 'kaoyan',
    year: 2023,
    paper: '英语一',
    questionType: 'reading',
    passageIndex: 1,
    title: '2023 英语一 Text 1',
    content:
      'The weather in Texas may have cooled since the recent extreme heat, but the temperature will be high at the State Board of Education meeting.',
    sourceUrl:
      'https://raw.githubusercontent.com/Fantasia1999/kaoyanzhenti/main/2023-english-i.pdf',
    sourceDomain: 'raw.githubusercontent.com',
    sentences: [
      {
        index: 0,
        text: 'The weather in Texas may have cooled since the recent extreme heat, but the temperature will be high at the State Board of Education meeting.',
        translation:
          '最近的极端高温过后，得克萨斯的天气或许已经降温，但州教育委员会会议上的气氛仍会很热烈。',
      },
    ],
    tokens: [
      createToken({
        id: 'k2023-i-t1-weather',
        lemma: 'weather',
        surface: 'weather',
        definitionCn: '天气',
      }),
      createToken({
        id: 'k2023-i-t1-education',
        lemma: 'education',
        surface: 'Education',
        definitionCn: '教育',
      }),
    ],
    publishedAt: '2023-01-01T00:00:00.000Z',
  },
];
