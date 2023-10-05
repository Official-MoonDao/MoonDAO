export function serialize(data: any) {
  return data && JSON.parse(JSON.stringify(data))
}
