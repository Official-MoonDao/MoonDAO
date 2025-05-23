import { Ether, JBProjectToken } from 'juice-sdk-core'

function extractBaseEventData(event: any) {
  return {
    // Make type null and set it later
    // @ts-ignore
    type: null,
    id: event.id,
    projectId: event.project.id,
    timestamp: event.timestamp,
    txHash: event.txHash,
    from: event.from,
    caller: event.caller,
  }
}

export function transformEventData(data: any) {
  if (data.payEvent) {
    return {
      ...extractBaseEventData(data.payEvent),
      type: 'payEvent',
      amount: new Ether(BigInt(data.payEvent.amount)),
      note: data.payEvent.note,
      distributionFromProjectId: data.payEvent.distributionFromProjectId,
      beneficiary: data.payEvent.beneficiary,
      feeFromProject: data.payEvent.feeFromProject,
      beneficiaryTokenCount: new JBProjectToken(
        BigInt(data.payEvent.beneficiaryTokenCount)
      ),
    }
  }
  if (data.addToBalanceEvent) {
    return {
      ...extractBaseEventData(data.addToBalanceEvent),
      type: 'addToBalanceEvent',
      amount: new Ether(BigInt(data.addToBalanceEvent.amount)),
      note: data.addToBalanceEvent.note,
    }
  }
  if (data.mintTokensEvent) {
    return {
      ...extractBaseEventData(data.mintTokensEvent),
      type: 'mintTokensEvent',
      amount: new Ether(BigInt(data.mintTokensEvent.amount)),
      beneficiary: data.mintTokensEvent.beneficiary,
      note: data.mintTokensEvent.memo,
    }
  }
  if (data.cashOutEvent) {
    return {
      ...extractBaseEventData(data.cashOutEvent),
      type: 'cashOutEvent',
      metadata: data.cashOutEvent.metadata,
      holder: data.cashOutEvent.holder,
      beneficiary: data.cashOutEvent.beneficiary,
      cashOutCount: new Ether(BigInt(data.cashOutEvent.cashOutCount)),
      reclaimAmount: new Ether(BigInt(data.cashOutEvent.reclaimAmount)),
    }
  }
  if (data.deployedERC20Event) {
    return {
      ...extractBaseEventData(data.deployedERC20Event),
      type: 'deployedERC20Event',
      symbol: data.deployedERC20Event.symbol,
      address: data.deployedERC20Event.address,
    }
  }
  if (data.projectCreateEvent) {
    return {
      ...extractBaseEventData(data.projectCreateEvent),
      type: 'projectCreateEvent',
    }
  }
  if (data.distributePayoutsEvent) {
    return {
      ...extractBaseEventData(data.distributePayoutsEvent),
      type: 'distributePayoutsEvent',
      amount: new Ether(BigInt(data.distributePayoutsEvent.amount)),
      amountPaidOut: new Ether(
        BigInt(data.distributePayoutsEvent.amountPaidOut)
      ),
      rulesetCycleNumber: data.distributePayoutsEvent.rulesetCycleNumber,
      rulesetId: data.distributePayoutsEvent.rulesetId,
      fee: new Ether(BigInt(data.distributePayoutsEvent.fee)),
    }
  }
  if (data.distributeReservedTokensEvent) {
    return {
      ...extractBaseEventData(data.distributeReservedTokensEvent),
      type: 'distributeReservedTokensEvent',
      rulesetCycleNumber: data.distributeReservedTokensEvent.rulesetCycleNumber,
      tokenCount: data.distributeReservedTokensEvent.tokenCount,
    }
  }
  if (data.distributeToReservedTokenSplitEvent) {
    return {
      ...extractBaseEventData(data.distributeToReservedTokenSplitEvent),
      type: 'distributeToReservedTokenSplitEvent',
      tokenCount: data.distributeToReservedTokenSplitEvent.tokenCount,
      preferAddToBalance:
        data.distributeToReservedTokenSplitEvent.preferAddToBalance,
      percent: data.distributeToReservedTokenSplitEvent.percent,
      splitProjectId: data.distributeToReservedTokenSplitEvent.splitProjectId,
      beneficiary: data.distributeToReservedTokenSplitEvent.beneficiary,
      lockedUntil: data.distributeToReservedTokenSplitEvent.lockedUntil,
    }
  }
  if (data.distributeToPayoutSplitEvent) {
    return {
      ...extractBaseEventData(data.distributeToPayoutSplitEvent),
      type: 'distributeToPayoutSplitEvent',
      amount: new Ether(BigInt(data.distributeToPayoutSplitEvent.amount)),
      preferAddToBalance: data.distributeToPayoutSplitEvent.preferAddToBalance,
      percent: data.distributeToPayoutSplitEvent.percent,
      splitProjectId: data.distributeToPayoutSplitEvent.splitProjectId,
      beneficiary: data.distributeToPayoutSplitEvent.beneficiary,
      lockedUntil: data.distributeToPayoutSplitEvent.lockedUntil,
    }
  }
  if (data.useAllowanceEvent) {
    return {
      ...extractBaseEventData(data.useAllowanceEvent),
      type: 'useAllowanceEvent',
      rulesetId: data.useAllowanceEvent.rulesetId,
      rulesetCycleNumber: data.useAllowanceEvent.rulesetCycleNumber,
      beneficiary: data.useAllowanceEvent.beneficiary,
      amount: new Ether(BigInt(data.useAllowanceEvent.amount)),
      distributedAmount: new Ether(
        BigInt(data.useAllowanceEvent.distributedAmount)
      ),
      netDistributedamount: new Ether(
        BigInt(data.useAllowanceEvent.netDistributedamount)
      ),
      note: data.useAllowanceEvent.memo,
    }
  }
  if (data.burnEvent) {
    return {
      ...extractBaseEventData(data.burnEvent),
      type: 'burnEvent',
      holder: data.burnEvent.holder,
      amount: new Ether(BigInt(data.burnEvent.amount)),
      stakedAmount: new Ether(BigInt(data.burnEvent.stakedAmount)),
      erc20Amount: new Ether(BigInt(data.burnEvent.erc20Amount)),
    }
  }
  console.warn('Unknown event type', data)
  return null
}
