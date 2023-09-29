import { Circle } from 'rc-progress'
import { useEffect, useState } from 'react'

export function AnalyticsProgress({ value }: any) {
  const [progress, setProgress] = useState<number>(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prevProgress: any) => {
        if (prevProgress < value) {
          return prevProgress + 0.2
        } else {
          clearInterval(interval)
          return prevProgress
        }
      })
    }, 50)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-2 justify-center">
      <p className="absolute font-bold text-2xl text-black dark:text-white">
        {progress.toFixed(1) + '%'}
      </p>
      <div className="w-1/3">
        <Circle
          className=""
          percent={progress}
          strokeWidth={6}
          strokeColor={'#F9B95C'}
          trailColor={'#F9B95C50'}
          trailWidth={6}
        />
      </div>
    </div>
  )
}
