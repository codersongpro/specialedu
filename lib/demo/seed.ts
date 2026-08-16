import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, format } from 'date-fns'
import { formatWon } from '@/lib/format'
import { encryptSecret } from '@/lib/security/crypto'
import type { Database } from '@/lib/supabase/database.types'
import { overlaps } from '@/lib/scheduling/time'
import {
  BEHAVIOR_CATEGORIES,
  BUDGET_EXPENSE_DESCRIPTIONS,
  BUDGET_LINE_NAMES,
  CLASSES,
  COURSE_GROUPS,
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  DEMO_SCHOOL,
  DEPARTMENTS,
  EVENT_SEED,
  EXTRA_STAFF,
  IEP_GOAL_TEMPLATES,
  IEP_PROGRESS_NOTES,
  PERIODS,
  ROOM_BOOKING_PROFILE,
  ROOMS,
  SAFETY_PROTOCOL_TEMPLATES,
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
  safetyProtocols: number
  iepGoals: number
  budgetExpenses: number
  notifications: number
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
  const randPick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]!
  const randInt = (min: number, max: number): number =>
    min + Math.floor(Math.random() * (max - min + 1))

  log('데모 데이터를 만듭니다...')

  // --- 기존 데모 학교 정리 -------------------------------------------------
  //
  // profiles 를 거쳐 auth 사용자를 찾으면 안 된다. 예전에 여기서 profiles 로
  // 대상을 찾았는데, deleteUser 가 한 명이라도 실패하면(레이스·일시 오류)
  // 그 뒤 school 삭제로 profiles 행만 cascade 로 사라지고 auth.users 에는
  // 이메일이 그대로 남는 "고아 계정"이 생겼다. 다음 날 같은 이메일로
  // createUser 를 다시 부르면 "이미 등록된 이메일"로 실패해 시드 전체가
  // 매번 같은 지점에서 죽고, 그 이메일은 profiles 가 없는 채로 로그인만
  // 되는 상태(체험하기 버튼이 "데모용이 아닙니다"로 막히는 원인)로 영영
  // 남았다. 그래서 auth.users 목록에서 @hanbit.demo 이메일을 직접 찾아
  // 전부 지운다 — profiles 존재 여부와 무관하게 지워야 고아가 남지 않는다.
  for (let page = 1; ; page += 1) {
    const { data: userPage, error: listError } = await db.auth.admin.listUsers({
      page,
      perPage: 200,
    })
    if (listError) throw listError
    const demoUsers = userPage.users.filter((u) => u.email?.endsWith('@hanbit.demo'))
    for (const demoUser of demoUsers) {
      await db.auth.admin.deleteUser(demoUser.id).catch(() => undefined)
    }
    if (userPage.users.length < 200) break
  }

  const { data: existing } = await db.from('schools').select('id').eq('is_demo', true)
  for (const school of existing ?? []) {
    // 남은 것은 school 행 자체뿐이다. profiles 등은 on delete cascade 로 함께 지워진다.
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

  // --- 특별실 예약 (무작위 생성) ---------------------------------------------
  //
  // 예전에는 예약 30건을 하나하나 손으로 지정해서, 캘린더를 한 달 넘게
  // 넘겨보면 앞쪽 며칠 말고는 텅 비어 보였다. 지금은 방 유형별로 어울리는
  // 과정·사유 후보(ROOM_BOOKING_PROFILE)를 두고, 평일 5주 치를 무작위로
  // 채운다. 실행할 때마다 다른 조합이 나오지만, 겹침은 여전히 막는다 —
  // 같은 방·같은 날짜에 시간이 겹치는 예약 두 개가 들어가면 DB 이중예약
  // 방지 제약(GIST EXCLUDE)에 걸려 시드 전체가 실패하기 때문이다.
  const reservationRows: Array<Record<string, unknown>> = []
  const roomSpans = new Map<string, Array<{ startsMin: number; endsMin: number }>>() // "roomId:date"

  const bookRoom = (
    roomId: string,
    date: string,
    span: { startsMin: number; endsMin: number },
  ): boolean => {
    const key = `${roomId}:${date}`
    const spans = roomSpans.get(key) ?? []
    if (spans.some((s) => overlaps(s, span))) return false
    spans.push(span)
    roomSpans.set(key, spans)
    return true
  }

  const DEFAULT_ROOM_PROFILE = {
    courses: ['elementary', 'middle', 'high', 'vocational'],
    purposes: ['수업 활동'],
    kind: 'regular',
  }

  // 고교학점제 선택과목 예약부터 먼저 자리를 잡는다.
  // 학급이 아니라 수강그룹으로 잡히므로, 소속 학급(고3-1, 고3-2)이 함께 묶인다.
  // 그 시간에 고3-1 을 다른 방에 넣으려 하면 충돌로 걸린다 — 데모에서 확인해 볼 수 있다.
  const baristaGroup = (courseGroups ?? []).find((g) => g.name === '바리스타 선택')
  if (baristaGroup) {
    const groupDate = toDate(2)
    const groupWeekday = addDays(today, 2).getDay()
    const periodRow = PERIODS.high!.find(([no]) => no === 5)!
    const span = { startsMin: toMinutes(periodRow[2]), endsMin: toMinutes(periodRow[3]) }
    const roomId = roomByName.get('바리스타실습실')!.id

    if (groupWeekday !== 0 && groupWeekday !== 6 && bookRoom(roomId, groupDate, span)) {
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

  // 평일 -14일 ~ +24일(약 5주 반)을 후보 날짜로 삼는다 — 캘린더를 앞뒤로
  // 넘겨봐도 예약이 보이도록 과거·미래를 함께 채운다.
  const bookingDateOffsets = Array.from({ length: 39 }, (_, i) => i - 14).filter((offset) => {
    const weekday = addDays(today, offset).getDay()
    return weekday !== 0 && weekday !== 6
  })

  for (const roomSeed of ROOMS) {
    const room = roomByName.get(roomSeed.name)
    if (!room) continue
    const profile = ROOM_BOOKING_PROFILE[roomSeed.type] ?? DEFAULT_ROOM_PROFILE
    const courseCandidates = (classes ?? []).filter((c) => profile.courses.includes(c.course))
    if (courseCandidates.length === 0) continue

    // 방마다 이번 시드에서 목표로 삼는 예약 건수 — 방 하나당 8~14건 정도면
    // 5주 동안 주 2회쯤 잡힌 것처럼 보인다.
    const target = randInt(8, 14)
    let booked = 0
    // 목표 건수를 채우다 겹침으로 실패하는 시도가 있을 수 있어 여유 있게 시도한다.
    for (let attempt = 0; attempt < target * 3 && booked < target; attempt += 1) {
      const offset = randPick(bookingDateOffsets)
      const date = toDate(offset)
      // 체육관 점검 기간(+9~+11일)은 피한다 — 아래에서 그 구간에 blackout 을 넣는다.
      if (roomSeed.name === '체육관' && offset >= 9 && offset <= 11) continue

      const cls = randPick(courseCandidates)
      const periodRows = PERIODS[cls.course] ?? []
      if (periodRows.length === 0) continue
      const periodRow = randPick(periodRows)
      const span = { startsMin: toMinutes(periodRow[2]), endsMin: toMinutes(periodRow[3]) }

      if (!bookRoom(room.id, date, span)) continue

      const status = room.requires_approval && Math.random() < 0.2 ? 'pending' : 'approved'

      reservationRows.push({
        school_id: schoolId,
        room_id: room.id,
        reserved_date: date,
        course: cls.course,
        period_no: periodRow[0],
        class_id: cls.id,
        // 예약은 그 학급 담임 이름으로 들어간다
        requester_id: cls.homeroom_teacher_id ?? teachers[0]!.id,
        kind: profile.kind,
        status,
        purpose: randPick(profile.purposes),
      })
      booked += 1
    }
  }

  const { error: reservationError } = await db
    .from('room_reservations')
    .insert(reservationRows as never)
  if (reservationError) throw reservationError
  log(`  특별실 예약 ${reservationRows.length}건 (5주 치 무작위 · 승인 대기·선택과목 포함)`)

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
  const { data: students, error: studentsError } = await db
    .from('students')
    .insert(studentRows)
    .select('id')
  if (studentsError) throw studentsError
  log(`  학생 ${studentRows.length}명 (가명처리 — 실명 없음)`)

  // --- PBS 행동유형 + 기록 샘플 ---------------------------------------------
  const { data: behaviorCategories, error: categoriesError } = await db
    .from('behavior_categories')
    .insert(BEHAVIOR_CATEGORIES.map((name, index) => ({ school_id: schoolId, name, sort_order: index })))
    .select('id')
  if (categoriesError) throw categoriesError

  const pbsStudents = (students ?? []).slice(0, 4)
  const pbsRows = pbsStudents.flatMap((student, si) =>
    Array.from({ length: 6 }, (_, i) => {
      const daysAgo = i * 6 + si * 2
      const category = pick(behaviorCategories ?? [], si + i)
      return {
        school_id: schoolId,
        student_id: student.id,
        category_id: category?.id ?? null,
        occurred_at: addDays(today, -daysAgo).toISOString(),
        location: pick(['교실', '운동장', '급식실', '복도'], si + i),
        recorded_by: teachers[0]!.id,
        note_enc: i % 3 === 0 ? encryptSecret('짧게 진정 시간을 가진 뒤 스스로 돌아옴') : null,
      }
    }),
  )
  if (pbsRows.length > 0) {
    const { error: pbsError } = await db.from('pbs_records').insert(pbsRows)
    if (pbsError) throw pbsError
  }
  log(`  PBS 기록 ${pbsRows.length}건 (학생 ${pbsStudents.length}명)`)

  // --- 안전 프로토콜 샘플 (발작·알레르기·연하곤란 등) ------------------------
  // 학생마다 7명 중 1명꼴로 표본을 붙인다 — 실제로는 전체 학생 중 일부만
  // 해당하는 정보라 전원에게 넣으면 오히려 비현실적이다.
  const safetyStudents = (students ?? []).filter((_, i) => i % 7 === 0)
  const safetyAuthor = staffIds.find((s) => s.role === 'admin')?.id ?? teachers[0]!.id
  const safetyRows = safetyStudents.map((student, i) => {
    const template = pick(SAFETY_PROTOCOL_TEMPLATES, i)
    return {
      school_id: schoolId,
      student_id: student.id,
      category: template.category,
      title: template.title,
      content_enc: encryptSecret(template.content),
      created_by: safetyAuthor,
    }
  })
  if (safetyRows.length > 0) {
    const { error: safetyError } = await db.from('safety_protocols').insert(safetyRows)
    if (safetyError) throw safetyError
  }
  log(`  안전 프로토콜 ${safetyRows.length}건 (학생 ${safetyStudents.length}명)`)

  // --- IEP 목표·진도 샘플 ---------------------------------------------------
  // 학생 5명 중 1명꼴로 목표 2개씩 붙이고, 각 목표에 최근 4주간 진도 기록을
  // 3건씩 채워 화면에서 추세(좋아지는 중/제자리)가 바로 보이게 한다.
  const iepStudents = (students ?? []).filter((_, i) => i % 5 === 0)
  const iepAuthor = teachers[0]!.id
  const LEVEL_PROGRESSION: Array<'full_help' | 'partial_help' | 'independent'> = [
    'full_help',
    'partial_help',
    'independent',
  ]
  const iepGoalRows = iepStudents.flatMap((student, si) =>
    [0, 1].map((gi) => {
      const template = pick(IEP_GOAL_TEMPLATES, si * 2 + gi)
      return {
        school_id: schoolId,
        student_id: student.id,
        area: template.area,
        title: template.title,
        term_label: `${year}학년도 2학기`,
        created_by: iepAuthor,
      }
    }),
  )
  const { data: iepGoals, error: iepGoalsError } =
    iepGoalRows.length > 0
      ? await db.from('iep_goals').insert(iepGoalRows).select('id')
      : { data: [], error: null }
  if (iepGoalsError) throw iepGoalsError

  const iepProgressRows = (iepGoals ?? []).flatMap((goal, gi) =>
    [28, 14, 0].map((daysAgo, li) => ({
      school_id: schoolId,
      goal_id: goal.id,
      occurred_on: toDate(-daysAgo),
      level: LEVEL_PROGRESSION[li]!,
      note_enc: (gi + li) % 3 === 0 ? encryptSecret(pick(IEP_PROGRESS_NOTES, gi + li)) : null,
      recorded_by: iepAuthor,
    })),
  )
  if (iepProgressRows.length > 0) {
    const { error: iepProgressError } = await db.from('iep_progress').insert(iepProgressRows)
    if (iepProgressError) throw iepProgressError
  }
  log(`  IEP 목표 ${iepGoalRows.length}건 (학생 ${iepStudents.length}명) · 진도 기록 ${iepProgressRows.length}건`)

  // --- 예산(살림) 샘플 -------------------------------------------------------
  // 체험하기로 들어갔을 때 "살림" 메뉴가 비어 보이지 않도록, 부서별·학급별
  // 예산 항목과 승인 대기·승인·반려가 섞인 지출 신청을 채운다.
  const budgetAdmin = staffIds.find((s) => s.role === 'admin')?.id ?? teachers[0]!.id

  const budgetLineRows: Array<Record<string, unknown>> = []
  for (const deptId of deptByName.values()) {
    budgetLineRows.push({
      school_id: schoolId,
      fiscal_year: year,
      scope: 'department',
      department_id: deptId,
      name: randPick(BUDGET_LINE_NAMES),
      allocated_amount: randInt(30, 200) * 10000,
      created_by: budgetAdmin,
    })
  }
  const budgetClasses = (classes ?? []).filter((_, i) => i % 4 === 0)
  for (const cls of budgetClasses) {
    budgetLineRows.push({
      school_id: schoolId,
      fiscal_year: year,
      scope: 'class',
      class_id: cls.id,
      name: randPick(BUDGET_LINE_NAMES),
      allocated_amount: randInt(10, 60) * 10000,
      created_by: budgetAdmin,
    })
  }

  const { data: budgetLines, error: budgetLinesError } = await db
    .from('budget_lines')
    .insert(budgetLineRows as never)
    .select('id, allocated_amount')
  if (budgetLinesError) throw budgetLinesError

  const budgetExpenseRows: Array<Record<string, unknown>> = []
  for (const line of budgetLines ?? []) {
    const count = randInt(2, 4)
    for (let i = 0; i < count; i += 1) {
      const roll = Math.random()
      const status = roll < 0.7 ? 'approved' : roll < 0.9 ? 'pending' : 'rejected'
      const amount = Math.min(line.allocated_amount, randInt(3, 25) * 10000)
      const requester = randPick(teachers)

      const row: Record<string, unknown> = {
        school_id: schoolId,
        budget_line_id: line.id,
        requested_by: requester.id,
        amount,
        description: randPick(BUDGET_EXPENSE_DESCRIPTIONS),
        spent_on: toDate(-randInt(0, 45)),
        status,
      }
      if (status !== 'pending') {
        row.reviewed_by = budgetAdmin
        row.reviewed_at = new Date().toISOString()
        if (status === 'rejected') row.reject_reason = '올해 예산을 초과해 반려합니다'
      }
      budgetExpenseRows.push(row)
    }
  }

  const { data: budgetExpenses, error: budgetExpensesError } = await db
    .from('budget_expenses')
    .insert(budgetExpenseRows as never)
    .select('id, requested_by, amount, description, status')
  if (budgetExpensesError) throw budgetExpensesError
  log(`  예산 항목 ${budgetLineRows.length}개 · 지출 ${budgetExpenseRows.length}건`)

  // --- 알림 샘플 --------------------------------------------------------------
  // 지출 승인·반려 결과를 신청한 사람에게 알림으로 보낸다 — 실제 앱이
  // reviewExpense()에서 하는 것과 같은 모양이다. 체험하기로 teacher@ 등을
  // 뽑아 들어갔을 때 종 모양 알림 아이콘이 비어 있지 않게 하려는 목적.
  const notificationRows = (budgetExpenses ?? [])
    .filter((expense) => expense.status !== 'pending')
    .map((expense) => {
      const daysAgo = randInt(0, 10)
      const createdAt = addDays(today, -daysAgo).toISOString()
      return {
        school_id: schoolId,
        profile_id: expense.requested_by!,
        title: expense.status === 'approved' ? '지출 신청이 승인되었습니다' : '지출 신청이 반려되었습니다',
        body: `${formatWon(expense.amount)} · ${expense.description}`,
        link: '/budget',
        read_at: Math.random() < 0.5 ? createdAt : null,
        created_at: createdAt,
      }
    })
  if (notificationRows.length > 0) {
    const { error: notificationError } = await db.from('notifications').insert(notificationRows)
    if (notificationError) throw notificationError
  }
  log(`  알림 ${notificationRows.length}건`)

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
    safetyProtocols: safetyRows.length,
    iepGoals: iepGoalRows.length,
    budgetExpenses: budgetExpenseRows.length,
    notifications: notificationRows.length,
    accounts: DEMO_ACCOUNTS.map((account) => ({
      email: account.email,
      password: DEMO_PASSWORD,
      note: account.note,
    })),
  }
}
