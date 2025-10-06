import { useRouter } from 'next/router'
import { useEffect } from 'react'

export const PAGE_FLAGS: string[] =
  process.env.NEXT_PUBLIC_ENV === 'dev' ? [] : []

export function FlagProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  useEffect(() => {
    const path = router.pathname
    if (PAGE_FLAGS.includes(path)) {
      console.log('Redirecting to coming soon...')
      router.replace({
        pathname: '/coming-soon',
        query: { from: path.replace('/', '') },
      })
    }
  }, [router.pathname])

  return children
}
