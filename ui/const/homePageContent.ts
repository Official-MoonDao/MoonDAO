import type { Film } from '@/components/layout/FilmPlayer'

// "What is MoonDAO?" film (1:59, voiceover) in the homepage hero. The film
// frame stays hidden while HOME_FILM_VIMEO_ID is empty. Set it to the Vimeo
// video ID once the film is uploaded, and set HOME_FILM_UPLOAD_DATE
// (YYYY-MM-DD) for the VideoObject structured data.
export const HOME_FILM_VIMEO_ID: string = '1235606252'
export const HOME_FILM_UPLOAD_DATE: string = '2026-10-13'

export const homeFilm: Film & { description: string; duration: string; poster: string } = {
  name: 'What is MoonDAO?',
  description:
    "For fifty years, space has belonged to a few governments. MoonDAO is a space program run by its builders: engineers, researchers and astronauts all over the world who fund it, vote on it and build it. Members have sent two everyday people to space, funded over a hundred projects from rover prototypes to lunar research, and landed a constitution on the Moon. Next: a permanent base on the Moon. Join the Internet's Space Program: https://moondao.com/join",
  duration: 'PT1M59S',
  durationLabel: '1:59',
  poster: '/assets/home-film-poster.jpg',
  loopPoster: '/assets/home-teaser-loop-poster.jpg',
  loopWebm: '/assets/home-teaser-loop.webm',
  loopMp4: '/assets/home-teaser-loop.mp4',
}

// The text-free hero plate that plays behind the H1.
export const homePlate = {
  poster: '/assets/home-plate-poster.jpg',
  webm: '/assets/home-plate.webm',
  mp4: '/assets/home-plate.mp4',
}
