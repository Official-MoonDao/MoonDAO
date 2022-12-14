import { Text } from '../Text'

export function MerryChristmas(props) {
  return (
    <Text {...props} text={`     Merry\nChristmas! ${props.id}`} size={1} />
  )
}
