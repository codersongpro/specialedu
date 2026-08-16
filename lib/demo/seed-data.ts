/**
 * 데모 학교 「한빛특수학교」 구성값.
 *
 * 실존 학생·교직원 정보는 하나도 쓰지 않았다. 이름은 순우리말로 지어낸 것이다.
 * 시정표와 특별실은 실제 특수학교 운영을 참고해 그럴듯하게 맞췄다.
 */

export const DEMO_SCHOOL = {
  name: '한빛특수학교',
  timezone: 'Asia/Seoul',
}

export const DEMO_PASSWORD = 'Demo!2026'

/** 로그인해 볼 수 있는 계정 4종 */
export const DEMO_ACCOUNTS = [
  {
    email: 'admin@hanbit.demo',
    name: '정한결',
    role: 'admin' as const,
    employment: 'full_time' as const,
    note: '관리자(교감)',
  },
  {
    email: 'manager@hanbit.demo',
    name: '오나린',
    role: 'manager' as const,
    employment: 'full_time' as const,
    note: '교무부장',
  },
  {
    email: 'teacher@hanbit.demo',
    name: '김하늘',
    role: 'teacher' as const,
    employment: 'full_time' as const,
    note: '고등 3-1 담임',
  },
  {
    email: 'parttime@hanbit.demo',
    name: '최나래',
    role: 'part_time' as const,
    employment: 'part_time' as const,
    note: '시간강사 (화·목 출근)',
  },
]

/** 나머지 교직원 — 결보강 후보가 충분히 나오도록 인원을 채운다 */
export const EXTRA_STAFF = [
  { name: '이바다', role: 'teacher', employment: 'full_time' },
  { name: '박가온', role: 'teacher', employment: 'full_time' },
  { name: '한슬기', role: 'teacher', employment: 'full_time' },
  { name: '윤아라', role: 'teacher', employment: 'full_time' },
  { name: '장미르', role: 'teacher', employment: 'full_time' },
  { name: '신여울', role: 'teacher', employment: 'full_time' },
  { name: '조가람', role: 'teacher', employment: 'full_time' },
  { name: '배도담', role: 'teacher', employment: 'full_time' },
  { name: '노벼리', role: 'teacher', employment: 'full_time' },
  { name: '서다솜', role: 'teacher', employment: 'fixed_term' },
  { name: '문누리', role: 'teacher', employment: 'fixed_term' },
  { name: '강초롱', role: 'teacher', employment: 'full_time' },
  { name: '임보라', role: 'teacher', employment: 'full_time' },
  { name: '홍새얀', role: 'teacher', employment: 'full_time' },
  { name: '유한빛', role: 'teacher', employment: 'full_time' },
  { name: '차예솔', role: 'part_time', employment: 'part_time' },
  { name: '남기쁨', role: 'part_time', employment: 'part_time' },
  { name: '구소라', role: 'staff', employment: 'assistant' },
  { name: '민아름', role: 'staff', employment: 'assistant' },
  { name: '천보름', role: 'staff', employment: 'assistant' },
  { name: '표설아', role: 'teacher', employment: 'full_time' },
] as const

/**
 * 로그인 가능한 데모 계정 전체 (25개) 의 이메일.
 *
 * "체험하기" 버튼이 이 중 하나를 무작위로 골라 넣어준다. 계정을 넓게
 * 흩어 놓아야 여러 사람이 동시에 눌러도 서로 다른 사람으로 들어가고,
 * 같은 학교 데이터를 실시간으로 함께 편집하는 모습을 자연스럽게 보게 된다.
 * scripts/seed.ts·lib/demo/seed.ts 가 EXTRA_STAFF 를 `staff${n}@hanbit.demo`
 * 순서로 계정을 만들므로 그 규칙을 그대로 따른다.
 */
export const ALL_DEMO_EMAILS: string[] = [
  ...DEMO_ACCOUNTS.map((a) => a.email),
  ...EXTRA_STAFF.map((_, index) => `staff${index + 1}@hanbit.demo`),
]

export const DEPARTMENTS = ['교무부', '연구부', '생활지도부', '진로직업부', '방과후부']

export const BEHAVIOR_CATEGORIES = [
  '자리 이탈',
  '지시 거부',
  '소리 지르기',
  '물건 던지기',
  '공격 행동',
  '자해',
  '기타',
]

