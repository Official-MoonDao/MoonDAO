import { MinusIcon, PlusIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'

export default function FAQs({
  faqs,
}: {
  faqs: {
    question: string
    answer: string
  }[]
}) {
  const [faqExpanded, setFaqExpanded] = useState<boolean[]>(
    Array.from({ length: faqs.length }, () => false)
  )

  function toggleFAQ(index: number) {
    setFaqExpanded((prev) => {
      const newState = prev.map((value, i) => (i === index ? !value : false))
      return newState
    })
  }

  return (
    <div>
      {faqs.map(({ question, answer }, i) => (
        <div className="flex flex-col" key={`faq-${i}`}>
          <div className="flex gap-4 mt-[5vw] md:mt-[2vw] items-center">
            <button
              type="button"
              className="flex items-center justify-center gap-2 gradient-2 rounded-full h-9 w-9 aspect-square"
              onClick={() => toggleFAQ(i)}
            >
              {faqExpanded[i] ? (
                <MinusIcon className="w-5 h-5" color="white" />
              ) : (
                <PlusIcon className="w-5 h-5" color="white" />
              )}
            </button>
            <h3
              className="md:text-[max(1.5vw,20px)] 2xl:text-[22px] cursor-pointer"
              onClick={() => toggleFAQ(i)}
            >
              {question}
            </h3>
          </div>
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              faqExpanded[i] ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <p className="md:text-[max(1.2vw,16px)] 2xl:text-[18px] h-full pt-2 pb-5">
              {answer}
            </p>
          </div>
          <hr className="mt-4 w-full border-t border-gray-300" />
        </div>
      ))}
    </div>
  )
}
