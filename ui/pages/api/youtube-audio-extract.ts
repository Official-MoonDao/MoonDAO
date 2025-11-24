// Vercel Serverless Function for YouTube Audio Extraction
// Note: Vercel has execution time limits (10s Hobby, 60s Pro)
// This may not work for very long videos

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { videoId } = req.query

  if (!videoId || typeof videoId !== 'string') {
    return res.status(400).json({ error: 'videoId parameter is required' })
  }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

    // Try to use yt-dlp if available (requires it to be installed in node_modules)
    // You may need to install: npm install @distube/ytdl-core yt-dlp-wrap
    // Or use a different npm package that wraps yt-dlp

    // Option 1: Use yt-dlp-wrap (if installed)
    // const ytDlpWrap = require('yt-dlp-wrap').default
    // const ytDlp = new ytDlpWrap()
    // const audioUrl = await ytDlp.execPromise([
    //   '-g',
    //   '-f',
    //   'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio',
    //   videoUrl
    // ])

    // Option 2: Use exec with yt-dlp binary (if available in PATH or node_modules)
    // This requires yt-dlp to be available in the Vercel environment
    // You might need to bundle it or use a different approach

    // For now, using exec - but this may not work on Vercel
    // Better to use a service like Railway/Render
    const { stdout } = await execAsync(
      `yt-dlp -g -f "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio" "${videoUrl}"`
    )

    const audioUrl = stdout.trim().split('\n')[0]

    if (!audioUrl) {
      return res.status(500).json({ error: 'Failed to extract audio URL' })
    }

    // Return the direct audio stream URL as plain text
    res.setHeader('Content-Type', 'text/plain')
    return res.status(200).send(audioUrl)
  } catch (error) {
    console.error('Error extracting audio:', error)
    return res.status(500).json({
      error: 'Failed to extract audio URL',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

