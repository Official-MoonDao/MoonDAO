// "Idea to funded" film (1:36, voiceover) in the /proposals hero. The hero film
// stays hidden while PROPOSALS_FILM_VIMEO_ID is empty. Set it to the Vimeo video
// ID once the film is uploaded, and set PROPOSALS_FILM_UPLOAD_DATE (YYYY-MM-DD)
// for the VideoObject structured data.
export const PROPOSALS_FILM_VIMEO_ID: string = '1237747640'
export const PROPOSALS_FILM_UPLOAD_DATE: string = '2026-10-20'

export const proposalsFilm = {
  name: 'Idea to funded: the MoonDAO project system',
  description:
    "Go from idea to funding in weeks, not months. MoonDAO's project system: submit a proposal, get a deep-dive review from the Senate, pitch it live at Town Hall, and let the community vote. Funded teams build in the open and earn retroactive rewards when they ship. Over a hundred projects funded so far, from a lunar rover simulator to an atomic clock for timing on the Moon. What will you build? https://moondao.com/propose",
  duration: 'PT1M36S',
  durationLabel: '1:36',
  poster: '/assets/proposals-film-poster.jpg',
  loopPoster: '/assets/proposals-loop-poster.jpg',
  loopWebm: '/assets/proposals-loop.webm',
  loopMp4: '/assets/proposals-loop.mp4',
}
