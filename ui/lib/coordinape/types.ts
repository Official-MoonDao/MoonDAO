export type CoordinapeUser = {
  user_id: number;
  profile_id: number;
}

export type UserIdResponse = {
  profiles: {
    id: number
    users: {
      id: number
    }[]
  }[]
}

export type CreateContributionResponse = {
  insert_contributions_one: {
    id: number
    description: string
    created_at: string
    user_id: number
    circle_id: number
  }
}
