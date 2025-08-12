import { DISCORD_GUILD_ID } from 'const/config'
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Fetch all roles from the Discord server
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles`,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      return res.status(response.status).json({
        error: 'Failed to fetch Discord roles',
        details: errorText,
        status: response.status
      })
    }

    const roles = await response.json()

    // Filter and format the roles for easy reading
    const formattedRoles = roles
      .filter((role: any) => role.name !== '@everyone') // Exclude @everyone role
      .map((role: any) => ({
        id: role.id,
        name: role.name,
        color: role.color,
        position: role.position,
        permissions: role.permissions,
        hoist: role.hoist, // Whether role is displayed separately
        mentionable: role.mentionable
      }))
      .sort((a: any, b: any) => b.position - a.position) // Sort by position (highest first)

    // Also create a TypeScript-friendly format for copy-pasting
    const tsFormat = formattedRoles.map((role: any) => 
      `'${role.id}': ['text-blue-500', '${role.name}'], // ${role.name}`
    ).join('\n  ')

    return res.status(200).json({
      success: true,
      totalRoles: formattedRoles.length,
      roles: formattedRoles,
      forCopyPaste: {
        typescript: `// Discord Role IDs for ${DISCORD_GUILD_ID}\n{\n  ${tsFormat}\n}`,
        simple: formattedRoles.map((role: any) => `${role.name}: ${role.id}`).join('\n')
      }
    })
  } catch (error) {
    console.error('Error fetching Discord roles:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
