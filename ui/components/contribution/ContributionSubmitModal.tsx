import { getAccessToken } from '@privy-io/react-auth'
import ContributionsABI from 'const/abis/Contributions.json'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { useState } from 'react'
import {
  parseEventLogs,
  prepareContractCall,
  prepareEvent,
  sendAndConfirmTransaction,
} from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { usePrizeChainCitizen } from '@/lib/citizen/usePrizeChainCitizen'
import type { Contribution } from '@/lib/contributions/getSheetContributions'
import {
  CONTRIBUTION_AREAS,
  DESCRIPTION_MAX_BYTES,
  MAX_LINKS,
  TITLE_MAX_BYTES,
  areaLabel,
  contributionsTable,
  encodeLinks,
  utf8Bytes,
  validateContribution,
  type ContributionFieldErrors,
} from '@/lib/contributions/onchain'
import { waitForRowById } from '@/lib/tableland/waitForRow'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import Modal from '@/components/layout/Modal'

const submittedEvent = prepareEvent({
  signature:
    'event ContributionSubmitted(uint256 indexed id, uint256 indexed cycleId, address indexed author)',
})

/** Contract reverts arrive as text. Turn the ones a citizen can act on into advice. */
function submitErrorMessage(err: any): string {
  const text = `${err?.shortMessage ?? ''} ${err?.message ?? ''}`
  if (/CapReached/.test(text))
    return "You've reached this quarter's submission limit. Combine related work into one entry."
  if (/NotCitizen/.test(text)) return 'This wallet does not hold an active Citizen.'
  if (/TextTooLong/.test(text)) return 'One of the fields is too long.'
  if (/EmptyField/.test(text)) return 'Fill in the title, area and description.'
  if (/rejected|denied/i.test(text)) return 'The signature was cancelled.'
  if (err?.shortMessage) return err.shortMessage
  // Our own messages (gas sponsor) are short. Raw RPC errors are not.
  const message = typeof err?.message === 'string' ? err.message : ''
  return message && message.length < 200 ? message : 'Could not save your contribution. Try again.'
}

function ByteCounter({ used, max }: { used: number; max: number }) {
  const left = max - used
  const tone = left < 0 ? 'text-red-400' : left < max * 0.1 ? 'text-amber-300' : 'text-white/40'
  return (
    <span className={`text-xs tabular-nums ${tone}`}>
      {left < 0 ? `${-left} over` : `${left.toLocaleString()} left`}
    </span>
  )
}

// Shown in the empty box and gone as soon as they start typing. Senators see
// many "attended a town hall" entries; this steers people toward work with
// an outcome someone can check.
const DESCRIPTION_PLACEHOLDER = `Describe the completed work, your part in it, and its impact on the mission.

Good: "Published open-source research on lunar timekeeping: <link>"
Good: "Made an original post explaining why people should become Citizens: <link>"
Not enough on its own: "Attended town hall", "Voted on proposals"`

const inputClass =
  'w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-400'

type ContributionSubmitModalProps = {
  setEnabled: (enabled: boolean) => void
  /** Called with the new entry so the page can show it before the feed cache refreshes. */
  onSubmitted?: (contribution: Contribution) => void
}

