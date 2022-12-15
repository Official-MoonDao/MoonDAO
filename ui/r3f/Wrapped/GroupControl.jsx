import { useFrame } from '@react-three/fiber'
import gsap from 'gsap'
import { useState } from 'react'
import { useRef } from 'react'
import { TOTAL_VMOONEY } from '../../lib/analytics'
import { useAccount } from '../../lib/use-wagmi'
import { Data } from './Data'
import { SnowGlobe } from './SnowGlobe'
import { Text } from './Text'

export function GroupControl({ userData }) {
  const groupRef = useRef()
  const [section, setSection] = useState(0)
  function startWrapped() {
    if (!userData.address) return
    setSection(1)
    setTimeout(() => {
      setSection(2)
    }, 5000)
    // setTimeout(() => {
    //   setSection(3)
    // }, 10000)
  }

  function resetWrapped() {}

  useFrame(() => {
    if (groupRef.current) {
      if (section === 0)
        gsap.to(groupRef.current.position, { duration: 2, x: 0, y: 0, z: 0 })
      if (section === 1)
        gsap.to(groupRef.current.position, { duration: 2, x: 0, y: 5, z: 0 })
      if (section === 2)
        gsap.to(groupRef.current.position, { duration: 2, x: 0, y: 10, z: 0 })
      if (section === 3)
        gsap.to(groupRef.current.position, { duration: 2, x: 0, y: 15, z: 0 })
    }
  })

  return (
    <group ref={groupRef}>
      <group position={[0, 0, 0]}>
        <SnowGlobe
          onClick={() => startWrapped()}
          noWallet={!userData.address}
        />
      </group>
      <group position={[-0.5, -4, 0]}>
        <Text text={'Happy\nHolidays'} size={0.6} height={0.1} />
        <Text
          text={
            `${userData?.address?.slice(0, 4)}...${userData?.address?.slice(
              -4
            )}` || '...loading'
          }
          size={0.6}
          height={0.1}
          position={[0, -0.75, 0]}
          color="white"
        />
        <Text
          text={'Here are\nyour\nstats from\nthis year'}
          size={0.4}
          height={0.1}
          position={[0, -1.25, 0]}
        />
      </group>
      <group position={[-0.75, -9, 0]}>
        <Data label={'You voted'} data={userData?.votes || '...loading'} />
        <Data
          position={[0, -1, 0]}
          label={'You own'}
          data={userData?.totalVMooney?.toLocaleString('en-US') + '\nvMOONEY'}
        />
      </group>
      <group position={[-0.25, -15, 0]}>
        <Data label={'votes'} data={'49'} />
      </group>
    </group>
  )
}
