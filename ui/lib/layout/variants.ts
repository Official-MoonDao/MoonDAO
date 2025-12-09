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
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'
export type InputVariant = 'standard' | 'modern' | 'dark' | 'default'
export type InputSize = 'sm' | 'md' | 'lg'
export type ButtonVariant = 'primary' | 'secondary' | 'gradient'
export type ButtonSize = 'sm' | 'md' | 'lg'

export const modalSizes = {
  sm: 'w-screen md:w-[400px]',
  md: 'w-screen md:w-[550px]',
  lg: 'w-screen md:w-[700px]',
  xl: 'w-screen md:w-[900px]',
  full: 'w-screen',
}

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
