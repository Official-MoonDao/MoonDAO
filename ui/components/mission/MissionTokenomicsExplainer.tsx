import Point from '../layout/Point'
import SubPoint from '../layout/SubPoint'

export default function MissionTokenomicsExplainer() {
  return (
    <div>
      <Point
        point="Goal & Timeline: Missions have until their deadline to raise their Funding Goal; otherwise, the Mission will not proceed and all contributions will be able to be refunded within 28 days of the deadline if refunds are enabled.
"
      />
      <Point
        point="ETH Price Fluctuations: The value of ETH may fluctuate during the mission campaign, meaning the actual funds raised could be higher or lower than initially anticipated. Teams should account for potential volatility.
"
      />

      <Point point="ETH Allocation" />
      <div className="ml-8 flex flex-col">
        <SubPoint point="90% to Mission Team" />
        <SubPoint point="5% to LP Pool" />
        <SubPoint point="2.5% to MoonDAO" />
        <SubPoint point="2.5% to Juicebox" />
      </div>

      <Point point="Token Allocation: Teams can withdraw up to 50% of their total raised funds. The remaining 50% is allocated as follows:" />
      <div className="ml-8 flex flex-col">
        <SubPoint point="50% to Contributors" />
        <SubPoint point="30% to Mission Team" />
        <SubPoint point="17.5% to MoonDAO" />
        <SubPoint point="2.5% to LP Pool" />
      </div>

      <Point point="Mission Ownership & Security: The mission and all associated funds are fully controlled by your team wallet. If teammates fail to maintain access to the wallets connected to the team multisig, funds may become permanently inaccessible, with no recourse for recovery." />
    </div>
  )
}
