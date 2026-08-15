export const metadata = { title: '개인정보 처리방침' }

/**
 * 개인정보 처리방침.
 *
 * 학교가 실제로 쓰려면 학교 이름과 담당자를 채워야 한다. 그 부분은
 * [ ] 로 비워 두었다 — 그럴듯한 가짜 정보를 넣어 두면 그대로 배포된다.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-xl font-semibold">개인정보 처리방침</h1>

      <section className="mt-8 space-y-6 text-sm leading-relaxed text-ink-soft">
        <div>
          <h2 className="font-semibold text-ink">무엇을 모으나</h2>
          <p className="mt-1.5">
            교직원의 이름, 이메일, 직위, 담당 교과와 학급을 모읍니다. 학교 업무를 처리하는 데
            필요한 최소한입니다.
          </p>
          <p className="mt-1.5">
            학생에 대해서는 <strong className="text-ink">실명을 저장하지 않습니다.</strong> 학번과
            이니셜(또는 별칭)만 다룹니다. 생년월일, 주소, 연락처, 진단명은 이 시스템에 아예
            항목이 없습니다.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-ink">어디에 두나</h2>
          <p className="mt-1.5">
            데이터베이스는 국내(서울) 리전에 둡니다. 학교별로 접근 권한이 나뉘어 있어 다른 학교
            자료는 조회할 수 없습니다.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-ink">외부로 나가는 것</h2>
          <p className="mt-1.5">
            수업 도구함에서 안내문을 다듬거나 수업 자료를 찾을 때 입력한 내용이 Google Gemini로
            전송됩니다. 보내기 전에 이름·전화번호·주민등록번호 같은 항목을 자동으로 가리고,
            무엇이 나가는지 화면에서 확인한 뒤에 전송합니다. 주민등록번호와 계좌번호가 남아 있으면
            전송 자체가 막힙니다.
          </p>
          <p className="mt-1.5">
            그 밖의 기능(특별실 예약, 결보강, 학사일정, 예산)은 외부로 아무것도 보내지 않습니다.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-ink">기록과 보관</h2>
          <p className="mt-1.5">
            누가 언제 무엇을 조회하거나 고쳤는지 기록합니다. 이 기록은 2년간 보관한 뒤 파기합니다.
            업무 자료는 학년도가 끝나면 정리합니다.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-ink">문의</h2>
          <p className="mt-1.5">
            개인정보 보호책임자: [ 담당자 이름 ] · [ 연락처 ]
            <br />
            열람·정정·삭제를 원하시면 위 연락처로 요청하세요.
          </p>
        </div>
      </section>

      <p className="mt-10 text-xs text-ink-soft">
        이 방침은 학교 사정에 맞게 고쳐서 쓰세요. 대괄호로 비워 둔 곳은 반드시 채워야 합니다.
      </p>
    </main>
  )
}
