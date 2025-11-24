export async function transcribeYouTubeWithAssemblyAI(
  videoUrl: string,
  apiKey: string
): Promise<string> {
  try {
    const submitResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        authorization: apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: videoUrl,
      }),
    })

    if (!submitResponse.ok) {
      const error = await submitResponse.text()
      throw new Error(`AssemblyAI submission error: ${submitResponse.status} ${error}`)
    }

    const { id } = await submitResponse.json()

    while (true) {
      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: {
          authorization: apiKey,
        },
      })

      if (!statusResponse.ok) {
        throw new Error(`AssemblyAI status error: ${statusResponse.status}`)
      }

      const status = await statusResponse.json()

      if (status.status === 'completed') {
        return status.text
      } else if (status.status === 'error') {
        throw new Error(`AssemblyAI transcription error: ${status.error}`)
      }

      await new Promise((resolve) => setTimeout(resolve, 3000))
    }
  } catch (error) {
    console.error('Error transcribing with AssemblyAI:', error)
    throw error
  }
}

