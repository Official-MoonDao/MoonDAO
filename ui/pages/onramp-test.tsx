/**
 * LOCAL-ONLY throwaway page: a FAKE MISSION page used to preview how the
 * Coinbase Headless Onramp (Apple Pay) looks/feels inside a real mission
 * contribution flow — without needing a live mission, citizen mint, or the
 * isUS region gate (which can't be satisfied behind a local proxy because the
 * Vercel geo headers are absent).
 *
 * It reproduces the visual language of <MissionContributeModal/> (hero,
 * funding bar, contribution card with message + payment breakdown + email +
 * terms checkbox) and embeds the real <CBHeadlessOnramp/> exactly where the
 * onramp appears in the modal once the user agrees + provides an email.
 *
 * DO NOT COMMIT. Delete when done:
 *   rm ui/pages/onramp-test.tsx
 *
 * Usage: log in via the normal nav (Privy), link a verified US phone, then
 * visit https://moondao.com/onramp-test
 */
import { useContext, useMemo, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { CBHeadlessOnramp } from '@/components/coinbase/CBHeadlessOnramp'

// --- Fake mission data (purely cosmetic) -----------------------------------
const FAKE_MISSION = {
  id: 999,
  title: 'Lunar Relay Beacon',
  tagline:
    'Deploy a solar-powered communications beacon to the lunar south pole to relay data for future surface missions.',
  team: 'MoonDAO Test Team',
  goalUsd: 50000,
  raisedUsd: 31250,
  backers: 412,
  daysLeft: 9,
}

const QUICK_AMOUNTS = [10, 25, 50, 100]

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

export default function FakeMissionOnrampPage() {
  const account = useActiveAccount()
  const { selectedChain } = useContext(ChainContextV5)

  const [usdInput, setUsdInput] = useState<string>('10')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [agreed, setAgreed] = useState(false)

  const usdValue = useMemo(() => {
    const n = parseFloat(usdInput.replace(/,/g, ''))
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [usdInput])

  // Rough ETH estimate just for display (real quote comes from the onramp).
  const FAKE_ETH_PRICE = 3300
  const ethAmount = useMemo(() => usdValue / FAKE_ETH_PRICE, [usdValue])

  const emailValid = isValidEmail(email)
  const onrampReady = usdValue > 0 && agreed && emailValid && !!account?.address

  const pct = Math.min(
    100,
    Math.round((FAKE_MISSION.raisedUsd / FAKE_MISSION.goalUsd) * 100)
  )

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(1200px 600px at 50% -10%, #1b1b3a 0%, #0b0b12 60%)',
        color: 'white',
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        padding: '32px 16px 80px',
      }}
    >
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        <div
          style={{
            display: 'inline-block',
            fontSize: 11,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: '#fca5a5',
            border: '1px solid #ef444450',
            background: '#ef444415',
            borderRadius: 999,
            padding: '4px 10px',
            marginBottom: 16,
          }}
        >
          Local preview · fake mission · no real data
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
            gap: 24,
            alignItems: 'start',
          }}
        >
          {/* LEFT: mission hero */}
          <div>
            <div
              style={{
                height: 220,
                borderRadius: 20,
                background:
                  'linear-gradient(135deg, #3b1d72 0%, #1e3a8a 50%, #0ea5b7 100%)',
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid #ffffff14',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'radial-gradient(400px 200px at 80% 20%, #ffffff30, transparent)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 16,
                  left: 20,
                  fontSize: 13,
                  opacity: 0.85,
                }}
              >
                by {FAKE_MISSION.team}
              </div>
            </div>

            <h1 style={{ fontSize: 30, fontWeight: 700, margin: '20px 0 8px' }}>
              {FAKE_MISSION.title}
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: '#cbd5e1' }}>
              {FAKE_MISSION.tagline}
            </p>

            {/* Funding progress */}
            <div
              style={{
                marginTop: 24,
                background: 'linear-gradient(180deg,#1e293b55,#0f172a66)',
                border: '1px solid #ffffff14',
                borderRadius: 16,
                padding: 20,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 24, fontWeight: 700 }}>
                  ${FAKE_MISSION.raisedUsd.toLocaleString()}
                </span>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>
                  of ${FAKE_MISSION.goalUsd.toLocaleString()} goal
                </span>
              </div>
              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: '#ffffff14',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 24,
                  marginTop: 14,
                  fontSize: 13,
                  color: '#94a3b8',
                }}
              >
                <span>
                  <b style={{ color: 'white' }}>{pct}%</b> funded
                </span>
                <span>
                  <b style={{ color: 'white' }}>{FAKE_MISSION.backers}</b>{' '}
                  backers
                </span>
                <span>
                  <b style={{ color: 'white' }}>{FAKE_MISSION.daysLeft}</b> days
                  left
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: contribution card (mirrors MissionContributeModal) */}
          <div
            style={{
              background:
                'linear-gradient(180deg, rgba(30,41,59,0.55), rgba(15,23,42,0.75))',
              border: '1px solid #ffffff1f',
              borderRadius: 20,
              padding: 24,
              backdropFilter: 'blur(8px)',
              position: 'sticky',
              top: 24,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              Contribute to this mission
            </h2>
            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>
              Pay with Apple Pay — funds convert to ETH and route to your
              wallet, then contribute on-chain.
            </p>

            {/* Amount */}
            <label
              style={{
                display: 'block',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: '#cbd5e1',
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              Amount (USD)
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#00000050',
                border: '1px solid #ffffff1a',
                borderRadius: 12,
                padding: '4px 14px',
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 22, color: '#94a3b8' }}>$</span>
              <input
                inputMode="decimal"
                value={usdInput}
                onChange={(e) =>
                  setUsdInput(e.target.value.replace(/[^0-9.,]/g, ''))
                }
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'white',
                  fontSize: 22,
                  padding: '10px 8px',
                }}
              />
              <span style={{ fontSize: 12, color: '#64748b' }}>
                ≈ {ethAmount.toFixed(5)} ETH
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => setUsdInput(String(a))}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: 10,
                    border:
                      usdValue === a
                        ? '1px solid #3b82f6'
                        : '1px solid #ffffff1a',
                    background: usdValue === a ? '#3b82f630' : '#ffffff0a',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  ${a}
                </button>
              ))}
            </div>

            {/* Message */}
            <label
              style={{
                display: 'block',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: '#cbd5e1',
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              Message (optional)
            </label>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={100}
              placeholder="Attach an on-chain message to this payment"
              style={{
                width: '100%',
                background: '#00000050',
                border: '1px solid #ffffff1a',
                borderRadius: 12,
                padding: '12px 14px',
                color: 'white',
                fontSize: 14,
                marginBottom: 18,
                boxSizing: 'border-box',
              }}
            />

            {/* Email */}
            <label
              style={{
                display: 'block',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: '#cbd5e1',
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              Email <span style={{ color: '#fca5a5' }}>(required)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: '100%',
                background: '#00000050',
                border: `1px solid ${
                  email && !emailValid ? '#ef4444aa' : '#ffffff1a'
                }`,
                borderRadius: 12,
                padding: '12px 14px',
                color: 'white',
                fontSize: 14,
                marginBottom: 18,
                boxSizing: 'border-box',
              }}
            />

            {/* Terms */}
            <label
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                fontSize: 13,
                color: '#cbd5e1',
                marginBottom: 20,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                I understand mission tokens are not an investment and agree to
                the contribution terms.
              </span>
            </label>

            {/* Gate exactly like the real modal: amount + terms + email */}
            {!account?.address ? (
              <div
                style={{
                  background: '#f59e0b15',
                  border: '1px solid #f59e0b40',
                  borderRadius: 12,
                  padding: 14,
                  color: '#fcd34d',
                  fontSize: 13,
                }}
              >
                Connect your wallet from the app nav, then reload this page.
              </div>
            ) : onrampReady ? (
              <div style={{ borderTop: '1px solid #ffffff14', paddingTop: 18 }}>
                <CBHeadlessOnramp
                  address={account.address}
                  selectedChain={selectedChain}
                  ethAmount={ethAmount}
                  partnerUserRef={`mission-${FAKE_MISSION.id}-${account.address}`.toLowerCase()}
                  allowAmountInput
                  emailOverride={email.trim()}
                  onExit={() => console.log('[onramp-test] exit')}
                  onPaymentSuccess={() =>
                    console.log('[onramp-test] PAYMENT SUCCESS callback fired')
                  }
                  fullWidth
                />
              </div>
            ) : (
              <div
                style={{
                  background: '#f59e0b15',
                  border: '1px solid #f59e0b40',
                  borderRadius: 12,
                  padding: 14,
                  color: '#fcd34d',
                  fontSize: 13,
                }}
              >
                {usdValue <= 0
                  ? 'Enter an amount to continue.'
                  : !emailValid
                  ? 'Enter a valid email to continue.'
                  : 'Agree to the terms above to continue with your purchase.'}
              </div>
            )}

            <p
              style={{
                fontSize: 11,
                color: '#64748b',
                marginTop: 16,
                textAlign: 'center',
              }}
            >
              Chain: {selectedChain?.name ?? 'unknown'} ·{' '}
              {account?.address
                ? `${account.address.slice(0, 6)}…${account.address.slice(-4)}`
                : 'not connected'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
