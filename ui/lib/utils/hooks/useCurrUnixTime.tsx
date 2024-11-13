import { useEffect, useState } from 'react'

//Get the current unix time every second
export default function useCurrUnixTime() {
  const [time, setTime] = useState(Math.floor(Date.now() / 1000))

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return time
}
