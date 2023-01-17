import { Physics } from '@react-three/cannon'

export function BaseScene(props) {
  return (
    <>
      <Physics
        gravity={[0, -10, 0]}
        tolerance={1}
        iterations={50}
        broadphase={'SAP'}
      >
        <Debug></Debug>
      </Physics>
    </>
  )
}
