import Image from 'next/image'
import React, { useEffect, useState, useCallback } from 'react'

// TypeScript interfaces for Apple Pay API
interface ApplePayPaymentRequest {
  countryCode: string
  currencyCode: string
  supportedNetworks: string[]
  merchantCapabilities: string[]
  total: {
    label: string
    amount: string
    type?: 'final' | 'pending'
  }
  lineItems?: Array<{
    label: string
    amount: string
    type?: 'final' | 'pending'
  }>
  applicationData?: string
  merchantIdentifier?: string
  requiredBillingContactFields?: string[]
  requiredShippingContactFields?: string[]
  shippingMethods?: Array<{
    label: string
    amount: string
    identifier: string
    detail?: string
  }>
}

export interface ApplePayPaymentResult {
  shippingContact?: any
  billingContact?: any
  paymentData: any
  paymentMethod: {
    displayName: string
    network: string
    type: string
  }
}

export interface ApplePayError {
  code: string
  contactField?: string
  message: string
}

export interface ApplePayComponentProps {
  // Payment configuration
  merchantIdentifier: string
  countryCode?: string
  currencyCode?: string
  supportedNetworks?: string[]
  merchantCapabilities?: string[]

  // Payment details
  total: {
    label: string
    amount: string
    type?: 'final' | 'pending'
  }
  lineItems?: Array<{
    label: string
    amount: string
    type?: 'final' | 'pending'
  }>

  // Contact fields
  requiredBillingContactFields?: string[]
  requiredShippingContactFields?: string[]

  // Shipping methods
  shippingMethods?: Array<{
    label: string
    amount: string
    identifier: string
    detail?: string
  }>

  // Callbacks
  onPaymentSuccess: (result: ApplePayPaymentResult) => Promise<boolean>
  onPaymentError?: (error: ApplePayError) => void
  onPaymentCancel?: () => void

  // UI customization
  buttonStyle?: 'black' | 'white' | 'white-outline'
  buttonType?:
    | 'plain'
    | 'buy'
    | 'book'
    | 'checkout'
    | 'donate'
    | 'order'
    | 'pay'
    | 'subscribe'
    | 'support'
  buttonText?: string
  disabled?: boolean
  className?: string

  // Debug mode
  debug?: boolean
}

declare global {
  interface Window {
    ApplePaySession?: any
  }
}