export const SUBJECTS = [
  '국어',
  '수학',
  '사회',
  '과학',
  '체육',
  '음악',
  '미술',
  '실과',
  '진로와 직업',
  '일상생활활동',
  '자립생활',
  '직업생활',
  '창의적체험활동',
]

/**
 * 과정별 시정표.
 *
 * 초등 40분, 중등 45분, 고등 50분, 전공과는 100분 블록.
 * 시작 시각이 어긋나 있어 교시 번호로 비교하면 충돌을 놓친다 —
 * 이 데이터가 그걸 실제로 보여준다.
 */
export const PERIODS: Record<string, Array<[number, string, string, string, boolean]>> = {
  elementary: [
    [1, '1교시', '09:00', '09:40', false],
    [2, '2교시', '09:50', '10:30', false],
    [3, '3교시', '10:40', '11:20', false],
    [4, '4교시', '11:30', '12:10', false],
    [5, '5교시', '13:10', '13:50', false],
    [6, '방과후1', '14:00', '14:40', true],
  ],
  middle: [
    [1, '1교시', '09:00', '09:45', false],
    [2, '2교시', '09:55', '10:40', false],
    [3, '3교시', '10:50', '11:35', false],
    [4, '4교시', '11:45', '12:30', false],
    [5, '5교시', '13:30', '14:15', false],
    [6, '6교시', '14:25', '15:10', false],
    [7, '방과후1', '15:20', '16:05', true],
  ],
  high: [
    [1, '1교시', '09:00', '09:50', false],
    [2, '2교시', '10:00', '10:50', false],
    [3, '3교시', '11:00', '11:50', false],
    [4, '4교시', '12:00', '12:50', false],
    [5, '5교시', '13:50', '14:40', false],
    [6, '6교시', '14:50', '15:40', false],
    [7, '방과후1', '15:50', '16:40', true],
  ],
  vocational: [
    [1, '1블록', '09:00', '10:40', false],
    [2, '2블록', '10:50', '12:30', false],
    [3, '3블록', '13:30', '15:10', false],
  ],
}

export const CLASSES: Array<[string, number, string]> = [
  ['elementary', 1, '초1-1'],
  ['elementary', 2, '초2-1'],
  ['elementary', 3, '초3-1'],
  ['elementary', 4, '초4-1'],
  ['elementary', 5, '초5-1'],
  ['elementary', 6, '초6-1'],
  ['middle', 1, '중1-1'],
  ['middle', 1, '중1-2'],
  ['middle', 2, '중2-1'],
  ['middle', 3, '중3-1'],
  ['high', 1, '고1-1'],
  ['high', 1, '고1-2'],
  ['high', 2, '고2-1'],
  ['high', 3, '고3-1'],
  ['high', 3, '고3-2'],
  ['vocational', 1, '전공과1-1'],
  ['vocational', 1, '전공과1-2'],
  ['vocational', 2, '전공과2-1'],
]

export const ROOMS: Array<{
  name: string
  type: string
  floor: number
  capacity: number
  features: string[]
  approval?: boolean
}> = [
  { name: '요리실습실', type: 'cooking', floor: 2, capacity: 12, features: ['조리대', '싱크대', '인덕션'] },
  { name: '바리스타실습실', type: 'vocational', floor: 2, capacity: 10, features: ['에스프레소머신', '싱크대'] },
  { name: '제과제빵실', type: 'vocational', floor: 2, capacity: 10, features: ['오븐', '작업대', '싱크대'] },
  { name: '목공실', type: 'workshop', floor: 1, capacity: 8, features: ['작업대', '집진기'] },
  { name: '세탁실습실', type: 'vocational', floor: 1, capacity: 8, features: ['세탁기', '건조기', '다림대'] },
  { name: '음악치료실', type: 'therapy', floor: 3, capacity: 8, features: ['피아노', '타악기', '방음'] },
  { name: '감각통합실', type: 'therapy', floor: 3, capacity: 6, features: ['그네', '볼풀', '매트'] },
  { name: '스누젤렌실', type: 'therapy', floor: 3, capacity: 4, features: ['조명', '음향', '워터베드'] },
  { name: '체육관', type: 'gym', floor: 1, capacity: 40, features: ['매트', '음향', '농구대'], approval: true },
  { name: '컴퓨터실', type: 'computer', floor: 2, capacity: 16, features: ['PC', '빔프로젝터'] },
  { name: '도서실', type: 'library', floor: 3, capacity: 20, features: ['빔프로젝터'] },
  { name: '다목적실', type: 'multipurpose', floor: 1, capacity: 30, features: ['음향', '빔프로젝터'], approval: true },
]

