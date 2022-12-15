import { Text } from './Text'

export function Data(props) {
  return (
    <group {...props}>
      <Text
        text={props.label + ' : '}
        size={0.55}
        color={'white'}
        height={0.01}
      />
      <Text
        position={[0.5, -0.5, 0]}
        text={props.data}
        size={0.5}
        color={'green'}
        height={0.01}
      />
    </group>
  )
}
