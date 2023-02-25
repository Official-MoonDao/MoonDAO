import { Effects } from '@react-three/drei'
import { Canvas, extend, useThree } from '@react-three/fiber'
import { Suspense } from 'react'
import Bloom from './Bloom'
import { Moon } from './Moon'

export function Scene({ zoomEnabled = false }) {
  return (
    <Suspense fallback={null}>
      <Canvas
        className={'animate-fadeIn'}
        style={{
          position: 'absolute',
          top: '0%',
          left: '0%',
          zIndex: '-1',
        }}
        camera={{
          fov: 45,
          near: 1,
          far: 1000,
          position: [0, 0, 5],
        }}
      >
        <Bloom>
          <hemisphereLight args={['slateblue', 'lightblue', 0.75]} />
          <pointLight position={[-2, 1, 4]} color={'white'} intensity={0.08} />
          <Moon hoverEnabled={hoverEnabled} />
        </Bloom>
      </Canvas>
    </Suspense>
  )
}
