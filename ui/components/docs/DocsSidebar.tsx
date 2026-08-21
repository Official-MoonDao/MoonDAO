import { useEffect, useState } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { DocsLink } from './DocsLink'
import type { DocsNavNode } from '../../lib/docs/types'

function isCurrentOrChild(node: DocsNavNode, currentSlug?: string): boolean {
  if (!currentSlug) return false
  if (node.slug === currentSlug) return true
  return node.children.some((child) => isCurrentOrChild(child, currentSlug))
}

function FolderNode({
  node,
  currentSlug,
}: {
  node: DocsNavNode
  currentSlug?: string
}) {
  const childIsCurrent = isCurrentOrChild(node, currentSlug)
  const [open, setOpen] = useState(childIsCurrent)

  useEffect(() => {
    if (childIsCurrent) setOpen(true)
  }, [childIsCurrent])

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5 ${
          childIsCurrent ? 'font-semibold text-primary' : 'text-base-content'
        }`}
      >
        <span>{node.label}</span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <ul className="ml-3 mt-1 space-y-1 border-l border-base-200 pl-2">
          {node.children.map((child) => (
            <NavNode
              key={child.slug}
              node={child}
              currentSlug={currentSlug}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function NavNode({
  node,
  currentSlug,
}: {
  node: DocsNavNode
  currentSlug?: string
}) {
  if (node.children.length > 0) {
    return <FolderNode node={node} currentSlug={currentSlug} />
  }

  const current = currentSlug === node.slug
  return (
    <li>
      <DocsLink
        href={node.href}
        className={`block rounded-lg px-3 py-2 text-sm hover:bg-white/5 ${
          current
            ? 'bg-primary/10 font-semibold text-primary'
            : 'text-base-content'
        }`}
      >
        {node.label}
      </DocsLink>
    </li>
  )
}

export function DocsSidebar({
  tree,
  currentSlug,
}: {
  tree: DocsNavNode[]
  currentSlug?: string
}) {
  return (
    <nav aria-label="Documentation" className="space-y-1">
      <DocsLink
        href="/docs"
        className={`block rounded-lg px-3 py-2 text-sm hover:bg-white/5 ${
          !currentSlug || currentSlug === 'index'
            ? 'bg-primary/10 font-semibold text-primary'
            : 'text-base-content'
        }`}
      >
        Overview
      </DocsLink>
      <ul className="space-y-1">
        {tree.map((node) => (
          <NavNode key={node.slug} node={node} currentSlug={currentSlug} />
        ))}
      </ul>
    </nav>
  )
}
