import { useState, useEffect } from 'react'

export default function useMouse() {
  const [mouseX, setMouseX] = useState(0)
  const [blur, setBlur] = useState(0)
  let width: any
  useEffect(() => {
    width = window?.innerWidth
    document.addEventListener('mousemove', (e) => {
      e.preventDefault()
      setBlur((width - e.x) * 0.0015)
      if (e.x > width * 0.5) setBlur(0)
      if (e.x > width * 0.2 && e.x < width * 0.8) setMouseX(e.movementX * 0.055)
      else setMouseX(0)
    })
  }, [])
  return { mouseX, blur }
}
