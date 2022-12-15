import { useGLTF, useAnimations, useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import React, { useRef, useEffect, useState } from 'react'
import { MooneyCoin } from './MooneyCoin'
import { Text } from './Text'

export function SnowGlobe(props) {
  const group = useRef()
  const snowRef = useRef()
  const instructionRef = useRef()
  const { camera } = useThree()
  const { nodes, materials, animations } = useGLTF('/textures/snowglobe.glb')
  const logo = useTexture('/Original.png')
  const { actions } = useAnimations(animations, group)
  const [hover, setHover] = useState(false)
  useFrame(({ clock, mouse }) => {
    const time = clock.getElapsedTime()
    const speed = hover ? 10 : 5
    if (snowRef.current) {
      snowRef.current.rotation.y += 0.001 * speed
    }

    if (group.current) {
      group.current.rotation.y = Math.sin(time * 0.1) * 0.025
      group.current.rotation.z = Math.cos(time * 0.1) * 0.15
      group.current.rotation.x = Math.cos(time * 0.25) * 0.075
      if (hover) {
        gsap.to(group.current.position, {
          duration: 2,
          x: 0.5,
          y: -1.5,
          z: 2,
        })
      } else
        gsap.to(group.current.position, { duration: 2, x: 0.5, y: -1, z: 0 })
    }
    if (instructionRef.current) {
      if (hover) {
        gsap.to(instructionRef.current.position, {
          duration: 1.5,
          x: -0.75,
          y: 2.5,
          z: -0.5,
        })
      } else {
        gsap.to(instructionRef.current.position, {
          duration: 2,
          x: -0.25,
          y: 0.5,
          z: -0.5,
        })
      }
    }
  })
  return (
    <group
      ref={group}
      {...props}
      dispose={null}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onClick={() => {
        props.onClick()
      }}
    >
      <group position={[-0.25, 0.5, -0.5]} ref={instructionRef}>
        <Text
          text={props.noWallet ? 'connect \nwallet' : 'click\nto\ncontinue'}
          size={0.3}
          height={0.0025}
        />
      </group>
      <group name="Sketchfab_Scene">
        <group
          name="Sketchfab_model"
          rotation={[-Math.PI / 2, 0, 0]}
          scale={0.3}
        >
          <group name="root">
            <group name="GLTF_SceneRootNode" rotation={[Math.PI / 2, 0, 0]}>
              <group name="Glass_ball_0" position={[0, 0.02, 0]} scale={20.03}>
                <mesh
                  name="Object_4"
                  castShadow
                  receiveShadow
                  geometry={nodes.Object_4.geometry}
                  material={materials.Glass}
                >
                  <meshLambertMaterial
                    color={'white'}
                    opacity={0.075}
                    transparent
                    emissive={'navy'}
                    emissiveIntensity={0}
                  />
                </mesh>
                <MooneyCoin position={[0, 0.27, 0]} />
              </group>
              <group name="Base_White_1" position={[0, 2.11, 0]} scale={3.21}>
                <mesh
                  name="Object_6"
                  castShadow
                  receiveShadow
                  geometry={nodes.Object_6.geometry}
                  material={materials.Base}
                />
              </group>
              <group name="Base_Grey_2" position={[0, 2.11, 0]} scale={3.08}>
                <mesh
                  name="Object_8"
                  castShadow
                  receiveShadow
                  geometry={nodes.Object_8.geometry}
                  material={materials.Base_Grey}
                />
              </group>
              <group name="Claw_3" rotation={[0, -0.52, 0]}>
                <mesh
                  name="Object_10"
                  castShadow
                  receiveShadow
                  geometry={nodes.Object_10.geometry}
                  material={materials.stand}
                />
              </group>
              <group name="Screen_5" position={[0, 2.1, 0.05]} scale={3.08}>
                <mesh
                  name="Object_14"
                  castShadow
                  receiveShadow
                  position={[0, -0.3, 1.1]}
                >
                  <planeGeometry args={[0.35, 0.35]} />
                  <meshStandardMaterial map={logo} />
                </mesh>
              </group>
              <group name="Snowland_6" position={[0, 0.02, 0]} scale={20.03}>
                <mesh
                  name="Object_16"
                  castShadow
                  receiveShadow
                  geometry={nodes.Object_16.geometry}
                  material={materials.Snow}
                />
              </group>
              <group name="snowball_7" ref={snowRef}>
                <mesh
                  name="Object_18"
                  castShadow
                  receiveShadow
                  geometry={nodes.Object_18.geometry}
                  material={materials.Snowball}
                />
              </group>
              <group name="Ring_8" position={[0, 0.02, 0]} scale={20.03}>
                <mesh
                  name="Object_20"
                  castShadow
                  receiveShadow
                  geometry={nodes.Object_20.geometry}
                  material={materials.stand}
                />
              </group>
              <group name="Buckle_9" position={[0, 0.02, 0]} scale={20.03}>
                <mesh
                  name="Object_22"
                  castShadow
                  receiveShadow
                  geometry={nodes.Object_22.geometry}
                  material={materials.stand}
                />
              </group>
              <group name="Gift_1_25" position={[0, -0.12, 0]} scale={20.03}>
                <mesh
                  name="Object_55"
                  castShadow
                  receiveShadow
                  geometry={nodes.Object_55.geometry}
                  material={materials.Green_box}
                />
              </group>
              <group name="Gift_2_26" position={[0, 0.02, 0]} scale={20}>
                <mesh
                  name="Object_57"
                  castShadow
                  receiveShadow
                  geometry={nodes.Object_57.geometry}
                  material={materials.Red_box}
                />
              </group>
              <group name="Gift_2001_27" position={[0, 0.02, 0]} scale={20}>
                <mesh
                  name="Object_59"
                  castShadow
                  receiveShadow
                  geometry={nodes.Object_59.geometry}
                  material={materials.Yellow_ribbon}
                />
              </group>
              <group name="Gift_1001_28" position={[0, -0.12, 0]} scale={20.03}>
                <mesh
                  name="Object_61"
                  castShadow
                  receiveShadow
                  geometry={nodes.Object_61.geometry}
                  material={materials.Red_ribbon}
                />
              </group>
              <group name="tree_29" position={[0, 0.02, 0]} scale={20.03}>
                <mesh
                  name="Object_63"
                  castShadow
                  receiveShadow
                  geometry={nodes.Object_63.geometry}
                  material={materials.Leaf}
                />
                <mesh
                  name="Object_64"
                  castShadow
                  receiveShadow
                  geometry={nodes.Object_64.geometry}
                  material={materials.Base_Grey}
                />
              </group>
              <group name="tree_2_30" position={[0, 0.02, 0]} scale={20.03}>
                <mesh
                  name="Object_66"
                  castShadow
                  receiveShadow
                  geometry={nodes.Object_66.geometry}
                  material={materials.Leaf}
                />
                <mesh
                  name="Object_67"
                  castShadow
                  receiveShadow
                  geometry={nodes.Object_67.geometry}
                  material={materials.Base_Grey}
                />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/textures/snowglobe.glb')
