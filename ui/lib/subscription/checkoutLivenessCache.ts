/**
 * Remember a CitizenCheckout liveness read.
 *
 * Only a positive result sticks. poolFee() is called on a CREATE2 address
 * that has no code until the pricing Safe batch, and that batch also rejects
 * direct citizen mints. Keeping a miss would leave the app on the closed path.
 */
export function rememberCheckoutLiveness(
  cache: Map<string, Promise<boolean>>,
  key: string,
  pending: Promise<boolean>
): Promise<boolean> {
  cache.set(key, pending)
  void pending.then(
    (live) => {
      if (!live && cache.get(key) === pending) cache.delete(key)
    },
    () => {
      if (cache.get(key) === pending) cache.delete(key)
    }
  )
  return pending
}
