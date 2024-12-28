import { gql } from "graphql-request";
import { graphQLClient } from "./client";
import { CreateContributionResponse } from "./types";

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
`;

export async function createContribution(
  input: { user_id: number, profile_id: number, description: string }
): Promise<CreateContributionResponse | undefined> {
  if (!graphQLClient) {
    throw new Error("COORDINAPE_API_KEY environment variable is not set")
  }

  if (!input.description) {
    throw Error("Description must be provided");
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
