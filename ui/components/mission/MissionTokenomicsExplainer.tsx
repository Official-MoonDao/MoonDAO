import Point from '../layout/Point'
import SubPoint from '../layout/SubPoint'

export default function MissionTokenomicsExplainer() {
  return (
    <div>
      <Point
        point="Goal & Timeline: Missions have 28 days, or one lunar cycle, to raise their Funding Goal; otherwise, the Mission will not proceed and all contributions will be refunded.
"
      />
      <Point
        point="ETH Price Fluctuations: The value of ETH may fluctuate during the mission campaign, meaning the actual funds raised could be higher or lower than initially anticipated. Teams should account for potential volatility.
"
      />

      <Point point="Fund Allocation: Teams can withdraw up to 80% of their total raised funds. The remaining 20% is allocated as follows:" />
      <SubPoint point="10% to liquidity to ensure tradability and market stability." />
      <SubPoint point="7.5% to MoonDAO to support the broader space acceleration ecosystem." />
      <SubPoint point="2.5% to Juicebox, the underlying protocol powering the fundraising infrastructure." />

      <Point point="Mission Ownership & Security: The mission and all associated funds are fully controlled by your team wallet. If teammates fail to maintain access to the wallets connected to the team multisig, funds may become permanently inaccessible, with no recourse for recovery." />
    </div>
  )
}
