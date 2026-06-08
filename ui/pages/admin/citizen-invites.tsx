import { usePrivy } from '@privy-io/react-auth'
import { useState } from 'react'
import toast from 'react-hot-toast'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { useIsExecutive } from '@/lib/operator/useIsExecutive'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import Container from '../../components/layout/Container'
import ContentLayout from '../../components/layout/ContentLayout'
import WebsiteHead from '../../components/layout/Head'
import { NoticeFooter } from '../../components/layout/NoticeFooter'

type GeneratedLink = { token: string; url: string }
type Status = 'idle' | 'generating' | 'success' | 'error'

export default function CitizenInvitesAdmin() {
  useChainDefault()
  const { authenticated, login } = usePrivy()
  const { isExecutive, status: authStatus } = useIsExecutive()

  const [count, setCount] = useState(1)
  const [label, setLabel] = useState('')
  const [ttlDays, setTtlDays] = useState(30)
  const [status, setStatus] = useState<Status>('idle')
  const [links, setLinks] = useState<GeneratedLink[]>([])

  const isGenerating = status === 'generating'

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`Copied ${what}.`, { style: toastStyle })
    } catch {
      toast.error('Could not copy to clipboard.', { style: toastStyle })
    }
  }

  const generate = async () => {
    setStatus('generating')
    setLinks([])
    try {
      const res = await fetch('/api/operator/create-citizen-invite', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count,
          ttlDays,
          label: label.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok && res.status !== 207) {
        throw new Error(json?.error || `Request failed (${res.status})`)
      }
      setLinks(json.links || [])
      if (res.status === 207) {
        toast(`Partial success: ${json.links?.length || 0} of ${count} links created.`, {
          style: toastStyle,
          icon: '⚠️',
        })
      }
      setStatus('success')
      toast.success(`Created ${json.links?.length || 0} invite link(s).`, {
        style: toastStyle,
      })
    } catch (err: any) {
      console.error('Generate citizen invites failed:', err)
      setStatus('error')
      toast.error(err?.message || 'Failed to generate links.', {
        style: toastStyle,
      })
    }
  }

  const renderBody = () => {
    // Not signed in yet.
    if (!authenticated) {
      return (
        <div className="bg-black/20 rounded-xl p-6 border border-white/10 text-center">
          <p className="text-gray-300 mb-4">
            Sign in with an operator wallet (e.g. ryand2d.eth or pmoncada.eth)
            to generate citizen invite links.
          </p>
          <button
            type="button"
            onClick={() => login()}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg transition"
          >
            Sign In
          </button>
        </div>
      )
    }

    // Signed in, but still confirming operator status.
    if (authStatus === 'loading' || authStatus === 'idle') {
      return (
        <div className="bg-black/20 rounded-xl p-6 border border-white/10 text-center text-gray-300">
          Checking operator access…
        </div>
      )
    }

    // Signed in but not an allow-listed operator.
    if (!isExecutive) {
      return (
        <div className="bg-black/20 rounded-xl p-6 border border-rose-400/30 text-center">
          <p className="text-rose-300">
            This wallet isn&apos;t an authorized operator. Ask an admin to add
            your address to the operator allowlist.
          </p>
        </div>
      )
    }

    // Authorized: show the generator.
    return (
      <div className="flex flex-col gap-6">
        <div className="bg-black/20 rounded-xl p-6 border border-white/10 flex flex-col gap-4">
          <p className="text-gray-300 text-sm">
            Each link lets one person sign up and mint a free 1-year citizenship,
            fully sponsored. A link can be redeemed exactly once.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-gray-400">
                How many links
              </span>
              <input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) =>
                  setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))
                }
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400/40"
                disabled={isGenerating}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-gray-400">
                Valid for (days)
              </span>
              <input
                type="number"
                min={1}
                max={365}
                value={ttlDays}
                onChange={(e) =>
                  setTtlDays(
                    Math.max(1, Math.min(365, Number(e.target.value) || 30))
                  )
                }
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400/40"
                disabled={isGenerating}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-gray-400">
                Label (optional)
              </span>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. ETHDenver booth"
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-400/40"
                disabled={isGenerating}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={isGenerating}
            className="self-start px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-RobotoMono shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Generating…' : 'Generate Links'}
          </button>
        </div>

        {links.length > 0 && (
          <div className="bg-black/20 rounded-xl p-6 border border-green-400/30 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-green-300 font-GoodTimes text-sm">
                {links.length} link{links.length > 1 ? 's' : ''} created
              </h3>
              <button
                type="button"
                onClick={() =>
                  copy(links.map((l) => l.url).join('\n'), 'all links')
                }
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs"
              >
                Copy all
              </button>
            </div>
            <ul className="flex flex-col gap-2">
              {links.map((l) => (
                <li
                  key={l.token}
                  className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3 py-2"
                >
                  <span className="text-gray-200 text-xs break-all flex-1 font-mono">
                    {l.url}
                  </span>
                  <button
                    type="button"
                    onClick={() => copy(l.url, 'link')}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-blue-500/80 hover:bg-blue-500 text-white text-xs"
                  >
                    Copy
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-gray-500">
              Share each link with one person. Once redeemed, a link can&apos;t be
              used again.
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <WebsiteHead
        title="Citizen Invite Links"
        description="Generate one-time sponsored citizenship invite links."
      />
      <section className="flex flex-col justify-start px-5 mt-5 items-start animate-fadeIn w-[90vw] md:w-full">
        <Container>
          <ContentLayout
            header="Citizen Invite Links"
            headerSize="40px"
            description="Generate one-time links that let someone sign up and mint a free, fully sponsored 1-year citizenship."
            mainPadding
            mode="compact"
            isProfile={true}
          >
            <div className="max-w-[900px] w-full">{renderBody()}</div>
          </ContentLayout>
          <NoticeFooter />
        </Container>
      </section>
    </>
  )
}
