import { extend, useFrame, useThree, useSuspense } from '@react-three/fiber'
import { useEffect, useRef, useMemo } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass'

extend({ EffectComposer, RenderPass, UnrealBloomPass })

export default function Bloom({ children }) {
  const { gl, camera, size } = useThree()
  const ref = useRef()
  const composer = useRef()
  const aspect = useMemo(
    () => new THREE.Vector2(size.width, size.height),
    [size]
  )
  useEffect(
    () => void ref.current && composer.current.setSize(size.width, size.height),
    [ref, size]
  )
  useFrame(() => ref.current && composer.current.render(), 1)
  return (
    <>
      <scene ref={ref} style={{ background: 'transparent' }}>
        {children}
      </scene>
      <effectComposer ref={composer} args={[gl]}>
        <renderPass attachArray="passes" scene={ref.current} camera={camera} />
        <unrealBloomPass attachArray="passes" args={[aspect, 0.25, 8.5, 0]} />
      </effectComposer>
    </>
  )
}
