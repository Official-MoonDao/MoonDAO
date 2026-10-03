import { useLinkEmail, useLinkPhone, useLoginWithSms } from '@privy-io/react-auth'
import { FormEvent, useEffect, useState } from 'react'
import { sameGuestCheckoutPhone, toGuestCheckoutPhone } from '@/lib/coinbase/guestCheckoutPhone'
import { OnrampVerification } from '@/lib/coinbase/useOnrampVerification'

const inputClass =
  'w-full bg-black/30 border border-white/15 rounded-lg py-3 px-3 text-base text-white placeholder-gray-500 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50 outline-none touch-manipulation'

const actionClass =
  'shrink-0 rounded-lg bg-white/10 px-3 py-3 text-sm font-semibold text-blue-200 hover:bg-white/15 disabled:opacity-50 touch-manipulation'

function friendlyOtpError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : ''
  if (/must be authenticated/i.test(message)) {
    return 'Sign in first, then verify your details here.'
  }
  if (/already has (a phone|an email)/i.test(message)) {
    return fallback
  }
  return message || fallback
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-gray-500'}`}
    />
  )
}

function OtpFields({
  id,
  inputType,
  inputMode,
  autoComplete,
  name,
  placeholder,
  initialValue = '',
  readOnly = false,
  sendLabel,
  testId,
  onSend,
  onVerify,
}: {
  id: string
  inputType: 'tel' | 'email'
  inputMode: 'tel' | 'email' | 'numeric'
  autoComplete: string
  name: string
  placeholder: string
  initialValue?: string
  readOnly?: boolean
  sendLabel: string
  testId: string
  onSend: (value: string) => Promise<void>
  onVerify: (code: string) => Promise<void>
}) {
  const [value, setValue] = useState(initialValue)
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'details' | 'code'>('details')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (initialValue) setValue((current) => current || initialValue)
  }, [initialValue])

  const send = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onSend(value)
      setStep('code')
    } catch (err) {
      setError(friendlyOtpError(err, 'Could not send a code. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const verify = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) {
      setError('Enter the code from your message.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onVerify(trimmed)
    } catch (err) {
      setError(friendlyOtpError(err, 'That code did not work. Request a new one and try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'code') {
    return (
      <form onSubmit={verify} className="mt-2 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={`${id}-code`}
            data-testid={`${testId}-code`}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\s/g, ''))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            className={inputClass}
          />
          <button type="submit" disabled={submitting} className={actionClass}>
            {submitting ? 'Checking…' : 'Verify'}
          </button>
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-blue-300 underline hover:text-blue-200"
          onClick={() => {
            setStep('details')
            setCode('')
            setError(null)
          }}
        >
          Send a new code
        </button>
        {error && <p className="text-xs leading-relaxed text-red-200">{error}</p>}
      </form>
    )
  }

  return (
    <form onSubmit={send} className="mt-2 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          data-testid={testId}
          type={inputType}
          inputMode={inputMode}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          name={name}
          readOnly={readOnly}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          className={inputClass}
        />
        <button type="submit" disabled={submitting || !value.trim()} className={actionClass}>
          {submitting ? 'Sending…' : sendLabel}
        </button>
      </div>
      {error && <p className="text-xs leading-relaxed text-red-200">{error}</p>}
    </form>
  )
}

export function OnrampVerificationCard({
  verification,
  payLabel,
}: {
  verification: OnrampVerification
  payLabel: string
}) {
  const phoneLink = useLinkPhone()
  const emailLink = useLinkEmail()
  // Re-verifying a number that is already linked cannot go through useLinkPhone
  // (it refuses). Privy's SMS login hook refreshes latestVerifiedAt instead,
  // which is what Coinbase's 60-day check reads.
  const phoneRefresh = useLoginWithSms()
  const phoneBlocked = !verification.hasPhone && verification.phoneVerificationStale
  const shownPhone =
    verification.phoneNumber || (phoneBlocked ? verification.linkedPhoneNumber : null)

  const sendPhone = async (raw: string) => {
    const phone = toGuestCheckoutPhone(raw)
    if (!phone) {
      throw new Error('Enter a US phone number, including area code.')
    }
    if (verification.phoneVerificationStale) {
      if (
        verification.linkedPhoneNumber &&
        !sameGuestCheckoutPhone(raw, verification.linkedPhoneNumber)
      ) {
        throw new Error('Re-verify the number already on your account.')
      }
      await phoneRefresh.sendCode({ phoneNumber: phone })
      return
    }
    await phoneLink.sendCode({ phoneNumber: phone })
  }

  const verifyPhone = async (code: string) => {
    if (verification.phoneVerificationStale) {
      await phoneRefresh.loginWithCode({ code })
      return
    }
    await phoneLink.linkWithCode({ code })
  }

  const sendEmail = async (raw: string) => {
    const email = raw.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Enter a valid email address.')
    }
    await emailLink.sendCode({ email })
  }

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold text-gray-200">Verify your details</p>
      <p className="text-xs leading-relaxed text-gray-400">
        Coinbase {payLabel} checkout needs a verified US phone number and email. Enter them here —
        the code field stays on this screen.
      </p>

      <div>
        <div className="flex items-center gap-2 text-sm">
          <StatusDot ok={verification.hasPhone} />
          <span className="text-gray-300">Phone{shownPhone ? `: ${shownPhone}` : ''}</span>
        </div>
        {!verification.hasPhone && (
          <>
            {phoneBlocked && (
              <p className="mt-1 text-xs leading-relaxed text-gray-400">
                This number needs a fresh code before Apple Pay or Google Pay can start.
              </p>
            )}
            <OtpFields
              id="onramp-phone"
              testId="onramp-phone-input"
              inputType="tel"
              inputMode="tel"
              autoComplete="tel"
              name="tel"
              placeholder="(555) 555-5555"
              initialValue={phoneBlocked ? verification.linkedPhoneNumber || '' : ''}
              sendLabel="Text me a code"
              onSend={sendPhone}
              onVerify={verifyPhone}
            />
          </>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 text-sm">
          <StatusDot ok={verification.hasEmail} />
          <span className="text-gray-300">
            Email{verification.email ? `: ${verification.email}` : ''}
          </span>
        </div>
        {!verification.hasEmail && phoneBlocked && (
          <p className="mt-1 text-xs leading-relaxed text-gray-400">
            Verify your phone first, then add your email.
          </p>
        )}
        {!verification.hasEmail && !phoneBlocked && (
          <OtpFields
            id="onramp-email"
            testId="onramp-email-input"
            inputType="email"
            inputMode="email"
            autoComplete="email"
            name="email"
            placeholder="you@email.com"
            sendLabel="Email me a code"
            onSend={sendEmail}
            onVerify={async (code) => {
              await emailLink.linkWithCode({ code })
            }}
          />
        )}
      </div>
    </div>
  )
}
