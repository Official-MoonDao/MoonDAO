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
