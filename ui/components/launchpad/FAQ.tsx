import { MinusIcon, PlusIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'

export default function FAQ({
  question,
  answer,
}: {
  question: string
  answer: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div id="faq-container" className="flex flex-col gap-4">
      <div className="flex gap-4 items-center">
        <button
          id="faq-toggle"
          className="flex items-center justify-center gap-2 gradient-2 rounded-full h-12 w-12"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <MinusIcon id="faq-minus" className="w-12 h-12" color="white" />
          ) : (
            <PlusIcon id="faq-plus" className="w-12 h-12" color="white" />
          )}
        </button>
        <h3 id="faq-question" className="text-2xl font-GoodTimes">
          {question}
        </h3>
      </div>
      <p id="faq-answer" className="text-lg h-full">
        {!expanded && answer.length >= 100
          ? answer.slice(0, 100) + '...'
          : answer}
      </p>
      <hr className="mt-4 w-full border-t border-gray-300" />
    </div>
  )
}
