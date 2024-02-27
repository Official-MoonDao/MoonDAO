import Link from 'next/link'
import React from 'react'

type GradientLinkProps = {
  text: string
  href: string
}

export default function GradientLink({ text, href }: GradientLinkProps) {
  if (href?.charAt(0) === '/') {
    return (
      <Link id="gradient-link" href={href}>
        <p
          className={`my-5 block text-md font-GoodTimes font-semibold bg-gradient-to-r from-n3blue  to-n3blue text-transparent bg-clip-text`}
        >
          {text} →
        </p>
      </Link>
    )
  } else {
    return (
      <button
        id="gradient-link"
        className="my-5 block text-md font-GoodTimes font-semibold bg-gradient-to-r from-n3blue  to-n3blue text-transparent bg-clip-text"
        onClick={() => window.open(href)}
      >
        {text} →
      </button>
    )
  }
}
