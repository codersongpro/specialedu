import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, format } from 'date-fns'
import type { Database } from '@/lib/supabase/database.types'
import { overlaps } from '@/lib/scheduling/time'
import {
  CLASSES,
  COURSE_GROUPS,
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  DEMO_SCHOOL,
  DEPARTMENTS,
  EVENT_SEED,
  EXTRA_STAFF,
  PERIODS,
  ROOMS,
  SUBJECTS,
} from './seed-data'

/**
 * 데모 학교 「한빛특수학교」를 통째로 만든다.
 *
 * 명령줄(scripts/seed.ts)과 API 라우트가 같은 함수를 쓴다. 배포한 뒤에는
 * 로컬에 아무것도 깔지 않고 브라우저에서 데모 데이터를 만들 수 있어야 해서
 * 스크립트에 묶어두지 않고 여기로 뺐다.
 *
 * is_demo 플래그가 붙고 school_id 가 달라, RLS 때문에 실제 학교 데이터와는
 * 어떤 경로로도 섞이지 않는다. 다시 부르면 기존 데모 학교를 지우고 새로 만든다.
 */

type CourseLevel = 'elementary' | 'middle' | 'high' | 'vocational'
type SeedClient = SupabaseClient<Database>

export interface SeedSummary {
  schoolName: string
  staff: number
  classes: number
  rooms: number
  slots: number
  reservations: number
  substitutions: number
  events: number
  students: number
  accounts: Array<{ email: string; password: string; note: string }>
}

