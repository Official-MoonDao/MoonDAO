//Deprecated /zero-g for /zero-gravity 5/8/2024
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function ZeroG() {
  const router = useRouter()

  useEffect(() => {
    router.push('/zero-gravity')
  }, [])
}
