import Head from 'next/head'
import { useState } from 'react'
import { PERSON, answerQuestion } from '@/lib/support/answer'

type SearchEntry = { href?: string; body?: string }

export default function SupportPage() {
  const [question, setQuestion] = useState('')
  const [text, setText] = useState('')

  async function ask() {
    try {
      const response = await fetch('/doc-search-index.json')
      if (!response.ok) {
        setText(PERSON)
        return
      }
      const entries = (await response.json()) as SearchEntry[]
      const docs = entries.map((entry) => ({
        path: String(entry.href || ''),
        body: String(entry.body || ''),
      }))
      setText(answerQuestion(question, docs).text)
    } catch {
      setText(PERSON)
    }
  }

  return (
    <>
      <Head>
        <title>Support</title>
      </Head>
      <main className="mx-auto max-w-xl px-6 py-16 text-white">
        <h1 className="mb-6 text-3xl font-bold">Ask a question</h1>
        <textarea
          className="mb-4 w-full rounded border border-white/20 bg-black p-3"
          rows={5}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button
          type="button"
          className="rounded bg-white px-4 py-2 text-black"
          onClick={() => {
            void ask()
          }}
        >
          Ask
        </button>
        {text ? <p className="mt-6 whitespace-pre-wrap">{text}</p> : null}
      </main>
    </>
  )
}
