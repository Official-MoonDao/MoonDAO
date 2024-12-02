import { gql, GraphQLClient } from "graphql-request"

const endpoint = "https://coordinape-prod.hasura.app/v1/graphql"
const apiKey = process.env.COORDINAPE_API_KEY

const graphQLClient = new GraphQLClient(endpoint, {
  headers: {
    "Authorization": `Bearer ${apiKey}`,
  },
})

const userIdByAddressQuery = gql`
  query UserIdQuery($address: String!) {
    profiles(where: {address: {_ilike: $address}}) {
      id
      users {
        id
      }
    }
  }
`

interface UserIdResponse {
  profiles: {
    id: number
    users: {
      id: number
    }[]
  }[]
}

interface CreateContributionResponse {
  insert_contributions_one: {
      id: number
      description: string
      created_at: string
      user_id: number
      circle_id: number
    }
}

const createContributionMutation = gql`
  mutation createContribution($user_id: bigint!, $profile_id: bigint!, $description: String!) {
    insert_contributions_one(
      object: {
        user_id: $user_id,
        profile_id: $profile_id,
        description: $description
      }
    ) {
      id
      description
      created_at
      user_id
      circle_id
    }
  }
`

export type CoordinapeUser = {
  user_id: number;
  profile_id: number;
}

export type CoordinapeContribution = CoordinapeUser & {
  description: string;
}

export async function getUserId(
  address: string | undefined,
): Promise<CoordinapeUser | undefined> {
  if (!apiKey) {
    throw Error("process.env.COORDINAPE_API_KEY not set!")
  }
  if (!address) {
    return undefined
  }

  try {
    const variables = { address }
    const data = await graphQLClient.request<UserIdResponse>(
      userIdByAddressQuery,
      variables
    )
    const profile = data.profiles[0];
    if (!profile) throw Error("address not found in circle");
    return { profile_id: profile.id, user_id: profile.users[0].id }
  } catch (error) {
    throw error
  }
}

export async function createContribution(
  input: { user_id: number, profile_id: number, description: string }
): Promise<CreateContributionResponse | undefined> {
  if (!apiKey) {
    throw Error("process.env.COORDINAPE_API_KEY not set!")
  }

  if (!input.user_id || !input.profile_id || !input.description) {
    throw Error("Missing required input fields: user_id, profile_id, and description must be provided");
  }
  try {
    const res = await graphQLClient.request<CreateContributionResponse>(
      createContributionMutation,
      input
    );
    return res;
  } catch (error) {
    console.log(error)
    throw error
  }
}
