export const cardStyles = {
  gradient:
    'bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl',
  slate:
    'bg-gradient-to-b from-slate-700/20 to-slate-800/30 backdrop-blur-xl border border-white/10 rounded-xl shadow-lg',
  slateBorder:
    'bg-gradient-to-b from-slate-700/20 to-slate-800/30 backdrop-blur-xl border border-slate-600/30 rounded-2xl',
  solid: 'bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl',
  outlined: 'bg-transparent border border-white/10 rounded-2xl',
  wide: 'bg-dark-cool rounded-[20px]',
  stats:
    'bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30',
  launchpad: 'bg-gradient-to-br backdrop-blur-sm rounded-3xl border border-white/20',
}

export const inputStyles = {
  standard: 'bg-[#0f152f] rounded-full',
  modern:
    'bg-gradient-to-r from-slate-800/50 to-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20 transition-all',
  dark: 'bg-gradient-to-r from-[#000000] to-[#040617] placeholder:opacity-50 rounded-full',
  default:
    'bg-black/20 border border-white/10 rounded-lg p-4 text-white placeholder-gray-400 hover:bg-black/30 hover:border-white/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50',
}

export const buttonStyles = {
  primary: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700',
  secondary: 'bg-dark-cool hover:bg-mid-cool',
  gradient: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700',
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
  hover: 'transition-all duration-300 hover:shadow-xl',
}

export const commonGradients = {
  cardGradient: 'from-gray-900 via-blue-900/30 to-purple-900/20',
  slateGradient: 'from-slate-700/20 to-slate-800/30',
  darkGradient: 'from-[#121C42] to-[#090D21]',
}

export const borderRadius = {
  sm: 'rounded-lg',
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  full: 'rounded-full',
  custom: {
    card: 'rounded-[20px]',
    modal: 'rounded-[15px]',
  },
}

export const hoverEffects = {
  slateCard:
    'transition-all duration-300 hover:bg-gradient-to-b hover:from-slate-600/30 hover:to-slate-700/40 hover:shadow-xl',
  scale: 'transition-transform duration-300 hover:scale-[1.02]',
  border: 'transition-all duration-300 hover:border-white/30',
  shadow: 'transition-all duration-200 shadow-lg hover:shadow-xl',
}

export const commonCombinations = {
  cardContainer: 'backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl',
  slateCardContainer: 'backdrop-blur-xl border border-white/10 rounded-xl shadow-lg',
  slateCardHover:
    'bg-gradient-to-b from-slate-700/20 to-slate-800/30 backdrop-blur-xl border border-white/10 rounded-xl shadow-lg transition-all duration-300 hover:bg-gradient-to-b hover:from-slate-600/30 hover:to-slate-700/40 hover:shadow-xl',
  projectCard:
    'bg-gradient-to-br from-slate-700/20 to-slate-800/30 backdrop-blur-xl border border-white/10 rounded-xl shadow-lg transition-all duration-300 hover:bg-gradient-to-br hover:from-slate-600/30 hover:to-slate-700/40 hover:shadow-xl hover:scale-[1.02]',
  launchpadCard:
    'bg-black/40 backdrop-blur-sm rounded-xl md:rounded-2xl border border-white/10 hover:border-white/30 transition-all duration-300',
  buttonBase: 'px-4 py-2 font-medium transition-all duration-200 shadow-lg hover:shadow-xl',
  buttonDisabled: 'opacity-50 cursor-not-allowed',
  buttonEnabled: 'cursor-pointer',
}

export const modalStyles = {
  base: 'bg-dark-cool rounded-lg shadow-xl',
  overlay: 'backdrop-blur-sm bg-black/50',
}

export const utilityFunctions = {
  combine: (...classes: (string | undefined | null | false)[]): string => {
    return classes.filter(Boolean).join(' ')
  },
  cardHover: (variant: 'slate' | 'gradient' = 'slate'): string => {
    return variant === 'slate' ? hoverEffects.slateCard : hoverEffects.scale
  },
}
