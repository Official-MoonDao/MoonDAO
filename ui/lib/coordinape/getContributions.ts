import { gql } from 'graphql-request'
import { graphQLClient } from './client'
import { Contribution } from './types'

const circleId = 29837

// GraphQL query to get all contributions in the circle
const getContributionsQuery = gql`
  query GetContributions($circle_id: bigint!) {
    contributions(
      where: { circle_id: { _eq: $circle_id } }
      order_by: { created_at: desc }
    ) {
      id
      description
      created_at
      user_id
      circle_id
      profile_id
    }
  }
`

/**
 * Get all contributions in the MoonDAO Coordinape circle
 * @returns Array of contributions for the circle
 */
export async function getContributions(): Promise<Contribution[]> {
  if (!graphQLClient) {
    throw new Error('COORDINAPE_API_KEY environment variable is not set')
  }

  try {
    const res = await graphQLClient.request<{ contributions: Contribution[] }>(
      getContributionsQuery,
      { circle_id: circleId }
    )
    return res.contributions
  } catch (error: any) {
    console.error('getContributions: Error:', error)
    if (error.response?.errors) {
      console.error('getContributions: GraphQL errors:', error.response.errors)
      const errors = error.response.errors
      if (errors.some((e: any) => e.message.includes('permission'))) {
        throw new Error(
          "You don't have permission to view circle contributions."
        )
      } else if (errors.some((e: any) => e.message.includes('circle'))) {
        throw new Error(
          'Unable to access the Coordinape circle. Please contact support.'
        )
      }
    }
    throw error
  }
}
