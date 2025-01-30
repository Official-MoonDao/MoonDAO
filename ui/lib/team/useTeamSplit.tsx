import useRead from '../thirdweb/hooks/useRead'

export default function useTeamSplit(
  teamContract: any,
  teamId: number | string | undefined
) {
  const { data: splitContractAddress } = useRead({
    contract: teamContract,
    method: 'splitContract',
    params: [teamId],
  })

  return splitContractAddress
}
