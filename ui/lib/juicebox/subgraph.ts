export function projectQuery(projectId: number) {
  return `
     query {
          projects(where: {projectId: ${projectId}}) {
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
  `
}

export function projectTimelineQuery(projectId: string, blocks: any) {
  // Convert blocks object to an array of block numbers
  const blockNumbers = Object.values(blocks)

  // Create a string with all the block variables and their values
  const blockVariables = blockNumbers
    .map((blockNum, i) => `$block${i}: ${blockNum}`)
    .join(', ')

  // Create a string with all the project queries
  const projectQueries = blockNumbers
    .map(
      (_, i) =>
        `  p${i}: project(id: "${projectId}", block: { number: ${blockNumbers[i]} }) {
    currentBalance
    volume
    trendingScore
  }`
    )
    .join('\n')

  // Combine everything into a single query string
  return `
    query {
${projectQueries}
    }
  `
}

export function projectEventsQuery(
  projectId: string,
  filter?: string,
  orderBy: string = 'timestamp',
  orderDirection: string = 'desc',
  first: number = 100,
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
        first: ${first}
        skip: ${skip}
        ${block ? `block: ${block}` : ''}
      ) {
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
        first: ${count}
        skip: ${skip}
        orderBy: ${orderBy}
        orderDirection: desc
      ) {
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
  `
}
