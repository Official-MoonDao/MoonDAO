import { ChevronDownIcon } from '@heroicons/react/24/outline'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import { parseUpdateBlock } from '@/lib/updates/blocks'
import DocsLink from '@/components/docs/DocsLink'
import UpdateBlock from './blocks/UpdateBlock'

const BUTTON_CLASS =
  'inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 text-[16px] font-semibold text-white no-underline shadow-lg transition-opacity hover:opacity-90'

const LINK_CLASS =
  'text-blue-300 underline decoration-blue-300/40 underline-offset-4 transition-colors hover:text-blue-200 hover:decoration-blue-200'

function isRoute(href?: string): boolean {
  return !!href && href.startsWith('/') && !href.startsWith('//')
}

function isAnchor(href?: string): boolean {
  return !!href && href.startsWith('#')
}

function textOf(node: any): string {
  if (!node) return ''
  if (node.type === 'text') return node.value
  return (node.children || []).map(textOf).join('')
}

/** A fenced ```chart (or stats, heatmap, ledger) block, if `pre` holds one. */
function blockFromPre(node: any) {
  const code = node?.children?.find((c: any) => c.type === 'element' && c.tagName === 'code')
  const classes: string[] = code?.properties?.className || []
  const lang = classes.find((c) => c.startsWith('language-'))?.slice('language-'.length)
  if (!lang) return null
  return parseUpdateBlock(lang, textOf(code).trim())
}

