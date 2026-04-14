export const cardStyles = {
  gradient:
    'bg-gradient-to-br from-[#0a0a0a] via-[#0a1218] to-[#0a0a12] backdrop-blur-xl border border-[rgba(0,255,200,0.15)] rounded-sm shadow-[0_0_15px_rgba(0,255,200,0.05)]',
  slate:
    'bg-gradient-to-b from-[#0a0f12] to-[#080a10] backdrop-blur-xl border border-[rgba(0,255,200,0.12)] rounded-sm shadow-[0_0_10px_rgba(0,255,200,0.03)]',
  slateBorder:
    'bg-gradient-to-b from-[#0a0f12] to-[#080a10] backdrop-blur-xl border border-[rgba(0,255,200,0.2)] rounded-sm',
  solid: 'bg-[#050508]/80 backdrop-blur-sm border border-[rgba(0,255,200,0.12)] rounded-sm',
  outlined: 'bg-transparent border border-[rgba(0,255,200,0.15)] rounded-sm',
  wide: 'bg-dark-cool rounded-sm',
  stats:
    'bg-gradient-to-b from-[#0a0f12] to-[#080a10] rounded-sm border border-[rgba(0,255,200,0.15)]',
  launchpad: 'bg-gradient-to-br from-[#0a0a0a] to-[#0a1218] backdrop-blur-sm rounded-sm border border-[rgba(0,255,200,0.2)]',
}

export const modalStyles = {
  base: 'bg-[#0a0a12] rounded-sm shadow-[0_0_30px_rgba(0,255,200,0.1)] border border-[rgba(0,255,200,0.2)]',
  overlay:
    'fixed top-0 left-0 w-screen h-screen bg-[#000000cc] backdrop-blur-sm flex justify-center items-start z-[9999] overflow-auto animate-fadeIn',
}

export const inputStyles = {
  standard: 'bg-[#0a0f12] rounded-sm border border-[rgba(0,255,200,0.15)]',
  modern:
    'bg-gradient-to-r from-[#0a0a0a] to-[#0a0f12] border border-[rgba(0,255,200,0.2)] rounded-sm text-[#e0fff0] placeholder:text-[rgba(0,255,200,0.4)] focus:border-[#00ffc8] focus:ring-1 focus:ring-[rgba(0,255,200,0.2)] transition-all',
  dark: 'bg-gradient-to-r from-[#050505] to-[#0a0a12] placeholder:opacity-60 rounded-sm text-[#e0fff0] border border-[rgba(0,255,200,0.1)]',
  default:
    'bg-[#050508]/80 border border-[rgba(0,255,200,0.15)] rounded-sm p-4 text-[#e0fff0] placeholder-[rgba(0,255,200,0.4)] hover:bg-[#0a0f12] hover:border-[rgba(0,255,200,0.25)] transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-[rgba(0,255,200,0.3)] focus:border-[#00ffc8]',
}

export const buttonStyles = {
  primary: 'bg-gradient-to-r from-[#00aa88] to-[#007a66] hover:from-[#00cc99] hover:to-[#00aa88] text-[#050505] shadow-[0_0_10px_rgba(0,255,200,0.2)]',
  secondary: 'bg-dark-cool hover:bg-mid-cool border border-[rgba(0,255,200,0.15)]',
  gradient: 'bg-gradient-to-r from-[#00aa88] to-[#7b2fff] hover:from-[#00cc99] hover:to-[#9b4fff] shadow-[0_0_10px_rgba(0,255,200,0.15)]',
}

export const spacing = {
  cardPadding: 'p-6',
  cardPaddingSmall: 'p-4',
  cardPaddingLarge: 'p-8',
  inputPadding: 'p-3 px-4',
  buttonPadding: 'px-4 py-2',
}

export const transitions = {
  default: 'transition-all duration-200',
  hover: 'transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,255,200,0.1)]',
}

export const commonGradients = {
  cardGradient: 'from-[#0a0a0a] via-[#0a1218] to-[#0a0a12]',
  slateGradient: 'from-[#0a0f12] to-[#080a10]',
  darkGradient: 'from-[#0a1218] to-[#050508]',
}

export const borderRadius = {
  sm: 'rounded-sm',
  md: 'rounded-sm',
  lg: 'rounded-sm',
  full: 'rounded-sm',
  custom: {
    card: 'rounded-sm',
    modal: 'rounded-sm',
  },
}

export const hoverEffects = {
  slateCard:
    'transition-all duration-300 hover:bg-gradient-to-b hover:from-[#0a1218] hover:to-[#0a0f12] hover:shadow-[0_0_15px_rgba(0,255,200,0.08)] hover:border-[rgba(0,255,200,0.25)]',
  scale: 'transition-transform duration-300 hover:scale-[1.02]',
  border: 'transition-all duration-300 hover:border-[rgba(0,255,200,0.3)]',
  shadow: 'transition-all duration-200 shadow-[0_0_10px_rgba(0,255,200,0.03)] hover:shadow-[0_0_20px_rgba(0,255,200,0.08)]',
}

export const networkCard = {
  base: 'bg-gradient-to-br from-[#0a1218] to-[#0a0a12] backdrop-blur-sm rounded-sm border border-[rgba(0,255,200,0.1)]',
  hover: 'hover:shadow-[0_0_20px_rgba(0,255,200,0.1)]',
  full: 'bg-gradient-to-br from-[#0a1218] to-[#0a0a12] backdrop-blur-sm rounded-sm border border-[rgba(0,255,200,0.1)] hover:shadow-[0_0_20px_rgba(0,255,200,0.1)] transition-all duration-300',
}

export const commonCombinations = {
  cardContainer: 'backdrop-blur-xl border border-[rgba(0,255,200,0.15)] rounded-sm shadow-[0_0_15px_rgba(0,255,200,0.05)]',
  slateCardContainer: 'backdrop-blur-xl border border-[rgba(0,255,200,0.12)] rounded-sm shadow-[0_0_10px_rgba(0,255,200,0.03)]',
  slateCardHover:
    'bg-gradient-to-b from-[#0a0f12] to-[#080a10] backdrop-blur-xl border border-[rgba(0,255,200,0.12)] rounded-sm shadow-[0_0_10px_rgba(0,255,200,0.03)] transition-all duration-300 hover:from-[#0a1218] hover:to-[#0a0f12] hover:shadow-[0_0_15px_rgba(0,255,200,0.08)]',
  projectCard:
    'bg-gradient-to-br from-[#0a0f12] to-[#080a10] backdrop-blur-xl border border-[rgba(0,255,200,0.12)] rounded-sm shadow-[0_0_10px_rgba(0,255,200,0.03)] transition-all duration-300 hover:from-[#0a1218] hover:to-[#0a0f12] hover:shadow-[0_0_15px_rgba(0,255,200,0.08)] hover:scale-[1.02]',
  launchpadCard:
    'bg-[#050508]/80 backdrop-blur-sm rounded-sm border border-[rgba(0,255,200,0.12)] hover:border-[rgba(0,255,200,0.25)] transition-all duration-300',
  buttonBase: 'px-4 py-2 font-medium transition-all duration-200 shadow-[0_0_10px_rgba(0,255,200,0.08)]',
  buttonDisabled: 'opacity-50 cursor-not-allowed',
  buttonEnabled: 'cursor-pointer',
}

export const utilityFunctions = {
  combine: (...classes: (string | undefined | null | false)[]): string => {
    return classes.filter(Boolean).join(' ')
  },
  cardHover: (variant: 'slate' | 'gradient' = 'slate'): string => {
    return variant === 'slate' ? hoverEffects.slateCard : hoverEffects.scale
  },
}