export async function seedDemoSchool(
  db: SeedClient,
  log: (message: string) => void = () => {},
): Promise<SeedSummary> {
  const today = new Date()
  const toDate = (offset: number) => format(addDays(today, offset), 'yyyy-MM-dd')
  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    return h! * 60 + m!
  }
  const pick = <T,>(items: readonly T[], index: number): T => items[index % items.length]!

  log('데모 데이터를 만듭니다...')

  // --- 기존 데모 학교 정리 -------------------------------------------------
  const { data: existing } = await db.from('schools').select('id').eq('is_demo', true)
  for (const school of existing ?? []) {
    const { data: members } = await db.from('profiles').select('id').eq('school_id', school.id)
    for (const member of members ?? []) {
      await db.auth.admin.deleteUser(member.id).catch(() => undefined)
    }
    // 나머지는 on delete cascade 로 함께 지워진다
    await db.from('schools').delete().eq('id', school.id)
  }

  // --- 학교 ----------------------------------------------------------------
  const { data: school, error: schoolError } = await db
    .from('schools')
    .insert({ name: DEMO_SCHOOL.name, timezone: DEMO_SCHOOL.timezone, is_demo: true })
    .select('id')
    .single()

  if (schoolError || !school) throw schoolError ?? new Error('학교를 만들지 못했습니다')
  const schoolId = school.id

  // --- 부서 ----------------------------------------------------------------
  const { data: departments, error: departmentsError } = await db
    .from('departments')
    .insert(DEPARTMENTS.map((name) => ({ school_id: schoolId, name })))
    .select('id, name')
  if (departmentsError) throw departmentsError
  const deptByName = new Map((departments ?? []).map((d) => [d.name, d.id]))

  // --- 교직원 --------------------------------------------------------------
  const staffIds: Array<{ id: string; name: string; employment: string; role: string }> = []

  for (const account of DEMO_ACCOUNTS) {
    const { data: created, error } = await db.auth.admin.createUser({
      email: account.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    })
    if (error || !created.user) throw error ?? new Error(`${account.email} 생성 실패`)

    // 시간강사는 화·목만 출근한다 — 결보강 후보에서 이 조건이 실제로 걸린다
    const workDays = account.employment === 'part_time' ? [2, 4] : [1, 2, 3, 4, 5]

    await db.from('profiles').insert({
      id: created.user.id,
      school_id: schoolId,
      name: account.name,
      role: account.role,
      employment: account.employment,
      department_id: deptByName.get('교무부') ?? null,
      work_days: workDays,
    })
    staffIds.push({
      id: created.user.id,
      name: account.name,
      employment: account.employment,
      role: account.role,
    })
  }

  for (const [index, staff] of EXTRA_STAFF.entries()) {
    const email = `staff${index + 1}@hanbit.demo`
    const { data: created, error } = await db.auth.admin.createUser({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    })
    if (error || !created.user) throw error ?? new Error(`${email} 생성 실패`)

    const workDays = staff.employment === 'part_time' ? [1, 3, 5] : [1, 2, 3, 4, 5]

    await db.from('profiles').insert({
      id: created.user.id,
      school_id: schoolId,
      name: staff.name,
      role: staff.role,
      employment: staff.employment,
      department_id: deptByName.get(pick(DEPARTMENTS, index)) ?? null,
      work_days: workDays,
    })
    staffIds.push({
      id: created.user.id,
      name: staff.name,
      employment: staff.employment,
      role: staff.role,
    })
  }

  const teachers = staffIds.filter((s) => s.role === 'teacher' || s.role === 'part_time')
  log(`  교직원 ${staffIds.length}명`)

  // --- 학기 ----------------------------------------------------------------
  const year = today.getFullYear()
  const { data: term } = await db
    .from('terms')
    .insert({
      school_id: schoolId,
      year,
      semester: today.getMonth() < 7 ? 1 : 2,
      starts_on: toDate(-60),
      ends_on: toDate(60),
      is_free_semester: true,
      is_current: true,
    })
    .select('id')
    .single()

  if (!term) throw new Error('학기를 만들지 못했습니다')
  const termId = term.id

  // --- 시정표 --------------------------------------------------------------
  const periodRows = Object.entries(PERIODS).flatMap(([course, rows]) =>
    rows.map(([periodNo, label, start, end, afterschool]) => ({
      school_id: schoolId,
      course: course as CourseLevel,
      period_no: periodNo,
      label,
      starts_min: toMinutes(start),
      ends_min: toMinutes(end),
      is_afterschool: afterschool,
    })),
  )
  await db.from('periods').insert(periodRows)
  log(`  시정표 ${periodRows.length}줄 (과정마다 시각이 다름)`)

  // --- 교과 ----------------------------------------------------------------
  const { data: subjects, error: subjectsError } = await db
    .from('subjects')
    .insert(SUBJECTS.map((name) => ({ school_id: schoolId, name })))
    .select('id, name')
  if (subjectsError) throw subjectsError
  const subjectByName = new Map((subjects ?? []).map((s) => [s.name, s.id]))

  // --- 학급 ----------------------------------------------------------------
  const { data: classes, error: classesError } = await db
    .from('classes')
    .insert(
      CLASSES.map(([course, grade, name], index) => ({
        school_id: schoolId,
        course: course as CourseLevel,
        grade,
        name,
        // 고3-1 담임은 teacher@hanbit.demo 계정에 붙인다
        homeroom_teacher_id:
          name === '고3-1'
            ? staffIds.find((s) => s.name === '김하늘')!.id
            : pick(teachers, index).id,
        student_count: 5 + (index % 4),
      })),
    )
    .select('id, name, course, grade, student_count, homeroom_teacher_id')

  if (classesError) throw classesError
  const classByName = new Map((classes ?? []).map((c) => [c.name, c]))
  log(`  학급 ${classes?.length ?? 0}개`)

  // --- 특별실 --------------------------------------------------------------
  const { data: rooms, error: roomsError } = await db
    .from('rooms')
    .insert(
      ROOMS.map((room) => ({
        school_id: schoolId,
        name: room.name,
        room_type: room.type,
        floor: room.floor,
        capacity: room.capacity,
        features: room.features,
        requires_approval: room.approval ?? false,
        managed_by: deptByName.get('교무부') ?? null,
      })),
    )
    .select('id, name, requires_approval')

  if (roomsError) throw roomsError
  const roomByName = new Map((rooms ?? []).map((r) => [r.name, r]))
  log(`  특별실 ${rooms?.length ?? 0}개`)

  // --- 수강 그룹 -----------------------------------------------------------
  const { data: courseGroups, error: courseGroupsError } = await db
    .from('course_groups')
    .insert(
      COURSE_GROUPS.map((group) => ({
        school_id: schoolId,
        term_id: termId,
        course: group.course as CourseLevel,
        name: group.name,
        subject_id: subjectByName.get(group.subject) ?? null,
        member_class_ids: group.memberClassNames
          .map((name) => classByName.get(name)?.id)
          .filter((id): id is string => Boolean(id)),
        student_count: 9,
      })),
    )
    .select('id, name, course')

  if (courseGroupsError) throw courseGroupsError

  // --- 정규 시간표 ---------------------------------------------------------
  // 학급마다 월~금 1~4교시를 채운다. 교사가 겹치지 않도록 배정을 돌려 쓴다.
  //
  // 겹침 판정은 앱 본체와 똑같이 lib/scheduling/time.ts 의 overlaps() 를 쓴다.
  // "시작 시각이 같은가"로만 비교하면 안 된다 — 초등 2교시(09:50~10:30)와
  // 중학 2교시(09:55~10:40)는 시작이 달라도 09:55~10:30 이 겹친다. 예전
  // 코드는 시작 시각만 키로 써서 이 겹침을 놓쳤고, 결국 같은 교사가 두
  // 과정에 동시에 배정돼 DB 의 이중예약 방지 제약(GIST EXCLUDE)에 걸려
  // 시드 전체가 실패했다.
  const slotRows: Array<Record<string, unknown>> = []
  const teacherBusy = new Map<string, Array<{ day: number; startsMin: number; endsMin: number }>>()

  const periodByCourse = new Map<string, Array<{ no: number; start: number; end: number }>>()
  for (const [course, rows] of Object.entries(PERIODS)) {
    periodByCourse.set(
      course,
      rows
        .filter(([, , , , after]) => !after)
        .map(([no, , start, end]) => ({
          no: no as number,
          start: toMinutes(start as string),
          end: toMinutes(end as string),
        })),
    )
  }

  let rotation = 0
  for (const cls of classes ?? []) {
    const periods = periodByCourse.get(cls.course) ?? []
    for (let day = 1; day <= 5; day += 1) {
      for (const period of periods.slice(0, 4)) {
        const span = { startsMin: period.start, endsMin: period.end }

        // 그 시각에 비어 있는 교사를 찾는다
        let teacher: (typeof teachers)[number] | undefined
        for (let attempt = 0; attempt < teachers.length; attempt += 1) {
          const candidate = pick(teachers, rotation + attempt)
          const busySpans = teacherBusy.get(candidate.id) ?? []
          const clash = busySpans.some((b) => b.day === day && overlaps(span, b))
          if (!clash) {
            busySpans.push({ day, ...span })
            teacherBusy.set(candidate.id, busySpans)
            teacher = candidate
            break
          }
        }
        rotation += 1
        if (!teacher) continue

        slotRows.push({
          school_id: schoolId,
          term_id: termId,
          course: cls.course,
          day_of_week: day,
          period_no: period.no,
          class_id: cls.id,
          teacher_id: teacher.id,
          subject_id: subjectByName.get(pick(SUBJECTS, rotation)) ?? null,
        })
      }
    }
  }

  // 강사협력수업 — 고3-1 목요일 2교시에 시간강사가 함께 들어간다
  const coTeachSlot = slotRows.find(
    (row) =>
      row.class_id === classByName.get('고3-1')?.id &&
      row.day_of_week === 4 &&
      row.period_no === 2,
  )
  if (coTeachSlot) {
    coTeachSlot.co_teacher_id = staffIds.find((s) => s.name === '최나래')!.id
  }

  for (let i = 0; i < slotRows.length; i += 200) {
    const { error } = await db.from('timetable_slots').insert(slotRows.slice(i, i + 200) as never)
    if (error) throw error
  }
  log(`  시간표 ${slotRows.length}칸`)

  // --- 특별실 예약 ---------------------------------------------------------
  const reservationRows: Array<Record<string, unknown>> = []
  const roomTaken = new Set<string>() // "roomId:date:startMin"

  const bookingPlan: Array<{
    room: string
    className: string
    kind: string
    purpose: string
    dayOffset: number
    periodNo: number
    status?: string
  }> = [
    { room: '요리실습실', className: '고3-1', kind: 'vocational_practice', purpose: '샌드위치 만들기', dayOffset: 0, periodNo: 2 },
    { room: '요리실습실', className: '중2-1', kind: 'regular', purpose: '조리 실습', dayOffset: 1, periodNo: 3 },
    { room: '바리스타실습실', className: '전공과1-1', kind: 'vocational_practice', purpose: '에스프레소 추출', dayOffset: 0, periodNo: 1 },
    { room: '바리스타실습실', className: '전공과2-1', kind: 'vocational_practice', purpose: '라떼아트', dayOffset: 1, periodNo: 2 },
    { room: '제과제빵실', className: '전공과1-2', kind: 'vocational_practice', purpose: '쿠키 만들기', dayOffset: 2, periodNo: 1 },
    { room: '체육관', className: '초3-1', kind: 'regular', purpose: '체육', dayOffset: 0, periodNo: 3, status: 'pending' },
    { room: '체육관', className: '중1-1', kind: 'regular', purpose: '뉴스포츠', dayOffset: 1, periodNo: 1 },
    { room: '체육관', className: '고1-1', kind: 'afterschool', purpose: '방과후 체육', dayOffset: 2, periodNo: 7, status: 'pending' },
    { room: '감각통합실', className: '초1-1', kind: 'regular', purpose: '감각통합', dayOffset: 0, periodNo: 1 },
    { room: '감각통합실', className: '초2-1', kind: 'regular', purpose: '감각통합', dayOffset: 1, periodNo: 2 },
    { room: '스누젤렌실', className: '초1-1', kind: 'regular', purpose: '이완 활동', dayOffset: 3, periodNo: 4 },
    { room: '음악치료실', className: '중3-1', kind: 'regular', purpose: '음악치료', dayOffset: 0, periodNo: 4 },
    { room: '음악치료실', className: '고2-1', kind: 'co_teaching', purpose: '생활음악 협력수업', dayOffset: 2, periodNo: 3 },
    { room: '목공실', className: '고3-2', kind: 'vocational_practice', purpose: '수납함 제작', dayOffset: 1, periodNo: 4 },
    { room: '세탁실습실', className: '전공과2-1', kind: 'vocational_practice', purpose: '세탁 실습', dayOffset: 2, periodNo: 2 },
    { room: '컴퓨터실', className: '고1-2', kind: 'regular', purpose: '문서 작성', dayOffset: 0, periodNo: 5 },
    { room: '컴퓨터실', className: '중1-2', kind: 'regular', purpose: '정보 활용', dayOffset: 3, periodNo: 3 },
    { room: '도서실', className: '초4-1', kind: 'regular', purpose: '독서 활동', dayOffset: 1, periodNo: 5 },
    { room: '도서실', className: '초5-1', kind: 'regular', purpose: '그림책 읽기', dayOffset: 3, periodNo: 2 },
    { room: '다목적실', className: '초6-1', kind: 'onetime', purpose: '학년 모임', dayOffset: 4, periodNo: 3, status: 'pending' },
    { room: '다목적실', className: '중2-1', kind: 'onetime', purpose: '학급 회의', dayOffset: 5, periodNo: 2 },
    { room: '요리실습실', className: '전공과1-1', kind: 'vocational_practice', purpose: '급식 보조 실습', dayOffset: 3, periodNo: 1 },
    { room: '체육관', className: '고3-1', kind: 'regular', purpose: '체육', dayOffset: 4, periodNo: 2 },
    { room: '감각통합실', className: '초4-1', kind: 'regular', purpose: '감각통합', dayOffset: 4, periodNo: 1 },
    { room: '음악치료실', className: '초5-1', kind: 'regular', purpose: '음악치료', dayOffset: 5, periodNo: 3 },
    { room: '목공실', className: '전공과2-1', kind: 'vocational_practice', purpose: '조립 실습', dayOffset: 6, periodNo: 2 },
    { room: '컴퓨터실', className: '고3-2', kind: 'regular', purpose: '취업 서류 작성', dayOffset: 6, periodNo: 3 },
    { room: '도서실', className: '중3-1', kind: 'regular', purpose: '독서', dayOffset: 7, periodNo: 4 },
    { room: '바리스타실습실', className: '고3-1', kind: 'vocational_practice', purpose: '카페 운영 실습', dayOffset: 7, periodNo: 2 },
    { room: '세탁실습실', className: '전공과1-2', kind: 'vocational_practice', purpose: '다림질', dayOffset: 8, periodNo: 1 },
  ]

  for (const plan of bookingPlan) {
    const room = roomByName.get(plan.room)
    const cls = classByName.get(plan.className)
    if (!room || !cls) continue

    const date = toDate(plan.dayOffset)
    // 주말은 건너뛴다
    const weekday = addDays(today, plan.dayOffset).getDay()
    if (weekday === 0 || weekday === 6) continue

    const periodRow = (PERIODS[cls.course] ?? []).find(([no]) => no === plan.periodNo)
    if (!periodRow) continue
    const startMin = toMinutes(periodRow[2])

    // 이 시드가 만든 예약끼리 겹치면 DB 제약에 걸려 시드가 통째로 실패한다
    const key = `${room.id}:${date}:${startMin}`
    if (roomTaken.has(key)) continue
    roomTaken.add(key)

    reservationRows.push({
      school_id: schoolId,
      room_id: room.id,
      reserved_date: date,
      course: cls.course,
      period_no: plan.periodNo,
      class_id: cls.id,
      // 예약은 그 학급 담임 이름으로 들어간다
      requester_id: cls.homeroom_teacher_id ?? teachers[0]!.id,
      kind: plan.kind,
      status: plan.status ?? 'approved',
      purpose: plan.purpose,
    })
  }

  // 고교학점제 선택과목 예약.
  // 학급이 아니라 수강그룹으로 잡히므로, 소속 학급(고3-1, 고3-2)이 함께 묶인다.
  // 그 시간에 고3-1 을 다른 방에 넣으려 하면 충돌로 걸린다 — 데모에서 확인해 볼 수 있다.
  const baristaGroup = (courseGroups ?? []).find((g) => g.name === '바리스타 선택')
  if (baristaGroup) {
    const groupDate = toDate(2)
    const groupWeekday = addDays(today, 2).getDay()
    const startMin = toMinutes(PERIODS.high!.find(([no]) => no === 5)![2])
    const roomId = roomByName.get('바리스타실습실')!.id

    if (groupWeekday !== 0 && groupWeekday !== 6 && !roomTaken.has(`${roomId}:${groupDate}:${startMin}`)) {
      reservationRows.push({
        school_id: schoolId,
        room_id: roomId,
        reserved_date: groupDate,
        course: 'high',
        period_no: 5,
        course_group_id: baristaGroup.id,
        requester_id: staffIds.find((s) => s.name === '김하늘')!.id,
        kind: 'vocational_practice',
        status: 'approved',
        purpose: '선택과목 - 음료 제조',
      })
    }
  }

  const { error: reservationError } = await db
    .from('room_reservations')
    .insert(reservationRows as never)
  if (reservationError) throw reservationError
  log(`  특별실 예약 ${reservationRows.length}건 (승인 대기·선택과목 포함)`)

  // 점검으로 막아 둔 구간 하나
  await db.from('room_blackouts').insert({
    school_id: schoolId,
    room_id: roomByName.get('체육관')!.id,
    starts_on: toDate(9),
    ends_on: toDate(11),
    starts_min: 0,
    ends_min: 1440,
    reason: '바닥 보수 공사',
  })

  // --- 결과 · 결보강 -------------------------------------------------------
  const absencePlan = [
    { name: '이바다', reason: 'business_trip' as const, offset: 1, note: '특수교육 연수 참석' },
    { name: '박가온', reason: 'sick' as const, offset: 2, note: '' },
    { name: '한슬기', reason: 'training' as const, offset: 3, note: '직무연수' },
    { name: '윤아라', reason: 'annual' as const, offset: 4, note: '' },
    { name: '장미르', reason: 'official' as const, offset: 7, note: '학교 대표 회의' },
  ]

  let assignmentCount = 0
  for (const plan of absencePlan) {
    const teacher = staffIds.find((s) => s.name === plan.name)
    if (!teacher) continue

    const date = toDate(plan.offset)
    const weekday = addDays(today, plan.offset).getDay()
    if (weekday === 0 || weekday === 6) continue

    const { data: absence } = await db
      .from('absences')
      .insert({
        school_id: schoolId,
        teacher_id: teacher.id,
        starts_on: date,
        ends_on: date,
        reason: plan.reason,
        note: plan.note || null,
        created_by: teacher.id,
      })
      .select('id')
      .single()

    if (!absence) continue

    const isoDay = weekday === 0 ? 7 : weekday
    const affected = slotRows.filter(
      (row) => row.teacher_id === teacher.id && row.day_of_week === isoDay,
    )

    if (affected.length === 0) continue

    const { error } = await db.from('substitution_assignments').insert(
      affected.map((row) => ({
        school_id: schoolId,
        absence_id: absence.id,
        assign_date: date,
        course: row.course as CourseLevel,
        period_no: row.period_no as number,
        class_id: row.class_id as string,
        subject_id: (row.subject_id as string) ?? null,
        status: 'pending' as const,
      })) as never,
    )
    if (error) throw error
    assignmentCount += affected.length
  }
  log(`  결과 ${absencePlan.length}건 → 보강 대상 ${assignmentCount}개`)

  // --- 학사일정 ------------------------------------------------------------
  const eventRows = EVENT_SEED.map((event) => {
    const cls = event.className ? classByName.get(event.className) : undefined
    return {
      school_id: schoolId,
      title: event.title,
      detail: event.detail ?? null,
      starts_on: toDate(event.offsetDays),
      ends_on: toDate(event.offsetDays + (event.lengthDays ?? 1) - 1),
      all_day: true,
      scope: event.scope,
      scope_course: event.courseKey ?? null,
      scope_grade: event.grade ?? null,
      scope_class_id: cls?.id ?? null,
      category: event.category,
      source: 'manual',
    }
  })
  const { error: eventError } = await db.from('academic_events').insert(eventRows as never)
  if (eventError) throw eventError
  log(`  학사일정 ${eventRows.length}건`)

  // --- 학생 (가명) ---------------------------------------------------------
  // 실명은 저장하지 않는다. 학번과 이니셜만 둔다.
  const studentRows = (classes ?? []).flatMap((cls, classIndex) =>
    Array.from({ length: cls.student_count }, (_, i) => ({
      school_id: schoolId,
      class_id: cls.id,
      student_code: `${year}${String(classIndex + 1).padStart(2, '0')}${String(i + 1).padStart(2, '0')}`,
      display_name: `${cls.name} ${i + 1}번`,
    })),
  )
  await db.from('students').insert(studentRows)
  log(`  학생 ${studentRows.length}명 (가명처리 — 실명 없음)`)

  // --- 결보강 가중치 기본값 ------------------------------------------------
  await db.from('substitution_rules').insert({ school_id: schoolId })

  log('\n끝났습니다. 아래 계정으로 로그인해 보세요.\n')
  for (const account of DEMO_ACCOUNTS) {
    log(`  ${account.email.padEnd(24)} ${DEMO_PASSWORD}   ${account.note}`)
  }
  log('\n나머지 교직원 계정은 staff1@hanbit.demo ~ staff21@hanbit.demo 입니다.')

  return {
    schoolName: DEMO_SCHOOL.name,
    staff: staffIds.length,
    classes: classes?.length ?? 0,
    rooms: rooms?.length ?? 0,
    slots: slotRows.length,
    reservations: reservationRows.length,
    substitutions: assignmentCount,
    events: eventRows.length,
    students: studentRows.length,
    accounts: DEMO_ACCOUNTS.map((account) => ({
      email: account.email,
      password: DEMO_PASSWORD,
      note: account.note,
    })),
  }
}