const COMPONENTS: Components = {
  h1: ({ node: _n, ...props }) => (
    <h1
      className="mb-6 mt-14 scroll-mt-24 font-heading font-semibold text-2xl md:text-3xl"
      {...props}
    />
  ),
  h2: ({ node: _n, ...props }) => (
    <h2
      className="mb-5 mt-16 scroll-mt-24 border-t border-white/10 pt-10 font-heading text-[26px] font-semibold leading-tight tracking-tight text-white md:text-[30px]"
      {...props}
    />
  ),
  h3: ({ node: _n, ...props }) => (
    <h3
      className="mb-3 mt-10 scroll-mt-24 font-heading text-[20px] font-semibold leading-snug text-white md:text-[22px]"
      {...props}
    />
  ),
  h4: ({ node: _n, ...props }) => (
    <h4 className="mb-2 mt-6 scroll-mt-24 text-base font-semibold text-white" {...props} />
  ),
  h5: ({ node: _n, ...props }) => (
    <h5
      className="mb-2 mt-5 scroll-mt-24 text-sm font-semibold uppercase tracking-wide text-slate-300"
      {...props}
    />
  ),
  p: ({ node: _n, ...props }) => <p className="mb-6 text-slate-200" {...props} />,
  strong: ({ node: _n, ...props }) => <strong className="font-semibold text-white" {...props} />,
  a: ({ node, href, children, ...props }) => {
    // Newsletter issues mark their call-to-action links as buttons.
    if (node?.properties?.dataButton) {
      const external = !isRoute(href)
      return (
        <span className="my-2 flex justify-center">
          <a
            href={href}
            className={BUTTON_CLASS}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {children}
          </a>
        </span>
      )
    }
    if (isAnchor(href)) {
      return (
        <a href={href} className={LINK_CLASS} {...props}>
          {children}
        </a>
      )
    }
    if (isRoute(href)) {
      return (
        <DocsLink href={href || '/updates'} className={LINK_CLASS}>
          {children}
        </DocsLink>
      )
    }
    return (
      <a href={href} className={LINK_CLASS} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    )
  },
  img: ({ node: _n, ...props }) => <img className="my-8 h-auto w-full rounded-xl" {...props} />,
  figure: ({ node: _n, ...props }) => (
    <figure className="my-8 [&_img]:my-0 [&_iframe]:my-0 [&_p]:mb-0" {...props} />
  ),
  figcaption: ({ node: _n, ...props }) => (
    <figcaption
      className="mt-3 text-center text-[15px] leading-relaxed text-slate-400"
      {...props}
    />
  ),
  video: ({ node: _n, ...props }) => (
    <video className="my-8 h-auto w-full rounded-xl bg-black" {...props} />
  ),
  iframe: ({ node: _n, title, src }) => (
    <iframe
      src={src}
      title={title || 'Video'}
      className="my-8 aspect-video w-full rounded-xl"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      loading="lazy"
    />
  ),
  hr: () => <hr className="my-12 border-white/10" />,
  ul: ({ node: _n, ...props }) => (
    <ul
      className="mb-6 ml-1 space-y-2.5 sm:ml-2 [&>li]:relative [&>li]:pl-6 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[0.72em] [&>li]:before:h-1.5 [&>li]:before:w-1.5 [&>li]:before:rounded-full [&>li]:before:bg-blue-400/80 [&>li]:before:content-['']"
      {...props}
    />
  ),
  ol: ({ node: _n, ...props }) => (
    <ol
      className="mb-6 ml-6 list-decimal space-y-3 marker:font-heading marker:font-semibold marker:text-blue-300"
      {...props}
    />
  ),
  li: ({ node: _n, ...props }) => <li className="pl-1 text-slate-200" {...props} />,
  blockquote: ({ node: _n, ...props }) => (
    <blockquote
      className="my-12 border-l-[3px] border-blue-400 pl-6 font-heading text-[22px] font-medium leading-[1.45] text-white md:pl-8 md:text-[26px] [&_p]:mb-0 [&_p]:text-white"
      {...props}
    />
  ),
  aside: ({ node, children }) => {
    const title = (node?.properties?.dataTitle as string) || undefined
    return (
      <aside className="relative my-10 overflow-hidden rounded-2xl border border-blue-400/20 bg-gradient-to-br from-blue-500/[0.08] via-indigo-500/[0.05] to-purple-500/[0.08] px-6 py-6 md:px-8 md:py-7 [&_li]:text-[17px] [&_li]:text-slate-100 [&_p:last-child]:mb-0 [&_ul]:mb-0">
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-blue-400 to-purple-400"
        />
        {title && (
          <p className="mb-4 font-RobotoMono text-[11px] uppercase tracking-[0.22em] text-blue-300">
            {title}
          </p>
        )}
        {children}
      </aside>
    )
  },
  details: ({ node: _n, children, ...props }) => (
    <details
      className="group my-4 rounded-2xl border border-white/10 bg-white/[0.02] open:bg-white/[0.03] [&>*:not(summary)]:px-5 md:[&>*:not(summary)]:px-7 [&>*:last-child]:pb-6"
      {...props}
    >
      {children}
    </details>
  ),
  summary: ({ node: _n, children, ...props }) => (
    <summary
      className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 text-[16px] font-semibold text-white transition-colors hover:bg-white/[0.03] md:px-7 [&::-webkit-details-marker]:hidden"
      {...props}
    >
      <span>{children}</span>
      <ChevronDownIcon className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
    </summary>
  ),
  code: ({ node: _n, className, children, ...props }) => {
    const inline = !className
    if (inline) {
      return (
        <code className="rounded bg-white/10 px-1 py-0.5 text-[0.9em]" {...props}>
          {children}
        </code>
      )
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  },
  pre: ({ node, ...props }) => {
    const block = blockFromPre(node)
    if (block) return <UpdateBlock block={block} />
    return (
      <pre
        className="mb-5 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4 text-sm"
        {...props}
      />
    )
  },
  table: ({ node: _n, ...props }) => (
    <div className="my-8 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
      <table
        className="w-full min-w-[520px] border-collapse text-left text-[15px] tabular-nums"
        {...props}
      />
    </div>
  ),
  thead: ({ node: _n, ...props }) => <thead className="bg-white/[0.04]" {...props} />,
  tr: ({ node: _n, ...props }) => (
    <tr className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02]" {...props} />
  ),
  th: ({ node: _n, ...props }) => (
    <th
      className="whitespace-nowrap px-4 py-3 font-RobotoMono text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400"
      {...props}
    />
  ),
  td: ({ node: _n, ...props }) => <td className="px-4 py-3 text-slate-200" {...props} />,
}

/**
 * Long-form renderer. `rehypeRaw` is safe here because updates arrive only via
 * reviewed commits to this repo, never from user-submitted content. Newsletter
 * issues are MoonDAO's own Kit broadcasts, and `kitHtmlToMarkdown` escapes all
 * of their text and writes the only raw HTML they contain.
 */
export default function UpdateMarkdown({ body }: { body: string }) {
  return (
    <article className="w-full overflow-x-hidden font-[Lato,ui-sans-serif,system-ui,-apple-system,'Segoe_UI',Roboto,sans-serif] break-words text-[18px] leading-[1.75] text-white md:text-[19px] [&>p:first-of-type]:text-[20px] [&>p:first-of-type]:leading-[1.65] [&>p:first-of-type]:text-slate-100 md:[&>p:first-of-type]:text-[22px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, rehypeRaw]}
        components={COMPONENTS}
      >
        {body}
      </ReactMarkdown>
    </article>
  )
}
