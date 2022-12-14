import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import Bloom from '../Moon/Bloom'
import { GroupControl } from './GroupControl'

export function WrappedScene({ userData }) {
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
          <ambientLight intensity={0.05} />
          <directionalLight position={[10, -10, 8]} intensity={0.4} />
          <GroupControl userData={userData} />
        </Bloom>
      </Canvas>
    </Suspense>
  )
}
