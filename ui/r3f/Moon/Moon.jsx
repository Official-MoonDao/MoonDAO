import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import React, { useRef, useState, useEffect } from 'react'
import { Camera } from 'three'

export function Moon({ hoverEnabled = false }) {
  const { nodes, materials } = useGLTF('/textures/the_moon.glb')
  const [isMobile, setIsMobile] = useState(false)
  const { camera, viewport } = useThree()
  const [hover, setHover] = useState(false)
  const moonRef = useRef()
  useEffect(() => {
    if (viewport.width < 800) camera.position.set(4.5, 0, 5)
    else camera.position.set(0, 0, 5)
    camera.aspect = viewport.width / viewport.height
    camera.updateProjectionMatrix()
  }, [viewport.width])

  useFrame(() => {
    if (moonRef.current) {
      moonRef.current.rotation.y += 0.0005
      if (hoverEnabled)
        setTimeout(() => {
          gsap.to(camera.position, { z: 11, y: -1.5, duration: 10 })
          gsap.to(camera.rotation, {
            y: -Math.PI / 27,
            z: Math.PI / 10,
            duration: 10,
          })
        }, 500)
    }
  })

  return (
    <group
      dispose={null}
      position={[7, -1.5, -1]}
      rotation={[Math.PI / 8, Math.PI / 4, 0]}
      ref={moonRef}
      onPointerEnter={() => hoverEnabled && setHover(true)}
      onPointerLeave={() => hoverEnabled && setHover(false)}
    >
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <group rotation={[Math.PI / 2, 0, -Math.PI / 16]} scale={2.9}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.defaultMaterial.geometry}
            material={materials.Material__50}
          />
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/textures/the_moon.glb')
