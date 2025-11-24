// Example: Simple Express server for YouTube audio extraction
// Deploy this to Railway, Render, or Fly.io
//
// Install dependencies:
// npm install express yt-dlp-wrap
//
// Or use yt-dlp binary directly:
// npm install express child_process

const express = require('express')
const { exec } = require('child_process')
const { promisify } = require('util')

const app = express()
const execAsync = promisify(exec)

app.get('/', async (req, res) => {
  const { videoId } = req.query

  if (!videoId) {
    return res.status(400).send('videoId parameter is required')
  }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

    // Extract audio URL using yt-dlp
    const { stdout } = await execAsync(
      `yt-dlp -g -f "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio" "${videoUrl}"`
    )

    const audioUrl = stdout.trim().split('\n')[0]

    if (!audioUrl) {
      return res.status(500).send('Failed to extract audio URL')
    }

    // Return the direct audio stream URL as plain text
    res.setHeader('Content-Type', 'text/plain')
    res.send(audioUrl)
  } catch (error) {
    console.error('Error extracting audio:', error)
    res.status(500).send(`Error: ${error.message}`)
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Audio extraction service running on port ${PORT}`)
})
