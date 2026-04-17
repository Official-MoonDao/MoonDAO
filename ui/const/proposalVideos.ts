// Links to each project proposal's video presentation. Keyed by MDP number.
// Timestamps in the URLs deep-link into the Senate review livestream.
export const PROPOSAL_VIDEOS: Record<number, string> = {
  230: 'https://www.youtube.com/watch?v=bvOK0UFr19M&t=740s',
  231: 'https://www.youtube.com/watch?v=bvOK0UFr19M&t=1055s',
  232: 'https://www.youtube.com/watch?v=bvOK0UFr19M&t=1477s',
  233: 'https://www.youtube.com/watch?v=bvOK0UFr19M&t=6897s',
  235: 'https://www.youtube.com/watch?v=bvOK0UFr19M&t=1992s',
  237: 'https://www.youtube.com/watch?v=bvOK0UFr19M&t=2585s',
  238: 'https://www.youtube.com/watch?v=bvOK0UFr19M&t=3240s',
  239: 'https://www.youtube.com/watch?v=bvOK0UFr19M&t=3908s',
  240: 'https://www.youtube.com/watch?v=bvOK0UFr19M&t=5656s',
  241: 'https://www.youtube.com/watch?v=bvOK0UFr19M&t=5439s',
  242: 'https://www.youtube.com/watch?v=bvOK0UFr19M&t=5439s',
  244: 'https://www.youtube.com/watch?v=bvOK0UFr19M&t=4635s',
  245: 'https://www.youtube.com/watch?v=bvOK0UFr19M&t=6304s',
  248: 'https://www.youtube.com/watch?v=bvOK0UFr19M&t=3240s',
}

export function getProposalVideoUrl(mdp: number | undefined | null): string | null {
  if (mdp == null) return null
  return PROPOSAL_VIDEOS[mdp] ?? null
}
