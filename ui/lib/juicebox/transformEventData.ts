import { Ether, JBProjectToken } from 'juice-sdk-core'

function extractBaseEventData(event: any) {
  return {
    // Make type null and set it later
    // @ts-ignore
    type: null,
    id: event.id,
    projectId: event.projectId,
    timestamp: event.timestamp,
    txHash: event.txHash,
    from: event.from,
  }
}

export function transformEventData(data: any) {
  if (data.payEvent) {
    return {
      ...extractBaseEventData(data.payEvent),
      type: 'payEvent',
      amount: new Ether(BigInt(data.payEvent.amount)),
      memo: data.payEvent.memo,
      beneficiary: data.payEvent.beneficiary,
    }
  }
  if (data.addToBalanceEvent) {
    return {
      ...extractBaseEventData(data.addToBalanceEvent),
      type: 'addToBalanceEvent',
      amount: new Ether(BigInt(data.addToBalanceEvent.amount)),
    }
  }
  if (data.mintTokensEvent) {
    return {
      ...extractBaseEventData(data.mintTokensEvent),
      type: 'mintTokensEvent',
      beneficiary: data.mintTokensEvent.beneficiary,
    }
  }

  if (data.deployErc20Event) {
    return {
      ...extractBaseEventData(data.deployErc20Event),
      type: 'deployErc20Event',
      symbol: data.deployErc20Event.symbol,
    }
  }
  if (data.projectCreateEvent) {
    return {
      ...extractBaseEventData(data.projectCreateEvent),
      type: 'projectCreateEvent',
    }
  }

  if (data.burnEvent) {
    return {
      ...extractBaseEventData(data.burnEvent),
      type: 'burnEvent',
      amount: new Ether(BigInt(data.burnEvent.amount)),
    }
  }
  console.warn('Unknown event type', data)
  return null
}