export default function ApplePayComponent({
  merchantIdentifier,
  countryCode = 'US',
  currencyCode = 'USD',
  supportedNetworks = ['visa', 'masterCard', 'amex', 'discover'],
  merchantCapabilities = ['supports3DS'],
  total,
  lineItems = [],
  requiredBillingContactFields = [],
  requiredShippingContactFields = [],
  shippingMethods = [],
  onPaymentSuccess,
  onPaymentError,
  onPaymentCancel,
  buttonStyle = 'black',
  buttonType = 'pay',
  buttonText,
  disabled = false,
  className = '',
  debug = false,
}: ApplePayComponentProps) {
  const [isApplePayAvailable, setIsApplePayAvailable] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [session, setSession] = useState<any>(null)

  // Check Apple Pay availability
  useEffect(() => {
    const checkApplePayAvailability = () => {
      if (typeof window === 'undefined') return false

      if (!window.ApplePaySession) {
        if (debug) console.log('Apple Pay: ApplePaySession not available')
        return false
      }

      if (!window.ApplePaySession.canMakePayments()) {
        if (debug) console.log('Apple Pay: Cannot make payments')
        return false
      }

      // Check if user has payment methods set up
      if (window.ApplePaySession.canMakePaymentsWithActiveCard) {
        window.ApplePaySession.canMakePaymentsWithActiveCard(merchantIdentifier)
          .then((canMakePayments: boolean) => {
            if (debug)
              console.log(
                'Apple Pay: Can make payments with active card:',
                canMakePayments
              )
            setIsApplePayAvailable(canMakePayments)
          })
          .catch((error: any) => {
            if (debug)
              console.error('Apple Pay: Error checking active card:', error)
            setIsApplePayAvailable(false)
          })
      } else {
        // Fallback for older versions
        setIsApplePayAvailable(true)
      }
    }

    checkApplePayAvailability()
  }, [merchantIdentifier, debug])

  // Create payment request
  const createPaymentRequest = useCallback((): ApplePayPaymentRequest => {
    return {
      countryCode,
      currencyCode,
      supportedNetworks,
      merchantCapabilities,
      total,
      lineItems,
      merchantIdentifier,
      requiredBillingContactFields,
      requiredShippingContactFields,
      shippingMethods: shippingMethods.length > 0 ? shippingMethods : undefined,
    }
  }, [
    countryCode,
    currencyCode,
    supportedNetworks,
    merchantCapabilities,
    total,
    lineItems,
    merchantIdentifier,
    requiredBillingContactFields,
    requiredShippingContactFields,
    shippingMethods,
  ])

  // Handle Apple Pay button click
  const handleApplePayClick = useCallback(() => {
    if (!window.ApplePaySession || isLoading || disabled) {
      return
    }

    setIsLoading(true)

    try {
      const paymentRequest = createPaymentRequest()

      if (debug) {
        console.log('Apple Pay: Creating session with request:', paymentRequest)
      }

      // Create Apple Pay session
      const applePaySession = new window.ApplePaySession(3, paymentRequest)
      setSession(applePaySession)

      // Handle merchant validation
      applePaySession.onvalidatemerchant = (event: any) => {
        if (debug) console.log('Apple Pay: Merchant validation required', event)

        // In a real implementation, you would validate the merchant server-side
        // For now, we'll show an error
        const error = {
          code: 'merchantValidationFailed',
          message: 'Merchant validation must be implemented server-side',
        }

        if (onPaymentError) {
          onPaymentError(error)
        }

        applePaySession.abort()
        setIsLoading(false)
      }

      // Handle payment method selection
      applePaySession.onpaymentmethodselected = (event: any) => {
        if (debug) console.log('Apple Pay: Payment method selected', event)

        // Update payment request if needed based on selected payment method
        applePaySession.completePaymentMethodSelection(total, lineItems)
      }

      // Handle shipping contact selection
      applePaySession.onshippingcontactselected = (event: any) => {
        if (debug) console.log('Apple Pay: Shipping contact selected', event)

        // Update shipping methods and totals based on contact
        applePaySession.completeShippingContactSelection(
          window.ApplePaySession.STATUS_SUCCESS,
          shippingMethods,
          total,
          lineItems
        )
      }

      // Handle shipping method selection
      applePaySession.onshippingmethodselected = (event: any) => {
        if (debug) console.log('Apple Pay: Shipping method selected', event)

        // Update totals based on selected shipping method
        applePaySession.completeShippingMethodSelection(total, lineItems)
      }

      // Handle payment authorization
      applePaySession.onpaymentauthorized = async (event: any) => {
        if (debug) console.log('Apple Pay: Payment authorized', event)

        try {
          const paymentResult: ApplePayPaymentResult = {
            shippingContact: event.payment.shippingContact,
            billingContact: event.payment.billingContact,
            paymentData: event.payment.token,
            paymentMethod: event.payment.paymentMethod,
          }

          // Call the success callback
          const success = await onPaymentSuccess(paymentResult)

          if (success) {
            applePaySession.completePayment(
              window.ApplePaySession.STATUS_SUCCESS
            )
            if (debug) console.log('Apple Pay: Payment completed successfully')
          } else {
            applePaySession.completePayment(
              window.ApplePaySession.STATUS_FAILURE
            )
            if (debug) console.log('Apple Pay: Payment processing failed')
          }
        } catch (error) {
          if (debug)
            console.error('Apple Pay: Error processing payment:', error)

          applePaySession.completePayment(window.ApplePaySession.STATUS_FAILURE)

          if (onPaymentError) {
            onPaymentError({
              code: 'paymentProcessingFailed',
              message:
                error instanceof Error
                  ? error.message
                  : 'Payment processing failed',
            })
          }
        }

        setIsLoading(false)
        setSession(null)
      }

      // Handle session cancellation
      applePaySession.oncancel = (event: any) => {
        if (debug) console.log('Apple Pay: Session cancelled', event)

        if (onPaymentCancel) {
          onPaymentCancel()
        }

        setIsLoading(false)
        setSession(null)
      }

      // Begin the session
      applePaySession.begin()
    } catch (error) {
      if (debug) console.error('Apple Pay: Error starting session:', error)

      setIsLoading(false)

      if (onPaymentError) {
        onPaymentError({
          code: 'sessionStartFailed',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to start Apple Pay session',
        })
      }
    }
  }, [
    createPaymentRequest,
    onPaymentSuccess,
    onPaymentError,
    onPaymentCancel,
    isLoading,
    disabled,
    debug,
    total,
    lineItems,
    shippingMethods,
  ])

  // Cleanup session on unmount
  useEffect(() => {
    return () => {
      if (session) {
        try {
          session.abort()
        } catch (error) {
          // Session might already be closed
        }
      }
    }
  }, [session])

  // Don't render if Apple Pay is not available
  if (!isApplePayAvailable) {
    return null
  }

  const buttonClasses = `
    inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium
    transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
    ${
      buttonStyle === 'black'
        ? 'bg-black text-white hover:bg-gray-800 focus:ring-gray-500'
        : buttonStyle === 'white'
        ? 'bg-white text-black border border-gray-300 hover:bg-gray-50 focus:ring-gray-500'
        : 'bg-transparent text-black border border-black hover:bg-black hover:text-white focus:ring-gray-500'
    }
    ${
      disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
    }
    ${className}
  `.trim()

  return (
    <button
      onClick={handleApplePayClick}
      disabled={disabled || isLoading}
      className={buttonClasses}
      type="button"
      aria-label="Pay with Apple Pay"
    >
      <div className="flex items-center gap-2">
        <Image
          src="/assets/payment-methods/apple-pay.svg"
          alt="Apple Pay"
          width={24}
          height={24}
          className="flex-shrink-0"
        />
        <span>
          {isLoading
            ? 'Processing...'
            : buttonText ||
              `${
                buttonType.charAt(0).toUpperCase() + buttonType.slice(1)
              } with Apple Pay`}
        </span>
      </div>
    </button>
  )
}
