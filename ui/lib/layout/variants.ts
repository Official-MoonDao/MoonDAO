export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'

export const modalSizes: Record<ModalSize, string> = {
  sm: 'w-full max-w-sm',
  md: 'w-full max-w-md',
  lg: 'w-full max-w-lg',
  xl: 'w-full max-w-xl',
  '2xl': 'w-full max-w-2xl',
  full: 'w-full max-w-full',
}
