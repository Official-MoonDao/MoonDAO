import {
  cardStyles,
  modalStyles,
  inputStyles,
  buttonStyles,
  spacing,
  transitions,
  commonGradients,
  borderRadius,
  hoverEffects,
  commonCombinations,
  utilityFunctions,
} from '../../../../lib/layout/styles'

describe('Layout Styles', () => {
  describe('cardStyles', () => {
    it('Should have gradient variant', () => {
      expect(cardStyles.gradient).to.be.a('string')
      expect(cardStyles.gradient).to.include('bg-gradient-to-br')
    })

    it('Should have slate variant', () => {
      expect(cardStyles.slate).to.be.a('string')
      expect(cardStyles.slate).to.include('bg-gradient-to-b')
    })

    it('Should have slateBorder variant', () => {
      expect(cardStyles.slateBorder).to.be.a('string')
      expect(cardStyles.slateBorder).to.include('border-slate-600/30')
    })

    it('Should have solid variant', () => {
      expect(cardStyles.solid).to.be.a('string')
      expect(cardStyles.solid).to.include('bg-black/20')
    })

    it('Should have outlined variant', () => {
      expect(cardStyles.outlined).to.be.a('string')
      expect(cardStyles.outlined).to.include('bg-transparent')
    })

    it('Should have wide variant', () => {
      expect(cardStyles.wide).to.be.a('string')
      expect(cardStyles.wide).to.include('bg-dark-cool')
    })

    it('Should have stats variant', () => {
      expect(cardStyles.stats).to.be.a('string')
      expect(cardStyles.stats).to.include('rounded-2xl')
    })

    it('Should have launchpad variant', () => {
      expect(cardStyles.launchpad).to.be.a('string')
      expect(cardStyles.launchpad).to.include('backdrop-blur-sm')
    })
  })

  describe('modalStyles', () => {
    it('Should have base styles', () => {
      expect(modalStyles.base).to.be.a('string')
      expect(modalStyles.base).to.include('bg-dark-cool')
    })

    it('Should have overlay styles', () => {
      expect(modalStyles.overlay).to.be.a('string')
      expect(modalStyles.overlay).to.include('backdrop-blur-sm')
    })
  })

  describe('inputStyles', () => {
    it('Should have standard variant', () => {
      expect(inputStyles.standard).to.be.a('string')
      expect(inputStyles.standard).to.include('rounded-full')
    })

    it('Should have modern variant', () => {
      expect(inputStyles.modern).to.be.a('string')
      expect(inputStyles.modern).to.include('bg-gradient-to-r')
    })

    it('Should have dark variant', () => {
      expect(inputStyles.dark).to.be.a('string')
      expect(inputStyles.dark).to.include('rounded-full')
    })

    it('Should have default variant', () => {
      expect(inputStyles.default).to.be.a('string')
      expect(inputStyles.default).to.include('bg-black/20')
    })
  })

  describe('buttonStyles', () => {
    it('Should have primary variant', () => {
      expect(buttonStyles.primary).to.be.a('string')
      expect(buttonStyles.primary).to.include('bg-gradient-to-r')
    })

    it('Should have secondary variant', () => {
      expect(buttonStyles.secondary).to.be.a('string')
      expect(buttonStyles.secondary).to.include('bg-dark-cool')
    })

    it('Should have gradient variant', () => {
      expect(buttonStyles.gradient).to.be.a('string')
      expect(buttonStyles.gradient).to.include('from-blue-600')
    })
  })

  describe('spacing', () => {
    it('Should have card padding sizes', () => {
      expect(spacing.cardPadding).to.equal('p-6')
      expect(spacing.cardPaddingSmall).to.equal('p-4')
      expect(spacing.cardPaddingLarge).to.equal('p-8')
    })

    it('Should have input padding', () => {
      expect(spacing.inputPadding).to.equal('p-3 px-4')
    })

    it('Should have button padding', () => {
      expect(spacing.buttonPadding).to.equal('px-4 py-2')
    })
  })

  describe('transitions', () => {
    it('Should have default transition', () => {
      expect(transitions.default).to.include('transition-all')
    })

    it('Should have hover transition', () => {
      expect(transitions.hover).to.include('hover:shadow-xl')
    })
  })

  describe('commonGradients', () => {
    it('Should have card gradient', () => {
      expect(commonGradients.cardGradient).to.include('from-gray-900')
    })

    it('Should have slate gradient', () => {
      expect(commonGradients.slateGradient).to.include('from-slate-700/20')
    })

    it('Should have dark gradient', () => {
      expect(commonGradients.darkGradient).to.include('from-[#121C42]')
    })
  })

  describe('borderRadius', () => {
    it('Should have size variants', () => {
      expect(borderRadius.sm).to.equal('rounded-lg')
      expect(borderRadius.md).to.equal('rounded-xl')
      expect(borderRadius.lg).to.equal('rounded-2xl')
      expect(borderRadius.full).to.equal('rounded-full')
    })

    it('Should have custom variants', () => {
      expect(borderRadius.custom.card).to.equal('rounded-[20px]')
      expect(borderRadius.custom.modal).to.equal('rounded-[15px]')
    })
  })

  describe('hoverEffects', () => {
    it('Should have slate card hover', () => {
      expect(hoverEffects.slateCard).to.include('transition-all')
    })

    it('Should have scale effect', () => {
      expect(hoverEffects.scale).to.include('hover:scale-[1.02]')
    })

    it('Should have border effect', () => {
      expect(hoverEffects.border).to.include('hover:border-white/30')
    })

    it('Should have shadow effect', () => {
      expect(hoverEffects.shadow).to.include('hover:shadow-xl')
    })
  })

  describe('commonCombinations', () => {
    it('Should have card container', () => {
      expect(commonCombinations.cardContainer).to.include('backdrop-blur-xl')
    })

    it('Should have slate card container', () => {
      expect(commonCombinations.slateCardContainer).to.include('border-white/10')
    })

    it('Should have project card', () => {
      expect(commonCombinations.projectCard).to.include('hover:scale-[1.02]')
    })

    it('Should have launchpad card', () => {
      expect(commonCombinations.launchpadCard).to.include('bg-black/40')
    })

    it('Should have button base', () => {
      expect(commonCombinations.buttonBase).to.include('shadow-lg')
    })

    it('Should have button states', () => {
      expect(commonCombinations.buttonDisabled).to.equal('opacity-50 cursor-not-allowed')
      expect(commonCombinations.buttonEnabled).to.equal('cursor-pointer')
    })
  })

  describe('utilityFunctions', () => {
    it('Should combine classes correctly', () => {
      const result = utilityFunctions.combine('class1', 'class2', 'class3')
      expect(result).to.equal('class1 class2 class3')
    })

    it('Should filter out falsy values', () => {
      const result = utilityFunctions.combine('class1', null, 'class2', undefined, false, 'class3')
      expect(result).to.equal('class1 class2 class3')
    })

    it('Should return slate hover for slate variant', () => {
      const result = utilityFunctions.cardHover('slate')
      expect(result).to.equal(hoverEffects.slateCard)
    })

    it('Should return scale hover for gradient variant', () => {
      const result = utilityFunctions.cardHover('gradient')
      expect(result).to.equal(hoverEffects.scale)
    })

    it('Should default to slate hover', () => {
      const result = utilityFunctions.cardHover()
      expect(result).to.equal(hoverEffects.slateCard)
    })
  })
})
