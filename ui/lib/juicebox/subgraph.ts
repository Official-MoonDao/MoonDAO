export function projectQuery(projectId: number) {
  return `
     query {
          projects(where: {projectId: ${+projectId}}, limit: 1) {
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

export function projectTimelineQuery(
  chainId: number,
  projectId: number,
  startTimestamp: number,
  endTimestamp: number
) {
  return `
    query {
      projectMoments(where: {
        chainId: ${chainId},
        projectId: ${+projectId},
        timestamp_gte: ${startTimestamp},
        timestamp_lte: ${endTimestamp}
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

export function suckerGroupMomentsQuery(
  chainId: number,
  suckerGroupId: string,
  startTimestamp: number,
  endTimestamp: number
) {
  return `
    query {
      suckerGroupMoments(where: {
        suckerGroupId: "${suckerGroupId}",
        timestamp_gte: ${startTimestamp},
        timestamp_lte: ${endTimestamp}
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
  let whereClause = `projectId: ${+projectId}`

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
  skip: number = 0,
  orderBy: string = 'trendingScore',
  where: string = 'createdWithinTrendingWindow: true'
) {
  return `
    query {
      projects(
        limit: ${count}
        skip: ${skip}
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
