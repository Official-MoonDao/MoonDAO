// "How to lock MOONEY" film (1:07, voiceover) in the /lock hero. The hero stays
// hidden while LOCK_FILM_VIMEO_ID is empty (the page falls back to the
// ContentLayout header). Set it to the Vimeo video ID once the film is uploaded,
// and set LOCK_FILM_UPLOAD_DATE (YYYY-MM-DD) for the VideoObject structured data.
export const LOCK_FILM_VIMEO_ID: string = '1242461464'
export const LOCK_FILM_UPLOAD_DATE: string = '2026-11-02'

export const lockFilm = {
  name: 'How to lock MOONEY',
  description:
    "Lock your MOONEY to get a say in MoonDAO. Enter an amount, choose how long, and lock: the longer you lock, the more voting power you get, up to four years. Voting power is the square root of your vMOONEY, so smaller holders don't get drowned out. It winds down as your unlock date gets closer; extend anytime to raise it back up. https://moondao.com/lock",
  duration: 'PT1M7S',
  durationLabel: '1:07',
  poster: '/assets/lock-film-poster.jpg',
  loopPoster: '/assets/lock-loop-poster.jpg',
  loopWebm: '/assets/lock-loop.webm',
  loopMp4: '/assets/lock-loop.mp4',
}
