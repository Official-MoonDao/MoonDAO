import { useEffect, useState } from 'react'

export default function useGlobeSize() {
  const [size, setSize] = useState({ width: 500, height: 500 })
  useEffect(() => {
    let width, height
    if (window?.innerWidth > 1000) {
      width = 1000
    } else if (window?.innerWidth > 500) {
      width = window.innerWidth * 0.6
    } else {
      width = window.innerWidth * 0.8
    }
    height = width
    setSize({ width, height })
  }, [])
  return size
}
