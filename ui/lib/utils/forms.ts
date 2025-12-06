export interface FormValidationResult {
  isValid: boolean
  error?: string
}

export interface FormSubmissionOptions {
  onSuccess?: () => void
  onError?: (error: string) => void
  validateBeforeSubmit?: () => FormValidationResult | Promise<FormValidationResult>
}

export const formUtils = {
  validateRequired: (value: string | undefined | null, fieldName: string): FormValidationResult => {
    if (!value || value.trim() === '') {
      return {
        isValid: false,
        error: `Please enter a ${fieldName}.`,
      }
    }
    return { isValid: true }
  },

  validateEmail: (email: string): FormValidationResult => {
    if (!email || !email.includes('@')) {
      return {
        isValid: false,
        error: 'Please enter a valid email address.',
      }
    }
    return { isValid: true }
  },

  validateUrl: (url: string): FormValidationResult => {
    try {
      new URL(url)
      return { isValid: true }
    } catch {
      return {
        isValid: false,
        error: 'Please enter a valid URL.',
      }
    }
  },

  validateEthereumAddress: (address: string): FormValidationResult => {
    const addressRegex = /^0x[a-fA-F0-9]{40}$/
    if (!addressRegex.test(address)) {
      return {
        isValid: false,
        error: 'Please enter a valid Ethereum address.',
      }
    }
    return { isValid: true }
  },

  validateMinLength: (
    value: string,
    minLength: number,
    fieldName: string
  ): FormValidationResult => {
    if (value.length < minLength) {
      return {
        isValid: false,
        error: `${fieldName} must be at least ${minLength} characters.`,
      }
    }
    return { isValid: true }
  },

  validateNumber: (value: string | number, fieldName: string): FormValidationResult => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(numValue)) {
      return {
        isValid: false,
        error: `Please enter a valid number for ${fieldName}.`,
      }
    }
    return { isValid: true }
  },

  validateMinValue: (value: number, minValue: number, fieldName: string): FormValidationResult => {
    if (value < minValue) {
      return {
        isValid: false,
        error: `${fieldName} must be at least ${minValue}.`,
      }
    }
    return { isValid: true }
  },

  validateDate: (date: Date | string | number, fieldName: string): FormValidationResult => {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
    if (isNaN(dateObj.getTime())) {
      return {
        isValid: false,
        error: `Please enter a valid date for ${fieldName}.`,
      }
    }
    return { isValid: true }
  },

  validateFutureDate: (date: Date | string | number, fieldName: string): FormValidationResult => {
    const dateValidation = formUtils.validateDate(date, fieldName)
    if (!dateValidation.isValid) return dateValidation

    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
    const now = new Date()
    if (dateObj <= now) {
      return {
        isValid: false,
        error: `${fieldName} must be in the future.`,
      }
    }
    return { isValid: true }
  },

  cleanFormData: <T extends Record<string, any>>(data: T): T => {
    const cleaned: any = {}
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        cleaned[key] = value.trim()
      } else {
        cleaned[key] = value
      }
    }
    return cleaned as T
  },
}
