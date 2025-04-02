import Point from '../layout/Point'
import SubPoint from '../layout/SubPoint'

export default function MissionTokenomicsExplainer() {
  return (
    <div>
      <Point point="Goal & Timeline: Missions have 30 days to raise at least 10% of the total goal; otherwise, all contributions are automatically refunded to supporters." />
      <Point point="ETH Price Fluctuations: The value of ETH may fluctuate during the mission campaign, meaning the actual funds raised could be higher or lower than initially anticipated. Teams should account for potential volatility." />

      <Point point="Fund Allocation: Teams can withdraw up to 80% of their total raised funds. The remaining 20% is allocated as follows:" />
      <SubPoint point="10% to liquidity to ensure tradability and market stability." />
      <SubPoint point="7.5% to MoonDAO to support the broader space acceleration ecosystem." />
      <SubPoint point="2.5% to Juicebox, the underlying protocol powering the fundraising infrastructure." />

      <Point point="Mission Tokens: Each mission generates a unique token with a tiered issuance system to incentivize early supporters:" />
      <SubPoint point="2,000 tokens per 1 ETH until reaching the Minimum (10% of the total goal)." />
      <SubPoint point="1,000 tokens per 1 ETH until reaching the Funding Goal." />
      <SubPoint point="500 tokens per 1 ETH for contributions beyond the goal." />

      <Point point="Mission Ownership & Security: The mission and all associated funds are fully controlled by your team wallet. If teammates fail to maintain access to the wallets connected to the team multisig, funds may become permanently inaccessible, with no recourse for recovery." />
    </div>
  )
}
