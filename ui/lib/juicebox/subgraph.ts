import { BENDYSTRAW_JB_VERSION, DEFAULT_CHAIN_V5 } from 'const/config'

export function projectQuery(projectId: number) {
  return `
     query {
          projects(where: {projectId: ${+projectId}, version: ${BENDYSTRAW_JB_VERSION}, chainId: ${
    DEFAULT_CHAIN_V5.id
  }}, limit: 1) {
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
              suckerGroupId
            }
          }
        }
  `
}

export function suckerGroupMomentsQuery(
  suckerGroupId: string,
  startTimestamp: number,
  endTimestamp: number
) {
  return `
    query {
      previous: suckerGroupMoments(where: {
        suckerGroupId: "${suckerGroupId}",
        timestamp_lt: ${startTimestamp},
        version: ${BENDYSTRAW_JB_VERSION},
      }, orderBy: "timestamp", orderDirection: "desc", limit: 1) {
        items {
          balance
          volume
          trendingScore
          timestamp
          suckerGroupId
        }
      }
      range: suckerGroupMoments(where: {
        suckerGroupId: "${suckerGroupId}",
        timestamp_gte: ${startTimestamp},
        timestamp_lte: ${endTimestamp},
        version: ${BENDYSTRAW_JB_VERSION}
      }) {
        items {
          balance
          volume
          trendingScore
          timestamp
          suckerGroupId
        }
      }
    }
  `
}

export function projectEventsQuery(
  projectId: number,
  filter?: string,
  orderBy: string = 'timestamp',
  orderDirection: string = 'desc',
  limit: number = 100,
  timestampCursor?: number | null
) {
  // Build the where clause with timestamp filtering for pagination
  let whereClause = `projectId: ${+projectId} version: ${BENDYSTRAW_JB_VERSION} chainId: ${
    DEFAULT_CHAIN_V5.id
  }`

  if (filter) {
    whereClause += `, ${filter}_not: null`
  }

  if (timestampCursor) {
    whereClause += `, timestamp_lt: ${timestampCursor}`
  }

  return `
    query {
      activityEvents(
        where: {${whereClause}}
        orderBy: "${orderBy}"
        orderDirection: "${orderDirection}"
        limit: ${limit}
      ) {
        items {
          id
          payEvent {
            id
            projectId
            timestamp
            txHash
            from
            amount
          }
          addToBalanceEvent {
            id
            projectId
            timestamp
            txHash
            from
            amount
          }
          mintTokensEvent {
            id
            projectId
            timestamp
            txHash
            from
            beneficiary
          }
          deployErc20Event {
            id
            projectId
            timestamp
            txHash
            from
            symbol
          }
          projectCreateEvent {
            id
            projectId
            timestamp
            txHash
            from
          }
          burnEvent {
            id
            projectId
            timestamp
            txHash
            from
            amount
          }
        }
      }
    }
  `
}

export function trendingProjectsQuery(
  count: number,
  orderBy: string = 'trendingScore'
) {
  return `
    query {
      projects(
        where: {version: ${BENDYSTRAW_JB_VERSION}},
        limit: ${count}
        orderBy: "${orderBy}"
        orderDirection: "desc"
      ) {
        items {
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
