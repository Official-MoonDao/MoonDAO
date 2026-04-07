import { useEffect, useState } from 'react'

//Get the current unix time at a configurable interval (default: 60 seconds)
export default function useCurrUnixTime(intervalMs: number = 60000) {
  const [time, setTime] = useState(Math.floor(Date.now() / 1000))

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(Math.floor(Date.now() / 1000))
    }, intervalMs)
    return () => clearInterval(interval)
  }, [intervalMs])

  return time
}
