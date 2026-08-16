import { describe, expect, it } from 'vitest'
import { blockedFindings, maskFields, maskPII, restorePII, scanForBlocked } from '@/lib/security/pii'

describe('마스킹 왕복', () => {
  it('가정통신문에서 이름·전화번호를 빼고 되돌린다', () => {
    const original = '김민수 학생은 3월 5일 체험학습에 참여합니다. 문의 010-1234-5678'
    const { masked, tokens, findings } = maskPII(original)

    // Google 에 도달하는 문장에는 개인정보가 없어야 한다
    expect(masked).not.toContain('김민수')
    expect(masked).not.toContain('010-1234-5678')
    expect(masked).toContain('체험학습')
    expect(masked).toContain('3월 5일')
    expect(findings).toHaveLength(2)

    // 모델이 문장을 바꿔도 토큰만 지키면 복원된다
    const rewritten = masked.replace('참여합니다', '갑니다')
    const { text, missing } = restorePII(rewritten, tokens)
    expect(missing).toHaveLength(0)
    expect(text).toContain('김민수')
    expect(text).toContain('010-1234-5678')
    expect(text).toContain('갑니다')
  })

  it('같은 이름이 여러 번 나오면 같은 토큰을 쓴다', () => {
    const { masked, tokens } = maskPII('김민수 학생과 김민수 학생의 보호자')
    expect(Object.keys(tokens)).toHaveLength(1)
    expect(masked.match(/\[\[P1\]\]/g)).toHaveLength(2)
  })

  it('모델이 토큰을 없애면 복원 실패로 알린다', () => {
    const { tokens } = maskPII('문의 010-1234-5678')
    const { missing } = restorePII('문의처는 학교로 연락하세요', tokens)
    expect(missing).toHaveLength(1)
  })
})

describe('탐지 대상', () => {
  it('주민등록번호와 계좌번호를 잡는다', () => {
    const rrn = maskPII('주민번호 950101-1234567')
    expect(rrn.findings[0]?.kind).toBe('rrn')

    const account = maskPII('국민 123-4567-89012 로 입금')
    expect(account.findings[0]?.kind).toBe('account')
  })

  it('날짜를 계좌번호로 착각하지 않는다', () => {
    const { findings } = maskPII('2026-03-09 에 만납니다')
    expect(findings).toHaveLength(0)
  })

  it('휴대폰과 일반전화를 모두 잡는다', () => {
    expect(maskPII('010-1234-5678').findings[0]?.kind).toBe('phone')
    expect(maskPII('02-123-4567').findings[0]?.kind).toBe('phone')
    expect(maskPII('031-123-4567').findings[0]?.kind).toBe('phone')
  })

  it('교직원 이름은 명단 대조로 확실히 잡는다', () => {
    const { findings, masked } = maskPII('담당은 박가온입니다', {
      staffNames: ['박가온', '김하늘'],
    })
    expect(findings[0]?.kind).toBe('staff_name')
    expect(findings[0]?.confidence).toBe('certain')
    expect(masked).not.toContain('박가온')
  })

  it('학교명도 마스킹한다', () => {
    const { masked } = maskPII('한빛특수학교 알림', { orgNames: ['한빛특수학교'] })
    expect(masked).not.toContain('한빛특수학교')
  })

  /**
   * 학생 이름은 대조할 명단이 없어 휴리스틱에 의존한다.
   * 그래서 confidence 를 'suspect' 로 두고, 화면에서 사람이 확인하게 한다.
   */
  it('호칭이 붙은 이름은 의심 구간으로 표시한다', () => {
    const { findings } = maskPII('이바다 학생과 최나래 어머니')
    expect(findings).toHaveLength(2)
    expect(findings.every((f) => f.confidence === 'suspect')).toBe(true)
  })

  it('호칭이 없으면 놓친다 — 사람 확인이 필요한 이유', () => {
    const { findings } = maskPII('오늘 이바다가 잘했습니다')
    expect(findings).toHaveLength(0)
  })

  it('사람이 풀어준 구간은 마스킹하지 않는다', () => {
    const { findings } = maskPII('봄맞이 학생 활동', { allowlist: ['봄맞이'] })
    expect(findings).toHaveLength(0)
  })
})

