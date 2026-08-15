import fs from 'node:fs'
import path from 'node:path'
import { marked } from 'marked'
import Link from 'next/link'
import { AppMark } from '@/components/brand'

/**
 * docs/사용설명서.md 를 그대로 읽어 렌더링한다. 문서를 두 곳(저장소·화면)에
 * 따로 관리하면 반드시 하나가 낡으므로, 화면은 파일 하나만 본다.
 * 로그인 여부와 무관하게 열려야 해서(로그인 화면에서도 링크가 필요) 이
 * 경로는 middleware.ts 의 PUBLIC_PATHS 에 들어 있다.
 */
export const metadata = { title: '사용 설명서' }

export default function HelpPage() {
  const filePath = path.join(process.cwd(), 'docs', '사용설명서.md')
  const markdown = fs.readFileSync(filePath, 'utf-8')
  const html = marked.parse(markdown, { async: false }) as string

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 text-ink">
          <AppMark size={28} />
          <span className="text-lg font-semibold">한아름</span>
        </Link>
        <Link href="/" className="text-[15px] font-medium text-brand hover:underline">
          메인으로
        </Link>
      </div>
      {/* html 은 저장소 안 docs/사용설명서.md 를 그대로 렌더링한 것이라 신뢰할 수 있다 */}
      <article className="help-prose" dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  )
}
