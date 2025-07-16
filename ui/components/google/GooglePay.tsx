import Image from 'next/image'
import React, { useEffect, useState, useCallback } from 'react'

// TypeScript interfaces for Google Pay API
interface GooglePayPaymentDataRequest {
  apiVersion: number
  apiVersionMinor: number
  allowedPaymentMethods: Array<{
    type: string
    parameters: {
      allowedAuthMethods: string[]
      allowedCardNetworks: string[]
    }
    tokenizationSpecification: {
      type: string
      parameters: {
        gateway: string
        gatewayMerchantId: string
      }
    }
  }>
  merchantInfo: {
    merchantId: string
    merchantName: string
  }
  transactionInfo: {
    totalPriceStatus: string
    totalPrice: string
    currencyCode: string
    countryCode: string
  }
  shippingAddressRequired?: boolean
  emailRequired?: boolean
}

export interface GooglePayPaymentResult {
  paymentMethodData: {
    description: string
    info: {
      cardNetwork: string
      cardDetails: string
    }
    tokenizationData: {
      type: string
      token: string
    }
    type: string
  }
  email?: string
  shippingAddress?: any
}

export interface GooglePayError {
  statusCode: string
  statusMessage: string
}

export interface GooglePayComponentProps {
  // Payment configuration
  merchantId: string
  merchantName?: string
  gateway?: string
  gatewayMerchantId?: string
  environment?: 'TEST' | 'PRODUCTION'

  // Payment details
  totalPrice: string
  currencyCode?: string
  countryCode?: string

  // Contact fields
  shippingAddressRequired?: boolean
  emailRequired?: boolean

  // Callbacks
  onPaymentSuccess: (result: GooglePayPaymentResult) => Promise<boolean>
  onPaymentError?: (error: GooglePayError) => void
  onPaymentCancel?: () => void

  // UI customization
  buttonColor?: 'default' | 'black' | 'white'
  buttonType?:
    | 'buy'
    | 'book'
    | 'checkout'
    | 'donate'
    | 'fund'
    | 'order'
    | 'pay'
    | 'plain'
    | 'subscribe'
  buttonSizeMode?: 'static' | 'fill'
  disabled?: boolean
  className?: string

  // Debug mode
  debug?: boolean
}

declare global {
  interface Window {
    google?: {
      payments: {
        api: {
          PaymentsClient: new (options: any) => any
        }
      }
    }
  }
}

