import { ORACLE_ADDRESS, OPERATOR_ADDRESS } from 'const/config'
import React from 'react'
import FormInput from '@/components/forms/FormInput'
import StandardButton from '@/components/layout/StandardButton'
import { CompetitorPreview } from '@/components/nance/CompetitorPreview'

type TradingFormProps = {
  isMarketClosed: boolean
  marketInfo: any
  teamContract: any
  setSelectedAmount: any
  setSelectedOutcomeToken: any
  selectedOutcomeToken: number
  selectedAmount: string
  buy: any
  sell: any
  redeem: any
}

type OperatorActionsProps = {
  isMarketClosed: boolean
  close: any
}

type OracleActionsProps = {
  isMarketClosed: boolean
  marketInfo: any
  resolve: any
}

type LayoutProps = {
  userAddress?: string
  isConditionLoaded: boolean
  isMarketClosed: boolean
  marketInfo: any
  teamContract: any
  setSelectedAmount: any
  selectedAmount: string
  setSelectedOutcomeToken: any
  selectedOutcomeToken: number
  buy: any
  sell: any
  redeem: any
  close: any
  resolve: any
}

const TradingForm: React.FC<TradingFormProps> = ({
  isMarketClosed,
  marketInfo,
  teamContract,
  setSelectedAmount,
  setSelectedOutcomeToken,
  selectedOutcomeToken,
  selectedAmount,
  buy,
  sell,
  redeem,
}) => (
  <>
    <div>
      <FormInput
        label="Amount (ETH)"
        type="number"
        onChange={(e: any) => setSelectedAmount(e.target.value)}
        disabled={isMarketClosed}
        value={selectedAmount}
      />
    </div>
    <div>
      {marketInfo.outcomes.map((outcome: any, index: number) => (
        <span key={index} className="flex flex-row items-center justify-left">
          {outcome.teamId >= 0 ? (
            <CompetitorPreview
              teamId={outcome.teamId}
              teamContract={teamContract}
            />
          ) : (
            <div>Neither</div>
          )}
          <StandardButton
            onClick={() => buy(outcome.index)}
            disabled={isMarketClosed || !selectedAmount}
            className="rounded-full mx-2"
            backgroundColor="bg-moon-green"
          >
            Buy {outcome.probability.toString()}%
          </StandardButton>
          <StandardButton
            className="rounded-full mx-2 rounded-full"
            backgroundColor="bg-moon-orange"
            onClick={() => sell(outcome.index)}
            disabled={isMarketClosed || !selectedAmount}
          >
            Sell
          </StandardButton>
          {isMarketClosed && (
            <StandardButton
              onClick={redeem}
              disabled={!marketInfo.payoutDenominator}
            >
              Redeem
            </StandardButton>
          )}
          <div className="mx-2">
            Balance: {outcome.balance.toPrecision(2).toString()}
          </div>
        </span>
      ))}
    </div>
  </>
)
const OperatorActions: React.FC<OperatorActionsProps> = ({
  isMarketClosed,
  close,
}) => (
  <>
    <h3>Operator actions:</h3>
    <StandardButton onClick={close} disabled={isMarketClosed}>
      Close
    </StandardButton>
  </>
)

const OracleActions: React.FC<OracleActionsProps> = ({
  isMarketClosed,
  marketInfo,
  resolve,
}) => (
  <>
    <h3>Oracle actions:</h3>
    <div>
      {marketInfo.outcomes.map((outcome: any, index: number) => (
        <StandardButton
          key={index}
          onClick={() => resolve(index)}
          disabled={!isMarketClosed}
        >
          Resolve {outcome.title}
        </StandardButton>
      ))}
    </div>
  </>
)

const Layout: React.FC<LayoutProps> = ({
  userAddress,
  isConditionLoaded,
  isMarketClosed,
  marketInfo,
  teamContract,
  setSelectedAmount,
  selectedAmount,
  setSelectedOutcomeToken,
  selectedOutcomeToken,
  buy,
  sell,
  redeem,
  close,
  resolve,
}) => {
  return (
    <div>
      {isConditionLoaded ? (
        <>
          <p>{marketInfo.title}</p>
          <TradingForm
            isMarketClosed={isMarketClosed}
            marketInfo={marketInfo}
            teamContract={teamContract}
            setSelectedAmount={setSelectedAmount}
            setSelectedOutcomeToken={setSelectedOutcomeToken}
            selectedOutcomeToken={selectedOutcomeToken}
            selectedAmount={selectedAmount}
            buy={buy}
            sell={sell}
            redeem={redeem}
          />
          {userAddress === OPERATOR_ADDRESS && (
            <OperatorActions isMarketClosed={isMarketClosed} close={close} />
          )}
          {userAddress === ORACLE_ADDRESS && (
            <OracleActions
              isMarketClosed={isMarketClosed}
              marketInfo={marketInfo}
              resolve={resolve}
            />
          )}
        </>
      ) : (
        <div>Loading...</div>
      )}
    </div>
  )
}

export default Layout
