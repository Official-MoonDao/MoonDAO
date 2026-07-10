import { MAX_BUDGET_USD } from 'const/config'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Container from '@/components/layout/Container'
import WebsiteHead from '@/components/layout/Head'
import StandardButton from '@/components/layout/StandardButton'
import { getProposalTemplate } from '@/lib/nance'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'

export default function ProposalTemplatePage() {
  const template = useMemo(() => getProposalTemplate(MAX_BUDGET_USD), [])
  const [copied, setCopied] = useState(false)

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(template)
      setCopied(true)
      toast.success('Template copied to clipboard.', { style: toastStyle })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy. Select the text below instead.', { style: toastStyle })
    }
  }

  function downloadTemplate() {
    const blob = new Blob([template], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'moondao-project-proposal-template.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <WebsiteHead
        title="Project Proposal Template"
        description="Canonical MoonDAO project proposal template: novelty & prior art, lunar bridge, budget classes, IP disclosure, and pre-submit checklist."
      />
      <section className="w-full px-4 py-10 md:px-8 md:py-16">
        <Container>
          <div className="mx-auto max-w-4xl">
            <p className="mb-3 font-GoodTimes text-sm tracking-[0.2em] text-blue-300/80">
              PROJECT SYSTEM
            </p>
            <h1 className="mb-4 font-GoodTimes text-3xl text-white md:text-5xl">
              Proposal Template
            </h1>
            <p className="mb-8 max-w-2xl text-lg text-gray-300">
              Copy this markdown into a Google Doc or editor, fill every required section, then
              import it on the propose page. Current max ask:{' '}
              <span className="font-semibold text-white">
                ${MAX_BUDGET_USD.toLocaleString()}
              </span>
              .
            </p>

            <div className="mb-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={copyTemplate}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-3 font-medium text-white shadow-lg transition hover:opacity-90"
              >
                {copied ? 'Copied' : 'Copy markdown'}
              </button>
              <button
                type="button"
                onClick={downloadTemplate}
                className="rounded-xl border border-white/20 bg-white/5 px-5 py-3 font-medium text-white transition hover:bg-white/10"
              >
                Download .md
              </button>
              <StandardButton
                backgroundColor="bg-white/10"
                textColor="text-white"
                borderRadius="rounded-xl"
                hoverEffect={false}
                link="/propose"
                className="border border-white/20"
              >
                Go to Propose
              </StandardButton>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-5 md:p-8">
              <article className="prose prose-invert max-w-none prose-headings:font-GoodTimes prose-a:text-blue-300">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{template}</ReactMarkdown>
              </article>
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}