export default function GooglePayComponent({
  merchantId,
  merchantName = 'MoonDAO',
  gateway = 'stripe', // Default to Stripe
  gatewayMerchantId,
  environment = 'TEST',
  totalPrice,
  currencyCode = 'USD',
  countryCode = 'US',
  shippingAddressRequired = false,
  emailRequired = false,
  onPaymentSuccess,
  onPaymentError,
  onPaymentCancel,
  buttonColor = 'default',
  buttonType = 'pay',
  buttonSizeMode = 'static',
  disabled = false,
  className = '',
  debug = false,
}: GooglePayComponentProps) {
  const [isGooglePayReady, setIsGooglePayReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [paymentsClient, setPaymentsClient] = useState<any>(null)

  // Load Google Pay API
  useEffect(() => {
    console.log('Google Pay: useEffect running, starting script load...')

    const loadGooglePayScript = () => {
      console.log('Google Pay: loadGooglePayScript called')

      if (window.google?.payments?.api) {
        console.log('Google Pay: API already available, initializing...')
        initializeGooglePay()
        return
      }

      console.log('Google Pay: Loading script from CDN...')
      const script = document.createElement('script')
      script.src = 'https://pay.google.com/gp/p/js/pay.js'
      script.async = true
      script.onload = () => {
        console.log('Google Pay: Script loaded successfully')
        initializeGooglePay()
      }
      script.onerror = (error) => {
        console.error('Google Pay: Failed to load script', error)
      }
      document.head.appendChild(script)
      console.log('Google Pay: Script element added to head')
    }

    const initializeGooglePay = () => {
      console.log('Google Pay: Initializing...', {
        hasGoogleAPI: !!window.google?.payments?.api,
        environment,
      })

      if (!window.google?.payments?.api) {
        console.error('Google Pay: API not available')
        return
      }

      try {
        const client = new window.google.payments.api.PaymentsClient({
          environment: environment,
        })

        console.log('Google Pay: Client created successfully')
        setPaymentsClient(client)

        // Check if Google Pay is available
        const isReadyToPayRequest = {
          apiVersion: 2,
          apiVersionMinor: 0,
          allowedPaymentMethods: [
            {
              type: 'CARD',
              parameters: {
                allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
                allowedCardNetworks: ['MASTERCARD', 'VISA', 'AMEX', 'DISCOVER'],
              },
            },
          ],
        }

        console.log(
          'Google Pay: Checking if ready to pay...',
          isReadyToPayRequest
        )

        client
          .isReadyToPay(isReadyToPayRequest)
          .then((response: any) => {
            console.log('Google Pay: Ready to pay response:', response)
            setIsGooglePayReady(response.result)
          })
          .catch((error: any) => {
            console.error('Google Pay: Ready to pay error:', error)
            setIsGooglePayReady(false)
          })
      } catch (error) {
        if (debug) console.error('Google Pay: Initialization error:', error)
        setIsGooglePayReady(false)
      }
    }

    console.log('Google Pay: About to call loadGooglePayScript...')
    loadGooglePayScript()
    console.log('Google Pay: loadGooglePayScript call completed')
  }, [environment, debug])

  // Create payment data request
  const createPaymentDataRequest =
    useCallback((): GooglePayPaymentDataRequest => {
      return {
        apiVersion: 2,
        apiVersionMinor: 0,
        allowedPaymentMethods: [
          {
            type: 'CARD',
            parameters: {
              allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
              allowedCardNetworks: ['MASTERCARD', 'VISA', 'AMEX', 'DISCOVER'],
            },
            tokenizationSpecification: {
              type: 'PAYMENT_GATEWAY',
              parameters: {
                gateway: gateway,
                gatewayMerchantId: gatewayMerchantId || merchantId,
              },
            },
          },
        ],
        merchantInfo: {
          merchantId: merchantId,
          merchantName: merchantName,
        },
        transactionInfo: {
          totalPriceStatus: 'FINAL',
          totalPrice: totalPrice,
          currencyCode: currencyCode,
          countryCode: countryCode,
        },
        shippingAddressRequired,
        emailRequired,
      }
    }, [
      gateway,
      gatewayMerchantId,
      merchantId,
      merchantName,
      totalPrice,
      currencyCode,
      countryCode,
      shippingAddressRequired,
      emailRequired,
    ])

  // Handle Google Pay button click
  const handleGooglePayClick = useCallback(() => {
    if (!paymentsClient || isLoading || disabled) {
      return
    }

    if (parseFloat(totalPrice) <= 0) {
      const error = {
        statusCode: 'INVALID_AMOUNT',
        statusMessage: 'Total price must be greater than 0',
      }
      if (onPaymentError) {
        onPaymentError(error)
      }
      return
    }

    setIsLoading(true)

    try {
      const paymentDataRequest = createPaymentDataRequest()

      if (debug) {
        console.log('Google Pay: Payment data request:', paymentDataRequest)
      }

      paymentsClient
        .loadPaymentData(paymentDataRequest)
        .then(async (paymentData: any) => {
          if (debug)
            console.log('Google Pay: Payment data received:', paymentData)

          try {
            const result: GooglePayPaymentResult = {
              paymentMethodData: paymentData.paymentMethodData,
              email: paymentData.email,
              shippingAddress: paymentData.shippingAddress,
            }

            const success = await onPaymentSuccess(result)

            if (success) {
              if (debug)
                console.log('Google Pay: Payment processed successfully')
            } else {
              if (debug) console.log('Google Pay: Payment processing failed')
              if (onPaymentError) {
                onPaymentError({
                  statusCode: 'PAYMENT_PROCESSING_FAILED',
                  statusMessage: 'Payment processing failed',
                })
              }
            }
          } catch (error) {
            if (debug)
              console.error('Google Pay: Error processing payment:', error)
            if (onPaymentError) {
              onPaymentError({
                statusCode: 'PAYMENT_PROCESSING_ERROR',
                statusMessage:
                  error instanceof Error
                    ? error.message
                    : 'Payment processing error',
              })
            }
          }

          setIsLoading(false)
        })
        .catch((error: any) => {
          if (debug) console.error('Google Pay: Payment error:', error)

          // Handle user cancellation
          if (error.statusCode === 'CANCELED') {
            if (onPaymentCancel) {
              onPaymentCancel()
            }
          } else {
            // Enhanced error logging for OR_BIBED_06 and similar errors
            if (debug) {
              console.error('Google Pay Error Details:', {
                statusCode: error.statusCode,
                statusMessage: error.statusMessage,
                requestDetails: {
                  gateway,
                  gatewayMerchantId: gatewayMerchantId || merchantId,
                  merchantId,
                  environment,
                  totalPrice,
                },
                commonCauses: {
                  OR_BIBED_06:
                    'Merchant integration issue - check gateway configuration, merchant registration, or use "example" gateway for testing',
                  OR_BIBED_07:
                    'Missing Google Play Services or merchant profile access',
                  OR_BIBED_11: 'Merchant not registered for Google Pay API',
                },
              })
            }

            if (onPaymentError) {
              onPaymentError({
                statusCode: error.statusCode || 'UNKNOWN_ERROR',
                statusMessage: error.statusMessage || 'Payment failed',
              })
            }
          }

          setIsLoading(false)
        })
    } catch (error) {
      if (debug) console.error('Google Pay: Error starting payment:', error)

      setIsLoading(false)

      if (onPaymentError) {
        onPaymentError({
          statusCode: 'PAYMENT_START_FAILED',
          statusMessage:
            error instanceof Error
              ? error.message
              : 'Failed to start Google Pay',
        })
      }
    }
  }, [
    paymentsClient,
    createPaymentDataRequest,
    onPaymentSuccess,
    onPaymentError,
    onPaymentCancel,
    isLoading,
    disabled,
    totalPrice,
    debug,
  ])

  if (debug) {
    console.log('Google Pay render decision:', {
      isGooglePayReady,
      isLoading,
      paymentsClient: !!paymentsClient,
      totalPrice,
      disabled,
    })
  }

  // Don't render if Google Pay is not available
  if (!isGooglePayReady) {
    console.log('Google Pay not ready, returning null')
    return null
  }

  const buttonClasses = `
    inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium
    transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
    ${
      buttonColor === 'black'
        ? 'bg-black text-white hover:bg-gray-800 focus:ring-gray-500'
        : buttonColor === 'white'
        ? 'bg-white text-black border border-gray-300 hover:bg-gray-50 focus:ring-gray-500'
        : 'bg-[#4285f4] text-white hover:bg-[#3367d6] focus:ring-blue-500'
    }
    ${
      disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
    }
    ${buttonSizeMode === 'fill' ? 'w-full' : ''}
    ${className}
  `.trim()

  const getButtonText = () => {
    if (isLoading) return 'Processing...'

    const typeMap = {
      buy: 'Buy',
      book: 'Book',
      checkout: 'Checkout',
      donate: 'Donate',
      fund: 'Fund',
      order: 'Order',
      pay: 'Pay',
      plain: '',
      subscribe: 'Subscribe',
    }

    const actionText = typeMap[buttonType] || 'Pay'
    return actionText ? `${actionText} with Google Pay` : 'Google Pay'
  }

  return (
    <button
      onClick={handleGooglePayClick}
      disabled={disabled || isLoading}
      className={buttonClasses}
      type="button"
      aria-label="Pay with Google Pay"
    >
      <div className="flex items-center gap-2">
        <Image
          src="/assets/payment-methods/google-pay.svg"
          alt="Google Pay"
          width={24}
          height={24}
          className="flex-shrink-0"
        />
        <span>{getButtonText()}</span>
      </div>
    </button>
  )
}