describe('강제 차단', () => {
  it('주민등록번호와 계좌번호는 사람이 풀어줘도 막는다', () => {
    const { findings } = maskPII('950101-1234567 과 123-4567-89012')
    const blocked = blockedFindings(findings)
    expect(blocked).toHaveLength(2)
  })

  it('전화번호는 마스킹 대상이지만 강제 차단은 아니다', () => {
    const { findings } = maskPII('010-1234-5678')
    expect(blockedFindings(findings)).toHaveLength(0)
  })

  it('전송 직전 재검사에서 남은 위험을 잡는다', () => {
    expect(scanForBlocked('안전한 문장입니다')).toHaveLength(0)
    expect(scanForBlocked('950101-1234567')).toHaveLength(1)
  })
})

describe('겹침 처리', () => {
  it('겹치는 구간은 한 번만 치환한다', () => {
    const { masked } = maskPII('김하늘 선생님', { staffNames: ['김하늘'] })
    expect(masked).toBe('[[P1]] 선생님')
    expect(masked).not.toContain('[[P2]]')
  })
})

describe('여러 필드 한 번에 마스킹', () => {
  it('필드마다 따로 마스킹하면 생기는 토큰 충돌이 없다', () => {
    const { fields, tokens } = maskFields({
      title: '이바다 학생 체험학습 안내',
      place: '이바다 학생 자택',
      detail: '문의 010-1234-5678',
    })

    // title과 place에 각각 등장하는 "이바다"가 서로 다른 토큰 번호로
    // 갈라지지 않고 같은 토큰을 공유해야 한다(따로 호출했다면 [[P1]]이
    // 두 번 나오면서 서로 다른 원문을 가리키는 충돌이 생겼을 것).
    expect(fields.title).not.toContain('이바다')
    expect(fields.place).not.toContain('이바다')
    const titleToken = fields.title.match(/\[\[P\d+\]\]/)?.[0]
    const placeToken = fields.place.match(/\[\[P\d+\]\]/)?.[0]
    expect(titleToken).toBeDefined()
    expect(titleToken).toBe(placeToken)
    expect(fields.detail).not.toContain('010-1234-5678')
    expect(Object.keys(tokens).length).toBe(2)
  })

  it('필드 경계 너머로 패턴이 번지지 않는다', () => {
    // place가 "010-1234"로 끝나고 detail이 "5678"로 시작해도 두 필드가
    // 이어붙여져 하나의 전화번호로 오인되면 안 된다.
    const { findings } = maskFields({ place: '문의 010-1234', detail: '5678 아님' })
    expect(findings.some((f) => f.kind === 'phone')).toBe(false)
  })

  it('빈 결과를 원래 필드 개수·순서대로 복원한다', () => {
    const { fields } = maskFields({ a: '안전한 문장', b: '', c: '또 다른 문장' })
    expect(Object.keys(fields)).toEqual(['a', 'b', 'c'])
    expect(fields.a).toBe('안전한 문장')
    expect(fields.b).toBe('')
    expect(fields.c).toBe('또 다른 문장')
  })

  it('마스킹 후 restorePII로 전 필드를 한 번에 되돌릴 수 있다', () => {
    const { fields, tokens } = maskFields({
      title: '김하늘 선생님 안내',
      detail: '문의 010-1234-5678',
    })
    const rewritten = `${fields.title}\n${fields.detail}`
    const { text, missing } = restorePII(rewritten, tokens)
    expect(missing).toHaveLength(0)
    expect(text).toContain('김하늘')
    expect(text).toContain('010-1234-5678')
  })
})
