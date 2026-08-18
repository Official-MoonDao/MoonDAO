import { ClipboardDocumentIcon } from '@heroicons/react/24/outline'
import React from 'react'
import toast from 'react-hot-toast'
import type { Fact } from '@/lib/press/press-data'

async function copyBoilerplate(boilerplate: string) {
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error('Clipboard API unavailable')
    }
    await navigator.clipboard.writeText(boilerplate)
    toast.success('Boilerplate copied to clipboard.')
  } catch (err) {
    toast.error('Could not copy. Please select the text and copy it manually.')
  }
}

export default function PressAbout({
  boilerplate,
  facts,
}: {
  boilerplate: string
  facts: Fact[]
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-slate-600/30 bg-gradient-to-b from-slate-700/20 to-slate-800/30 p-5 lg:col-span-2">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-GoodTimes text-lg text-white">About MoonDAO</h3>
          <button
            type="button"
            onClick={() => copyBoilerplate(boilerplate)}
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-slate-500/40 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-400/60 hover:text-white"
          >
            <ClipboardDocumentIcon className="h-4 w-4" />
            Copy
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">{boilerplate}</p>
      </div>
      <dl className="flex flex-col gap-3 rounded-2xl border border-slate-600/30 bg-gradient-to-b from-slate-700/20 to-slate-800/30 p-5">
        <h3 className="font-GoodTimes text-lg text-white">Fact sheet</h3>
        {facts.map((fact) => (
          <div key={fact.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-slate-400">{fact.label}</dt>
            <dd className="text-right text-sm font-medium text-white">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
