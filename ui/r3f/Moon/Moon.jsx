import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import React, { useRef, useState, useEffect } from 'react'
import { Camera } from 'three'

export function Moon({ zoomEnabled = false }) {
  const { nodes, materials } = useGLTF('/textures/the_moon.glb')
  const [isMobile, setIsMobile] = useState(false)
  const { camera, viewport } = useThree()
  const [hover, setHover] = useState(false)
  const moonRef = useRef()
  const moonMeshRef = useRef()
  useEffect(() => {
    if (viewport.width < 800) camera.position.set(4.5, 0, 5)
    else camera.position.set(0, 0, 5)
    camera.aspect = viewport.width / viewport.height
    camera.updateProjectionMatrix()
  }, [viewport.width])

  useFrame(() => {
    if (moonRef.current) {
      moonRef.current.rotation.y += 0.0005
      if (zoomEnabled)
        setTimeout(() => {
          gsap.to(camera.position, {
            z: viewport.height < 800 ? 7 : 9,
            y: -1.5,
            duration: 10,
          })
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
    >
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <group rotation={[Math.PI / 2, 0, -Math.PI / 16]} scale={2.9}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes.defaultMaterial.geometry}
            material={materials.Material__50}
            ref={moonMeshRef}
          />
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/textures/the_moon.glb')
