#!/usr/bin/env node

/**
 * Health check for the dashboard's "Live from Discord" feed and the bot behind it.
 *
 * Fails (exit 1) and posts to DISCORD_WEBHOOK_URL when:
 *   - the site's announcements endpoint errors or returns nothing,
 *   - every announcement comes back without text (Message Content intent lost),
 *   - the bot token is rejected or the bot has left the MoonDAO server,
 *   - the Message Content intent is off on the bot's application,
 *   - Discord has set a deadline to revoke the intent and no review was submitted.
 *
 * The last one is the early warning. The previous bot carried that deadline for
 * four months before Discord stripped the text, and nothing surfaced it.
 *
 * Env: SITE_URL (default https://moondao.com), DISCORD_BOT_TOKEN (bot checks are
 * skipped without it), DISCORD_WEBHOOK_URL (alert is skipped without it),
 * ALERT_FILE (the alert text is also written here, for the workflow's email step).
 */
import { writeFileSync } from 'node:fs'

const SITE_URL = (process.env.SITE_URL || 'https://moondao.com').replace(/\/$/, '')
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL
const RUN_URL = process.env.RUN_URL
const ALERT_FILE = process.env.ALERT_FILE
const GUILD_ID = '914720248140279868'
const ANNOUNCEMENTS_CHANNEL_ID = '914976122855374958'
const GATEWAY_MESSAGE_CONTENT = 1 << 18
const GATEWAY_MESSAGE_CONTENT_LIMITED = 1 << 19
const LIMITED_INTENT_WARN_GUILDS = 75

const problems = []
const notes = []

async function fetchJson(url, init) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) })
  let body = null
  try {
    body = await res.json()
  } catch {}
  return { status: res.status, body }
}

function isRedacted(messages) {
  return messages.every((m) => !m?.content && !m?.embeds?.length && !m?.attachments?.length)
}

async function checkSite() {
  const url = `${SITE_URL}/api/discord/messages?type=announcements`
  try {
    const { status, body } = await fetchJson(url)
    if (status !== 200 || !Array.isArray(body)) {
      problems.push(`The site's announcements endpoint returned HTTP ${status} (${url}).`)
      return
    }
    if (body.length === 0) {
      problems.push('The site returned no announcements at all.')
      return
    }
    const withText = body.filter((m) => m?.content).length
    if (isRedacted(body)) {
      problems.push(
        `All ${body.length} announcements came back without text. The bot the site uses has lost the Message Content intent, or the deployed DISCORD_BOT_TOKEN belongs to a bot that never had it.`
      )
    } else {
      notes.push(`Site: ${withText}/${body.length} announcements have text.`)
    }
  } catch (err) {
    problems.push(`Could not reach ${url}: ${err.message}`)
  }
}

async function checkBot() {
  if (!BOT_TOKEN) {
    notes.push('Bot checks skipped: DISCORD_BOT_TOKEN is not set.')
    return
  }
  const auth = { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
  const api = (path) => fetchJson(`https://discord.com/api/v10${path}`, auth)

  const me = await api('/users/@me')
  if (me.status !== 200) {
    problems.push(`Discord rejected DISCORD_BOT_TOKEN (HTTP ${me.status}). It may have been reset.`)
    return
  }

  const app = await api('/applications/@me')
  if (app.status !== 200) {
    problems.push(`Could not read the bot's application (HTTP ${app.status}).`)
  } else {
    const {
      name,
      id,
      owner,
      team,
      flags = 0,
      approximate_guild_count: guildCount,
      privileged_intents_review: review,
    } = app.body
    const ownerName = team?.name ? `team ${team.name}` : owner?.username || 'unknown'
    notes.push(`Bot: ${name} (${id}), owned by ${ownerName}.`)

    if (!(flags & (GATEWAY_MESSAGE_CONTENT | GATEWAY_MESSAGE_CONTENT_LIMITED))) {
      problems.push(
        `Message Content intent is off for ${name} (${id}). Turn it on in the Developer Portal under Bot → Privileged Gateway Intents, or submit the Privileged Intent review if the toggle is locked.`
      )
    } else if (
      !(flags & GATEWAY_MESSAGE_CONTENT) &&
      typeof guildCount === 'number' &&
      guildCount >= LIMITED_INTENT_WARN_GUILDS
    ) {
      problems.push(
        `${name} (${id}) is in ${guildCount} servers with only the limited (unverified) Message Content intent. Discord requires verification and the Privileged Intent review at 100 servers. Submit it from the Developer Portal, logged in as ${ownerName}.`
      )
    }

    if (!review) {
      notes.push(
        'Discord did not return privileged intent review data; check the Developer Portal for a revocation deadline.'
      )
    }

    const deadline = review?.limited_intents_revocation_deadline
    if (deadline && !review.has_submitted) {
      const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000)
      const when = new Date(deadline).toISOString().slice(0, 10)
      problems.push(
        days > 0
          ? `Discord will revoke ${name}'s privileged intents on ${when} (${days} days) unless the Privileged Intent review is submitted. Submit it from the Developer Portal, logged in as ${ownerName}.`
          : `Discord's deadline for ${name}'s Privileged Intent review passed on ${when} without a submission.`
      )
    } else if (deadline) {
      notes.push(`Privileged Intent review submitted; deadline was ${deadline.slice(0, 10)}.`)
    }
  }

  const member = await api(`/guilds/${GUILD_ID}/members/${me.body.id}`)
  if (member.status !== 200) {
    problems.push(`The bot (${me.body.id}) is not in the MoonDAO server (HTTP ${member.status}).`)
  }

  const messages = await api(`/channels/${ANNOUNCEMENTS_CHANNEL_ID}/messages?limit=10`)
  if (messages.status !== 200 || !Array.isArray(messages.body)) {
    problems.push(`The bot cannot read #announcements (HTTP ${messages.status}).`)
  } else if (messages.body.length && isRedacted(messages.body)) {
    problems.push('The bot can see #announcements but every message comes back without text.')
  }
}

async function alert() {
  const lines = [
    '**Live from Discord health check failed**',
    ...problems.map((p) => `- ${p}`),
    RUN_URL ? `Logs: ${RUN_URL}` : '',
  ].filter(Boolean)
  if (ALERT_FILE) {
    writeFileSync(ALERT_FILE, lines.join('\n').replace(/\*\*/g, '') + '\n')
  }
  if (!WEBHOOK_URL) {
    console.log('No DISCORD_WEBHOOK_URL configured; skipping Discord alert.')
    return
  }
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: lines.join('\n').slice(0, 1900),
      allowed_mentions: { parse: [] },
    }),
  })
  if (!res.ok) console.log(`Discord alert failed to send (HTTP ${res.status}).`)
}

await checkSite()
await checkBot()

for (const note of notes) console.log(note)
if (problems.length) {
  for (const p of problems) console.error(`PROBLEM: ${p}`)
  await alert()
  process.exit(1)
}
console.log('Live from Discord is healthy.')
