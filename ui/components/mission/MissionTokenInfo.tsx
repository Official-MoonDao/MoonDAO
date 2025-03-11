import MissionInfoCard from './MissionInfoCard'

export default function MissionTokenInfo({
  userBalance,
  token,
}: {
  userBalance: string
  token: {
    tokenAddress: string
    tokenSupply: string
    reservedTokens: string
    reservedRate: string
  }
}) {
  return (
    <>
      <h1 className="mt-4 text-2xl font-bold">Tokens</h1>
      <div className="grid grid-cols-4 gap-4">
        <MissionInfoCard className="col-span-4" title="Your balance">
          {userBalance}
        </MissionInfoCard>
        <MissionInfoCard className="col-span-4" title="Token Supply">
          {token.tokenSupply.toString() / 10 ** 18}
        </MissionInfoCard>
      </div>
      <h1 className="mt-4 text-2xl font-bold">Reserved Tokens</h1>
      <div className="mt-4 grid grid-cols-4 gap-4">
        <MissionInfoCard className="col-span-2" title="Reserved Tokens">
          {token.tokenSupply}
        </MissionInfoCard>
        <MissionInfoCard className="col-span-2" title="Reserved Rate">
          {token.tokenSupply}
        </MissionInfoCard>
      </div>
    </>
  )
}
