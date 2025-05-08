import { useRouter } from 'next/router'
import React from 'react'
import Container from '@/components/layout/Container'

export default function ComingSoon() {
  const router = useRouter()
  const { from } = router.query

  return (
    <Container>
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <h1 className="text-4xl font-bold mb-4 font-GoodTimes">Coming Soon!</h1>
        <p className="text-xl text-center mb-8">
          We're working hard to bring you{' '}
          {from ? `the ${from} page` : 'this feature'}. Stay tuned for updates!
        </p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2 bg-primary text-white rounded-lg gradient-2"
        >
          Return Home
        </button>
      </div>
    </Container>
  )
}
