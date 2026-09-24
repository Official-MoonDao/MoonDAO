import confetti from 'canvas-confetti'

/** Celebratory burst after a confirmed fund-moving DePrize action. */
export function fireDePrizeConfetti() {
  confetti({
    particleCount: 150,
    spread: 100,
    origin: { y: 0.6 },
    shapes: ['circle', 'star'],
    colors: ['#ffffff', '#FFD700', '#00FFFF', '#ff69b4', '#8A2BE2'],
    // The prediction window stays open, and its overlay is z-[9999].
    zIndex: 10001,
  })
}
