/**
 * Guild-scoped Discord command registration. Never a CI step.
 * Refuses to run without DISCORD_GUILD_ID and refuses a global PUT.
 *
 *   yarn discord:register
 *   yarn discord:register --clear
 */

const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID
const GUILD_ID = process.env.DISCORD_GUILD_ID
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN

const PRIZE_OPTION = {
  type: 3,
  name: 'prize',
  description: 'Sepolia id or `touchdown`.',
  required: true,
}

const OPTIONAL_PRIZE = { ...PRIZE_OPTION, required: false }

const G1_COMMANDS = [
  {
    name: 'odds',
    description: 'Live implied odds for a DePrize.',
    options: [PRIZE_OPTION],
  },
  {
    name: 'pool',
    description: 'Prize pool for a DePrize.',
    options: [PRIZE_OPTION],
  },
  {
    name: 'bet',
    description: 'Open the website bet page (link only).',
    options: [OPTIONAL_PRIZE],
  },
]

async function main() {
  if (!APPLICATION_ID) {
    console.error('DISCORD_APPLICATION_ID is required')
    process.exit(1)
  }
  if (!GUILD_ID) {
    console.error('DISCORD_GUILD_ID is required — this script refuses a global register')
    process.exit(1)
  }
  if (!BOT_TOKEN) {
    console.error('DISCORD_BOT_TOKEN is required')
    process.exit(1)
  }
  if (process.argv.includes('--global')) {
    console.error('Global registration is refused in v1')
    process.exit(1)
  }

  const clear = process.argv.includes('--clear')
  const url = `https://discord.com/api/v10/applications/${APPLICATION_ID}/guilds/${GUILD_ID}/commands`
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(clear ? [] : G1_COMMANDS),
  })
  const body = await response.text()
  if (!response.ok) {
    console.error(response.status, body)
    process.exit(1)
  }
  console.log(clear ? 'Cleared guild commands' : 'Registered /odds /pool /bet')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
