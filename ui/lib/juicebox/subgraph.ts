export function projectQuery(projectId: number) {
  return `
     query {
          projects(where: {projectId: ${projectId}}, limit: 1) {
            items {
              id
              projectId
              handle
              createdAt
              volume
              trendingScore
              paymentsCount
              trendingPaymentsCount
              trendingVolume
              createdWithinTrendingWindow
            }
          }
        }
  `
}

export function projectTimelineQuery() {
  return `
    query ProjectTL(
      $chainId: Int
      $projectId: Int
      $startTimestamp: Int
      $endTimestamp: Int
    ) {
      projectMoments(where: {
        chainId: $chainId,
        projectId: $projectId,
        timestamp_gte: $startTimestamp,
        timestamp_lte: $endTimestamp
      }) {
        items {
          balance
          volume
          trendingScore
          timestamp
        }
      }
    }
  `
}

export function projectEventsQuery(
  projectId: string,
  filter?: string,
  orderBy: string = 'timestamp',
  orderDirection: string = 'desc',
  limit: number = 100, // Changed from 'first' to 'limit'
  skip: number = 0,
  block: string = ''
) {
  return `
    fragment ProjectFields on Project {
      projectId
      metadataUri
      handle
      contributorsCount
      createdAt
      volume
      trendingVolume
      paymentsCount
    }

    query {
      projectEvents(
        where: {projectId: ${projectId}${filter ? `, ${filter}_not: null` : ''}}
        orderBy: ${orderBy}
        orderDirection: ${orderDirection}
        limit: ${limit}  // Changed from 'first' to 'limit'
        skip: ${skip}
        ${block ? `block: ${block}` : ''}
      ) {
        items {  // Added items wrapper
          id
          project {
            ...ProjectFields
          }
          payEvent {
            id
            project {
              ...ProjectFields
            }
            projectId
            timestamp
            txHash
            from
            caller
            amount
            amountUSD
            note
            distributionFromProjectId
            beneficiary
            feeFromProject
            beneficiaryTokenCount
          }
          addToBalanceEvent {
            id
            project {
              ...ProjectFields
            }
            projectId
            timestamp
            txHash
            from
            caller
            amount
            amountUSD
            note
          }
          mintTokensEvent {
            id
            project {
              ...ProjectFields
            }
            projectId
            timestamp
            txHash
            from
            caller
            amount
            beneficiary
            memo
          }
          cashOutEvent {
            id
            project {
              ...ProjectFields
            }
            projectId
            timestamp
            txHash
            from
            caller
            metadata
            holder
            beneficiary
            cashOutCount
            reclaimAmount
            reclaimAmountUSD
          }
          deployedERC20Event {
            id
            project {
              ...ProjectFields
            }
            projectId
            timestamp
            txHash
            from
            caller
            symbol
            address
          }
          projectCreateEvent {
            id
            project {
              ...ProjectFields
            }
            projectId
            timestamp
            txHash
            from
            caller
          }
          distributePayoutsEvent {
            id
            project {
              ...ProjectFields
            }
            projectId
            timestamp
            txHash
            from
            caller
            amount
            amountUSD
            amountPaidOut
            amountPaidOutUSD
            rulesetCycleNumber
            rulesetId
            fee
            feeUSD
          }
          distributeReservedTokensEvent {
            id
            project {
              ...ProjectFields
            }
            projectId
            timestamp
            txHash
            from
            caller
            rulesetCycleNumber
            tokenCount
          }
          distributeToReservedTokenSplitEvent {
            id
            project {
              ...ProjectFields
            }
            projectId
            timestamp
            txHash
            from
            caller
            tokenCount
            preferAddToBalance
            percent
            splitProjectId
            beneficiary
            lockedUntil
          }
          distributeToPayoutSplitEvent {
            id
            project {
              ...ProjectFields
            }
            projectId
            timestamp
            txHash
            from
            caller
            amount
            amountUSD
            preferAddToBalance
            percent
            splitProjectId
            beneficiary
            lockedUntil
          }
          useAllowanceEvent {
            id
            project {
              ...ProjectFields
            }
            projectId
            timestamp
            txHash
            from
            caller
            rulesetId
            rulesetCycleNumber
            beneficiary
            amount
            amountUSD
            distributedAmount
            distributedAmountUSD
            netDistributedamount
            netDistributedamountUSD
            memo
          }
          burnEvent {
            id
            project {
              ...ProjectFields
            }
            projectId
            timestamp
            txHash
            from
            caller
            holder
            amount
            stakedAmount
            erc20Amount
          }
        }
      }
    }
  `
}

export function trendingProjectsQuery(
  count: number,
  skip: number = 0,
  orderBy: string = 'trendingScore',
  where: string = 'createdWithinTrendingWindow: true'
) {
  return `
    query {
      projects(
        limit: ${count}  // Changed from 'first' to 'limit'
        skip: ${skip}
        orderBy: ${orderBy}
        orderDirection: desc
      ) {
        items {  // Added items wrapper
          id
          projectId
          handle
          createdAt
          metadataUri
          volume
          trendingScore
          paymentsCount
          trendingPaymentsCount
          trendingVolume
          createdWithinTrendingWindow
        }
      }
    }
  `
}
