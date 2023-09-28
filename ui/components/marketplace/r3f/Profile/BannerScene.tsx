/* eslint-disable react/no-unknown-property */
import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import ThreeText from '../ThreeText'

type BannerSceneProps = {
  walletAddress: string
}

export default function BannerScene({ walletAddress }: BannerSceneProps) {
  const spotLightRef: any = useRef()
  const { camera, size } = useThree()

  useFrame(() => {
    camera.position.z = window.scrollY / 100
    if (spotLightRef.current) {
      spotLightRef.current.position.x =
        size.width > 800
          ? window.scrollY / 3 - size.width / 11
          : window.scrollY / 5 - size.width / 10
    }
  })

  return (
    <>
      <spotLight
        ref={spotLightRef}
        position={
          size.width > 800
            ? [(-size.width / 150) * 2.5, -0.5, 50]
            : [(-size.width / 105) * 2.5, -0.5, 50]
        }
        color={'royalblue'}
        intensity={0.75}
        distance={500}
      />

      <ThreeText
        text={walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4)}
        position={
          size.width > 800
            ? [-size.width / 150, -0.5, -5]
            : [-size.width / 105, -0.5, -5]
        }
        size={size.width > 800 ? size.width / 1000 : size.width / 700}
        height={0.15}
      />
    </>
  )
}