export default function ContributionSubmitModal({
  setEnabled,
  onSubmitted,
}: ContributionSubmitModalProps) {
  const account = useActiveAccount()
  const chain = DEFAULT_CHAIN_V5
  const table = contributionsTable(getChainSlug(chain))
  const citizen = usePrizeChainCitizen(chain)
  const contract = useContract({
    address: table?.address ?? '',
    chain,
    abi: ContributionsABI as any,
  })

  const [title, setTitle] = useState('')
  const [area, setArea] = useState('')
  const [description, setDescription] = useState('')
  const [links, setLinks] = useState<string[]>([''])
  const [errors, setErrors] = useState<ContributionFieldErrors>({})
  const [status, setStatus] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const titleBytes = utf8Bytes(title.trim())
  const descriptionBytes = utf8Bytes(description.trim())

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    const checked = validateContribution({ title, description, area, links })
    setErrors(checked.errors)
    if (Object.keys(checked.errors).length || !account || !contract || !table) return

    setError(null)
    setSubmitting(true)
    try {
      setStatus('Covering gas…')
      const accessToken = await getAccessToken().catch(() => null)
      const sponsorRes = await fetch('/api/contributions/sponsor-gas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ wallet: account.address, chainId: chain.id }),
      })
      if (!sponsorRes.ok) {
        const body = await sponsorRes.json().catch(() => ({}))
        throw new Error(
          typeof body?.message === 'string'
            ? body.message
            : 'Could not cover gas for this submission.'
        )
      }

      setStatus('Confirm in your wallet…')
      const transaction = prepareContractCall({
        contract,
        method: 'submit' as string,
        params: [title.trim(), description.trim(), area, encodeLinks(checked.links), ''],
      })
      const receipt = await sendAndConfirmTransaction({ transaction, account })

      setStatus('Saving…')
      const [log] = parseEventLogs({ logs: receipt.logs, events: [submittedEvent] })
      const id = log ? Number(log.args.id) : null
      if (id != null) {
        await waitForRowById(table.name, 'id', id, { timeout: 30_000, cacheBusting: true })
        // Discord is a nice-to-have. The entry is already saved.
        fetch('/api/contributions/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        }).catch(() => {})
      }

      onSubmitted?.({
        timestamp: new Date().toISOString(),
        walletAddress: account.address,
        name: 'You',
        description: description.trim(),
        links: checked.links[0] ?? '',
        area: areaLabel(area),
        title: title.trim(),
        linkList: checked.links,
        ...(id != null ? { id } : {}),
      })
      setDone(true)
    } catch (err: any) {
      setError(submitErrorMessage(err))
    } finally {
      setStatus(null)
      setSubmitting(false)
    }
  }

  let gate: React.ReactNode = null
  if (!table) {
    gate = (
      <p className="text-sm text-white/60">Contributions are not available on this network yet.</p>
    )
  } else if (!account) {
    gate = <p className="text-sm text-white/60">Sign in to submit a contribution.</p>
  } else if (citizen.isLoading) {
    gate = <p className="text-sm text-white/60">Checking your Citizenship…</p>
  } else if (citizen.lookupFailed) {
    gate = (
      <div className="flex items-center gap-3 text-sm text-white/60">
        Could not confirm your Citizenship.
        <button type="button" onClick={citizen.retry} className="text-blue-400 underline">
          Try again
        </button>
      </div>
    )
  } else if (!citizen.isCitizen) {
    gate = (
      <p className="text-sm text-white/60">
        {citizen.linkedCitizenAddress
          ? `Your Citizen is held by ${citizen.linkedCitizenAddress.slice(
              0,
              6
            )}…${citizen.linkedCitizenAddress.slice(-4)}. Switch to that wallet to submit.`
          : citizen.expired
          ? 'Your Citizenship has expired. Renew it to submit.'
          : 'Only Citizens can submit contributions.'}
      </p>
    )
  }

  return (
    <Modal
      id="contribution-submit"
      setEnabled={setEnabled}
      title="Submit a contribution"
      size="2xl"
    >
      <div className="p-6">
        {done ? (
          <div className="flex flex-col gap-4">
            <p className="text-white font-semibold">Saved.</p>
            <p className="text-sm text-white/60">
              Your contribution is recorded onchain under your Citizen wallet. Senators review all
              submissions at the end of the quarter. You can submit more work any time before then.
            </p>
            <button
              type="button"
              onClick={() => setEnabled(false)}
              className="self-start rounded-xl bg-blue-500 hover:bg-blue-400 px-5 py-2 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        ) : gate ? (
          gate
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
            <p className="text-xs text-white/50">
              Your name and wallet come from your Citizen profile. Everything below is public and
              stored onchain.
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between text-sm font-semibold text-white">
                Title
                <ByteCounter used={titleBytes} max={TITLE_MAX_BYTES} />
              </span>
              <input
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Ran the October onboarding call"
              />
              {errors.title && <span className="text-xs text-red-400">{errors.title}</span>}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-white">Area</span>
              <select className={inputClass} value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="" disabled>
                  Pick the main area
                </option>
                {CONTRIBUTION_AREAS.map((a) => (
                  <option key={a.code} value={a.code} className="bg-[#1d1f2b]">
                    {a.label} ({a.hint})
                  </option>
                ))}
              </select>
              {errors.area && <span className="text-xs text-red-400">{errors.area}</span>}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between text-sm font-semibold text-white">
                What did you do?
                <ByteCounter used={descriptionBytes} max={DESCRIPTION_MAX_BYTES} />
              </span>
              <textarea
                className={`${inputClass} min-h-[180px]`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={DESCRIPTION_PLACEHOLDER}
              />
              {errors.description && (
                <span className="text-xs text-red-400">{errors.description}</span>
              )}
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-white">
                Proof of work{' '}
                <span className="font-normal text-white/40">
                  (links to publicly viewable content, recommended)
                </span>
              </span>
              {links.map((link, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={inputClass}
                    value={link}
                    inputMode="url"
                    onChange={(e) =>
                      setLinks((prev) => prev.map((l, j) => (j === i ? e.target.value : l)))
                    }
                    placeholder="https://"
                  />
                  {links.length > 1 && (
                    <button
                      type="button"
                      aria-label="Remove link"
                      onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                      className="px-2 text-white/40 hover:text-white"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {links.length < MAX_LINKS && (
                <button
                  type="button"
                  onClick={() => setLinks((prev) => [...prev, ''])}
                  className="self-start text-xs text-blue-400 hover:text-blue-300"
                >
                  + Add another link
                </button>
              )}
              <span className="text-xs text-white/40">
                Posts, docs, repos, recordings or photos that anyone can open without signing in.
                For several pieces of work, a Google Doc or Drive folder that collects them works
                well; set sharing to &quot;Anyone with the link&quot;.
              </span>
              {errors.links && <span className="text-xs text-red-400">{errors.links}</span>}
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="self-start rounded-xl bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/50 disabled:cursor-not-allowed px-6 py-3 text-sm font-semibold text-white"
            >
              {status ?? 'Submit contribution'}
            </button>
          </form>
        )}
      </div>
    </Modal>
  )
}
