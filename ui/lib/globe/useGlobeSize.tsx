import { useEffect, useState } from 'react'

export default function useGlobeSize() {
  const [size, setSize] = useState({ width: 500, height: 500 })

  useEffect(() => {
    function getSize() {
      if (typeof window !== 'undefined') {
        let width
        if (window.innerWidth > 1500) {
          width = 1000
        } else if (window.innerWidth > 500) {
          width = window.innerWidth * 0.6
        } else {
          width = window.innerWidth * 0.9
        }
        setSize({ width, height: width })
      }
    }
    getSize()

    window.addEventListener('resize', getSize)

    return () => window.removeEventListener('resize', getSize)
  }, [])

  return size
}
