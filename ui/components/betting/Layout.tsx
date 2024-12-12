import { RadioGroup } from '@headlessui/react'
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
}

type TraderActionsProps = {
  marketInfo: any
  isMarketClosed: boolean
  selectedAmount: string
  redeem: any
  buy: any
  sell: any
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
  account: string
  isConditionLoaded: boolean
  isMarketClosed: boolean
  marketInfo: any
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
}) => (
  <>
    <div>
      <FormInput
        variant="filled"
        label="Collateral value"
        type="number"
        onChange={(e) => setSelectedAmount(e.target.value)}
        disabled={isMarketClosed}
      />
    </div>
    <RadioGroup
      defaultValue={0}
      onChange={setSelectedOutcomeToken}
      value={selectedOutcomeToken}
    >
      {marketInfo.outcomes.map((outcome: any, index: number) => (
        <div key={outcome.title}>
          <RadioGroup.Option
            value={!isMarketClosed ? outcome.index : 'disabled'}
            key={outcome.short}
            label={outcome.title}
          >
            <CompetitorPreview
              teamId={outcome.teamId}
              teamContract={teamContract}
            />
          </RadioGroup.Option>
          <div>Probability: {outcome.probability.toString()}%</div>
          <div>My balance: {outcome.balance.toFixed(5).toString()}</div>
        </div>
      ))}
    </RadioGroup>
  </>
)

const TraderActions: React.FC<TraderActionsProps> = ({
  marketInfo,
  isMarketClosed,
  selectedAmount,
  redeem,
  buy,
  sell,
}) => (
  <>
    <h3>Trader actions:</h3>
    <div>
      <StandardButton
        variant="contained"
        onClick={redeem}
        disabled={!isMarketClosed || !marketInfo.payoutDenominator}
      >
        Redeem
      </StandardButton>
      <StandardButton
        variant="contained"
        onClick={buy}
        disabled={isMarketClosed || !selectedAmount}
      >
        Buy
      </StandardButton>
      <StandardButton
        variant="contained"
        onClick={sell}
        disabled={isMarketClosed || !selectedAmount}
      >
        Sell
      </StandardButton>
    </div>
  </>
)

const OperatorActions: React.FC<OperatorActionsProps> = ({
  isMarketClosed,
  close,
}) => (
  <>
    <h3>Operator actions:</h3>
    <StandardButton
      variant="contained"
      onClick={close}
      disabled={isMarketClosed}
    >
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
          key={outcome.short}
          variant="contained"
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
  account,
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
          <h2>{marketInfo.title}</h2>
          <p>State: {marketInfo.stage}</p>
          <TradingForm
            isMarketClosed={isMarketClosed}
            marketInfo={marketInfo}
            teamContract={teamContract}
            setSelectedAmount={setSelectedAmount}
            setSelectedOutcomeToken={setSelectedOutcomeToken}
            selectedOutcomeToken={selectedOutcomeToken}
          />
          <TraderActions
            marketInfo={marketInfo}
            isMarketClosed={isMarketClosed}
            selectedAmount={selectedAmount}
            redeem={redeem}
            buy={buy}
            sell={sell}
          />
          {account === OPERATOR_ADDRESS && (
            <OperatorActions isMarketClosed={isMarketClosed} close={close} />
          )}
          {account === ORACLE_ADDRESS && (
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
