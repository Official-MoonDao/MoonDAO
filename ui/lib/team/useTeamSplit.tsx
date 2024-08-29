import { useHandleRead } from '../thirdweb/hooks'

export default function useTeamSplit(
  teamContract: any,
  teamId: number | string | undefined
) {
  const { data: splitContractAddress } = useHandleRead(
    teamContract,
    'splitContract',
    [teamId]
  )

  return splitContractAddress
}
