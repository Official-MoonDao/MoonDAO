import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import React, { useRef, useState, useEffect } from 'react'
import { Camera } from 'three'

export function Moon() {
  const { nodes, materials } = useGLTF('/textures/moon.glb')
  const [isMobile, setIsMobile] = useState(false)
  const { camera, viewport } = useThree()
  const moonRef = useRef()
  useEffect(() => {
    if (viewport.width < 800) camera.position.set(2.5, 0, 5)
    else camera.position.set(0, 0, 5)
    camera.aspect = viewport.width / viewport.height
    camera.updateProjectionMatrix()
  }, [viewport.width])
  useFrame(() => {
    if (moonRef.current) {
      moonRef.current.rotation.y += 0.0005
    }
  })

  return (
    <group
      dispose={null}
      position={[5, -2.5, -1]}
      rotation={[Math.PI / 8, 0, 0]}
      ref={moonRef}
    >
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <group rotation={[Math.PI / 2, 0, 0]}>
          <group rotation={[-Math.PI / 2, 0, 0]} scale={4}>
            <mesh
              castShadow
              receiveShadow
              geometry={nodes.Sphere_Material002_0.geometry}
              material={materials['Material.002']}
            />
          </group>
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/textures/moon.glb')
