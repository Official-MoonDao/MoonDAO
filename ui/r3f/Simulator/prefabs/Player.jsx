import { useGLTF } from '@react-three/drei'
import ThirdPersonCharacterControls from 'react-three-third-person'

// const animationPaths = {
//     idle:,
//     walk:,
//     run:,
//     jump:,
//     landing:,
//     inAir:,
//     backpedal:,
//     turnLeft:,
//     turnRight:,
//     strafeLeft:,
//     strafeRight:,
// }

function ThirdPersonCharacter() {
  const model = useGLTF()
  const characterProps = {
    scale: 1.75,
    velocity: 8,
    radius: 0.5,
  }

  return (
    <ThirdPersonCharacterControls
      cameraOptions={{
        yOffset: 1.6,
        minDistance: 0.6,
        maxDistance: 7,
        collisionFilterMask: 2,
      }}
      characterObj={model}
      characterProps={characterProps}
      animationPaths={animationPaths}
    />
  )
}

export default ThirdPersonCharacter
