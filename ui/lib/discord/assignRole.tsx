interface AssignRoleParams {
  discordUsername: string
  guildId: string
  roleId: string
  botToken: string
}

interface AssignRoleResult {
  success: boolean
  error?: string
  details?: string
  data?: {
    discordUsername: string
    discordUserId: string
    roleId: string
  }
}

export async function assignDiscordRole({
  discordUsername,
  guildId,
  roleId,
  botToken,
}: AssignRoleParams): Promise<AssignRoleResult> {
  try {
    // Search for Discord user by username
    const discordSearchResponse = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/search?query=${encodeURIComponent(
        discordUsername.split('#')[0]
      )}&limit=1`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      }
    )

    if (!discordSearchResponse.ok) {
      return {
        success: false,
        error: 'Failed to search for Discord user',
        details: `Discord API returned status ${discordSearchResponse.status}`,
      }
    }

    const discordUsers = await discordSearchResponse.json()

    if (!discordUsers || discordUsers.length === 0) {
      return {
        success: false,
        error: 'Discord user not found in the server',
      }
    }

    const discordUser = discordUsers[0]
    const discordUserId = discordUser.user.id

    // Assign the role to the Discord user
    const roleAssignResponse = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${botToken}`,
        },
      }
    )

    if (!roleAssignResponse.ok) {
      const errorText = await roleAssignResponse.text()
      return {
        success: false,
        error: 'Failed to assign Discord role',
        details: errorText,
      }
    }

    return {
      success: true,
      data: {
        discordUsername: discordUser.user.username,
        discordUserId: discordUserId,
        roleId: roleId,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: 'Unexpected error during role assignment',
      details: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

interface AssignRoleByIdParams {
  discordUserId: string
  guildId: string
  roleId: string
  botToken: string
}

export async function assignDiscordRoleById({
  discordUserId,
  guildId,
  roleId,
  botToken,
}: AssignRoleByIdParams): Promise<AssignRoleResult> {
  try {
    // Directly assign the role using the Discord user ID
    const roleAssignResponse = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${botToken}`,
        },
      }
    )

    if (!roleAssignResponse.ok) {
      const errorText = await roleAssignResponse.text()
      return {
        success: false,
        error: 'Failed to assign Discord role',
        details: errorText,
      }
    }

    return {
      success: true,
      data: {
        discordUsername: 'N/A', // We don't have username, just ID
        discordUserId: discordUserId,
        roleId: roleId,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: 'Unexpected error during role assignment',
      details: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
