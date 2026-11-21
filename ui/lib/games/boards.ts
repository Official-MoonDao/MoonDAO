/**
 * One read path over the games' leaderboard stores, for the Discord
 * alerts. Server-only: it pulls in each game's Redis store.
 */
import type { Redis } from '@upstash/redis'
import { readBoard as readCatchBoard } from '@/lib/catch/leaderboardStore'
import { nameKey } from '@/lib/touchdown/leaderboard'
import { readBoard as readTouchdownBoard } from '@/lib/touchdown/leaderboardStore'
import { GAME_IDS, GAME_MODES, type GameId, type GameModeId, type GameRecap, type Leader } from './discordAlerts'

type Board = { top: { name: string; score: number }[]; total: number }

const READERS: Record<GameId, (redis: Redis, mission: number, mode: GameModeId) => Promise<Board>> = {
  touchdown: (redis, mission, mode) => readTouchdownBoard(redis, mission, mode),
  catch: (redis, mission, mode) => readCatchBoard(redis, mission, mode, 3),
}

/** The day's #1, read before a new run is saved so the alert knows who was passed. */
export async function readLeader(redis: Redis, game: GameId, mission: number, mode: GameModeId): Promise<Leader | undefined> {
  const { top } = await READERS[game](redis, mission, mode)
  const first = top[0]
  return first ? { key: nameKey(first.name), name: first.name, score: first.score } : undefined
}

export async function readRecaps(redis: Redis, mission: number): Promise<GameRecap[]> {
  return Promise.all(
    GAME_IDS.map(async (game) => ({
      game,
      modes: await Promise.all(
        GAME_MODES.map(async (mode) => {
          const board = await READERS[game](redis, mission, mode)
          return { mode, top: board.top.slice(0, 3), total: board.total }
        })
      ),
    }))
  )
}
