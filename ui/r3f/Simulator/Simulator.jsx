import { Stats } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useState } from 'react'

export default function Simulator(props) {
  const [scene, setScene] = useState('moon')
  const testing = true

  return (
    <Canvas shadows flat>
      {testing && (
        <>
          <Stats />
        </>
      )}
      <Suspense fallback={null}>
        {scene === 'moon' && <MoonScene />}
        {scene === 'base' && <BaseScene />}
      </Suspense>
    </Canvas>
  )
}
