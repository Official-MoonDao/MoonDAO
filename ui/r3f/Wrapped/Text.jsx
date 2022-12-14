import { extend, useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader'
import goodtimes from '../../public/fonts/goodtimes.json'

extend({ TextGeometry })
export function Text(props) {
  const { position, size } = props
  const { viewport, camera } = useThree()
  const offsetX = props.offsetX || 0
  const font = new FontLoader().parse(goodtimes)
  const textRef = useRef()

  return (
    <mesh
      position={[
        -props.size * viewport.width * 0.05 * 3 + offsetX || 0,
        -0.5,
        -0.25,
      ]}
      rotation={props.rotation}
      receiveShadow
      castShadow
      ref={textRef}
    >
      <textGeometry
        args={[
          props.text,
          {
            font,
            size: props.size * viewport.width * 0.08,
            height: props.height || 0.25,
          },
        ]}
      />
      <meshLambertMaterial
        attach="material"
        color={props.color || 'white'}
        transparent
        emissive={true}
        emissiveIntensity={10}
      />
    </mesh>
  )
}
