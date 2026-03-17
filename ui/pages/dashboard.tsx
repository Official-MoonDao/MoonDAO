import { useRouter } from 'next/router'
import { useEffect } from 'react'
import Container from '../components/layout/Container'
import { LoadingSpinner } from '../components/layout/LoadingSpinner'

export default function Dashboard() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/')
  }, [router])

  return (
    <Container>
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner width="w-12" height="h-12" />
      </div>
    </Container>
  )
}
