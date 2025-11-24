export function getTownHallSummaryPrompt(transcript: string): string {
  return `You are summarizing a MoonDAO Town Hall meeting transcript. Please provide a comprehensive summary that includes:

1. **Key Topics Discussed**: List the main topics and themes covered in the town hall.

2. **Decisions Made**: Any decisions, votes, or resolutions that were reached during the meeting.

3. **Action Items**: Specific action items for community members, including:
   - Tasks assigned to individuals or teams
   - Deadlines mentioned
   - Next steps for the community

4. **Important Updates**: Significant announcements, updates, or news shared during the meeting.

5. **Next Steps**: What the community should expect or prepare for next.

Format your response in clear, well-structured sections with headers. Use bullet points for lists. Make it easy to scan and understand.

Transcript:
${transcript}

Please provide the summary now:`
}

export function formatSummaryForConvertKit(
  summary: string,
  videoTitle: string,
  videoDate: string,
  videoId?: string
): string {
  const formattedDate = new Date(videoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const videoIdComment = videoId ? `<!-- TOWNHALL_VIDEO_ID:${videoId} -->` : ''

  return `
${videoIdComment}
<h1>Town Hall Summary - ${formattedDate}</h1>
<h2>${videoTitle}</h2>

${summary}

<hr>

<p><em>This summary was automatically generated from the Town Hall transcript. Watch the full video on <a href="https://youtube.com/@officialmoondao">YouTube</a>.</em></p>
`
}
