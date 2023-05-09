import Link from 'next/link'
import React from 'react'

export default function GradientLink({ text, href, textSize }: any) {
  if (href?.charAt(0) === '/') {
    return (
      <Link href={href}>
        <a
          className={`my-5 block text-md font-GoodTimes font-semibold bg-gradient-to-r from-n3blue  to-n3blue text-transparent bg-clip-text`}
        >
          {text} →
        </a>
      </Link>
    )
  } else {
    return (
      <button
        className="my-5 block text-md font-GoodTimes font-semibold bg-gradient-to-r from-n3blue  to-n3blue text-transparent bg-clip-text"
        onClick={() => window.open(href)}
      >
        {text} →
      </button>
    )
  }
}
