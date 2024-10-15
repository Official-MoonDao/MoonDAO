import { Circle } from 'rc-progress'
import { useEffect, useState } from 'react'

export function AnalyticsProgress({ value }: any) {
  const [progress, setProgress] = useState<number>(0)

  useEffect(() => {
    setProgress(0)
    const interval = setInterval(() => {
      setProgress((prevProgress: any) => {
        if (prevProgress < value) {
          return prevProgress + 0.2
        } else {
          clearInterval(interval)
          return prevProgress
        }
      })
    }, 25)

    return () => clearInterval(interval)
  }, [value])

  return (
    <div className="flex items-center gap-2 justify-center">
      <p className="absolute font-bold text-2xl text-black dark:text-white">
        {progress.toFixed(1) + '%'}
      </p>
      <div className="w-[120px]">
        <Circle
          className=""
          percent={progress}
          strokeWidth={13}
          strokeColor={'#D7594F'}
          trailColor={'#D7594F2B'}
          trailWidth={13}
        />
      </div>
    </div>
  )
}
