export type CardVariant =
  | 'gradient'
  | 'slate'
  | 'slateBorder'
  | 'solid'
  | 'outlined'
  | 'wide'
  | 'stats'
  | 'launchpad'
export type CardSize = 'sm' | 'md' | 'lg'
export type CardLayout = 'standard' | 'wide' | 'compact' | 'stats' | 'feature' | 'launchpad'
export type InputVariant = 'standard' | 'modern' | 'dark' | 'default'
export type InputSize = 'sm' | 'md' | 'lg'
export type ButtonVariant = 'primary' | 'secondary' | 'gradient'
export type ButtonSize = 'sm' | 'md' | 'lg'
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full'

export const cardSizes = {
  sm: 'max-w-[300px]',
  md: 'max-w-[400px]',
  lg: 'max-w-[500px]',
}

export const inputSizes = {
  sm: 'p-2 px-3 text-sm',
  md: 'p-3 px-4',
  lg: 'p-4 px-5 text-lg',
}

export const buttonSizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2',
  lg: 'px-6 py-3 text-lg',
}

export const modalSizes: Record<ModalSize, string> = {
  sm: 'w-full max-w-sm',
  md: 'w-full max-w-md',
  lg: 'w-full max-w-lg',
  xl: 'w-full max-w-xl',
  '2xl': 'w-full max-w-2xl',
  '3xl': 'w-full max-w-3xl',
  '4xl': 'w-full max-w-4xl',
  '5xl': 'w-full max-w-5xl',
  full: 'w-full max-w-full',
}
