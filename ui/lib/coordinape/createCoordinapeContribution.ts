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
    console.log("createContribution: Creating contribution for user_id:", input.user_id);
    const res = await graphQLClient.request<CreateContributionResponse>(
      createContributionMutation,
      input
    );
    console.log("createContribution: Successfully created contribution");
    return res;
  } catch (error: any) {
    console.error("createContribution: Error:", error);
    if (error.response?.errors) {
      console.error("createContribution: GraphQL errors:", error.response.errors);
      const errors = error.response.errors;
      if (errors.some((e: any) => e.message.includes('user_id'))) {
        throw new Error("Invalid user ID. Please try refreshing and submitting again.");
      } else if (errors.some((e: any) => e.message.includes('circle'))) {
        throw new Error("Unable to access the contribution circle. Please contact support.");
      } else if (errors.some((e: any) => e.message.includes('permission'))) {
        throw new Error("You don't have permission to create contributions.");
      }
    }
    throw error;
  }
}
