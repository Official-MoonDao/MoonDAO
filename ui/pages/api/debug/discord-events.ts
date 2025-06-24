import { DISCORD_GUILD_ID } from 'const/config'
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const eventsRes = await fetch(
      `https://discord.com/api/v8/guilds/${DISCORD_GUILD_ID}/scheduled-events`,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      }
    )

    const events = await eventsRes.json()

    // Check if we got an error response
    if (!eventsRes.ok || events.message) {
      console.error('Discord API Error:', events)
      return res.status(500).json({
        success: false,
        error: events.message || 'Failed to fetch Discord events',
        statusCode: eventsRes.status
      })
    }

    // Log events structure for debugging
    console.log('Discord Events Response:', JSON.stringify(events, null, 2))

    // Handle if events is not an array
    if (!Array.isArray(events)) {
      return res.status(500).json({
        success: false,
        error: 'Events response is not an array',
        response: events
      })
    }

    res.status(200).json({
      success: true,
      eventsCount: events.length,
      events: events.map((event: any) => ({
        id: event.id,
        name: event.name,
        description: event.description,
        image: event.image,
        scheduled_start_time: event.scheduled_start_time,
        entity_type: event.entity_type,
        status: event.status,
        // Log all available fields
        allFields: Object.keys(event)
      }))
    })
  } catch (error) {
    console.error('Error fetching Discord events:', error)
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
}
