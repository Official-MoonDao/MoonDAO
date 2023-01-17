import { Physics } from '@react-three/cannon'

export function EarthScene(props) {
  return (
    <>
      <Physics
        gravity={[0, -50, 0]}
        tolerance={1}
        iterations={50}
        broadphase={'SAP'}
      >
        <Debug></Debug>
      </Physics>
    </>
  )
}