/**
 * 특별실 유형별 어울리는 과정·예약 사유 — 무작위 예약 생성에 쓴다.
 *
 * 방 이름을 하나하나 지정하는 대신, 유형(room_type)에 맞는 과정과 사유
 * 후보를 두고 시드가 매번 다르게 뽑아 채운다. 그래도 "요리실습실에
 * 감각통합 수업이 잡히는" 것 같은 억지스러운 조합은 안 나온다.
 */
export const ROOM_BOOKING_PROFILE: Record<
  string,
  { courses: string[]; purposes: string[]; kind: string }
> = {
  cooking: {
    courses: ['high', 'vocational'],
    purposes: ['조리 실습', '샌드위치 만들기', '급식 보조 실습', '간식 만들기', '볶음 요리 실습'],
    kind: 'vocational_practice',
  },
  vocational: {
    courses: ['vocational', 'high'],
    purposes: ['에스프레소 추출', '라떼아트', '포장 실습', '카페 운영 실습', '음료 제조'],
    kind: 'vocational_practice',
  },
  workshop: {
    courses: ['vocational', 'high'],
    purposes: ['수납함 제작', '조립 실습', '목공 기초', '사포질·마감'],
    kind: 'vocational_practice',
  },
  therapy: {
    courses: ['elementary', 'middle'],
    purposes: ['감각통합', '음악치료', '이완 활동', '촉각 놀이'],
    kind: 'regular',
  },
  gym: {
    courses: ['elementary', 'middle', 'high', 'vocational'],
    purposes: ['체육', '뉴스포츠', '방과후 체육', '체력 단련'],
    kind: 'regular',
  },
  computer: {
    courses: ['middle', 'high', 'vocational'],
    purposes: ['문서 작성', '정보 활용', '취업 서류 작성', '온라인 수업'],
    kind: 'regular',
  },
  library: {
    courses: ['elementary', 'middle', 'high'],
    purposes: ['독서 활동', '그림책 읽기', '독서', '자료 조사'],
    kind: 'regular',
  },
  multipurpose: {
    courses: ['elementary', 'middle', 'high', 'vocational'],
    purposes: ['학년 모임', '학급 회의', '동아리 활동', '소모임'],
    kind: 'onetime',
  },
}

/** 응급 시 즉시 확인해야 하는 안전 프로토콜 더미 — 학생 몇 명에게 표본으로 붙인다 */
export const SAFETY_PROTOCOL_TEMPLATES: Array<{
  category: 'seizure' | 'allergy' | 'dysphagia' | 'other'
  title: string
  content: string
}> = [
  {
    category: 'seizure',
    title: '발작 대응 절차',
    content:
      '경련 시작 시 즉시 옆으로 눕히고 주변 위험물을 치운다. 입에 아무것도 넣지 않는다. 5분 이상 지속되거나 호흡이 어려우면 즉시 119에 신고하고 보건실에 연락한다.',
  },
  {
    category: 'allergy',
    title: '견과류 알레르기',
    content:
      '급식·간식에 견과류 성분이 들어가면 절대 섭취 금지. 두드러기·호흡곤란 발생 시 보건실 비치 에피펜을 즉시 사용하고 119에 신고한다.',
  },
  {
    category: 'allergy',
    title: '갑각류 알레르기',
    content:
      '새우·게 등 갑각류 섭취 금지. 급식 전 영양교사에게 재확인이 필요하다. 이상 반응 시 즉시 보건실로 인계한다.',
  },
  {
    category: 'dysphagia',
    title: '연하곤란 — 다진 음식 필요',
    content:
      '일반식 섭취 시 사레 위험이 있다. 급식은 다진 형태로 별도 제공하고, 식사 중에는 반드시 보조 인력이 곁에서 관찰한다.',
  },
  {
    category: 'dysphagia',
    title: '연하곤란 — 걸쭉한 음료만 가능',
    content:
      '일반 음료는 흡인 위험이 있어 점도증진제로 걸쭉하게 만들어 제공한다. 식사 시간 전후로는 눕히지 않는다.',
  },
  {
    category: 'other',
    title: '휠체어 이동 시 주의',
    content: '계단 이용 불가, 반드시 엘리베이터로 이동한다. 이동 중에는 벨트 고정 여부를 꼭 확인한다.',
  },
  {
    category: 'other',
    title: '큰 소리에 놀람 반응',
    content:
      '화재경보 등 큰 소리에 심한 불안 반응을 보인다. 소음이 예정돼 있으면 미리 알려주고, 발생 시 귀마개 착용을 돕는다.',
  },
]

/** 고교학점제 선택과목 · 자유학기 주제선택활동 */
export const COURSE_GROUPS: Array<{
  name: string
  course: string
  memberClassNames: string[]
  subject: string
}> = [
  { name: '바리스타 선택', course: 'high', memberClassNames: ['고3-1', '고3-2'], subject: '진로와 직업' },
  { name: '제과제빵 선택', course: 'high', memberClassNames: ['고3-1', '고3-2'], subject: '진로와 직업' },
  { name: '생활음악 선택', course: 'high', memberClassNames: ['고1-1', '고1-2'], subject: '음악' },
  { name: '주제선택 - 우리동네', course: 'middle', memberClassNames: ['중1-1', '중1-2'], subject: '창의적체험활동' },
]

export const EVENT_SEED: Array<{
  title: string
  offsetDays: number
  lengthDays?: number
  scope: string
  category: string
  courseKey?: string
  grade?: number
  className?: string
  detail?: string
}> = [
  { title: '1학기 개학', offsetDays: -60, scope: 'school', category: 'academic' },
  { title: '학부모 총회', offsetDays: -45, scope: 'school', category: 'academic', detail: '다목적실' },
  { title: '전교 안전교육', offsetDays: -20, scope: 'school', category: 'training' },
  { title: '초등 봄 현장체험학습', offsetDays: -12, scope: 'course', courseKey: 'elementary', category: 'course_event', detail: '수목원' },
  { title: '전공과 현장실습 주간', offsetDays: -7, lengthDays: 4, scope: 'course', courseKey: 'vocational', category: 'course_event' },
  { title: '고3 진로상담 주간', offsetDays: -3, lengthDays: 5, scope: 'grade', courseKey: 'high', grade: 3, category: 'grade_event' },
  { title: '학교 운영위원회', offsetDays: 1, scope: 'school', category: 'academic' },
  { title: '고3-1 생일잔치', offsetDays: 2, scope: 'class', className: '고3-1', category: 'class_event' },
  { title: '중등 체육대회', offsetDays: 4, scope: 'course', courseKey: 'middle', category: 'course_event', detail: '체육관' },
  { title: '교직원 연수 - 긍정적 행동지원', offsetDays: 6, scope: 'school', category: 'training' },
  { title: '초1-1 학부모 공개수업', offsetDays: 8, scope: 'class', className: '초1-1', category: 'class_event' },
  { title: '전공과 자격증 시험', offsetDays: 10, scope: 'course', courseKey: 'vocational', category: 'exam' },
  { title: '가을 운동회', offsetDays: 14, scope: 'school', category: 'academic', detail: '운동장 (우천 시 체육관)' },
  { title: '고등 진로체험의 날', offsetDays: 17, scope: 'course', courseKey: 'high', category: 'course_event' },
  { title: '재량휴업일', offsetDays: 20, scope: 'school', category: 'holiday' },
  { title: '초등 학예발표회', offsetDays: 24, scope: 'course', courseKey: 'elementary', category: 'course_event' },
  { title: '고3-2 졸업앨범 촬영', offsetDays: 27, scope: 'class', className: '고3-2', category: 'class_event' },
  { title: '2학기 중간 평가', offsetDays: 30, lengthDays: 3, scope: 'school', category: 'exam' },
  { title: '전공과 취업박람회 참관', offsetDays: 35, scope: 'course', courseKey: 'vocational', category: 'course_event' },
  { title: '겨울방학', offsetDays: 60, lengthDays: 30, scope: 'school', category: 'vacation' },
]
