import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import DocsLink from '@/components/docs/DocsLink'

const LINK_CLASS =
  'text-blue-400 underline underline-offset-4 transition-colors hover:text-blue-300'

function isRoute(href?: string): boolean {
  return !!href && href.startsWith('/') && !href.startsWith('//')
}

function isAnchor(href?: string): boolean {
  return !!href && href.startsWith('#')
}

/**
 * Long-form renderer. `rehypeRaw` is safe here because updates arrive only via
 * reviewed commits to this repo, never from user-submitted content.
 */
export default function UpdateMarkdown({ body }: { body: string }) {
  return (
    <article className="mx-auto w-full max-w-[85ch] overflow-x-hidden break-words text-[19px] leading-[1.7] text-white [&>p:first-of-type]:text-[21px] [&>p:first-of-type]:leading-[1.7] [&>p:first-of-type]:text-slate-100">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, rehypeRaw]}
        components={{
          h1: ({ node: _n, ...props }) => (
            <h1
              className="mb-6 mt-12 scroll-mt-24 font-GoodTimes text-2xl md:text-3xl"
              {...props}
            />
          ),
          h2: ({ node: _n, ...props }) => (
            <h2 className="mb-4 mt-10 scroll-mt-24 font-GoodTimes text-xl md:text-2xl" {...props} />
          ),
          h3: ({ node: _n, ...props }) => (
            <h3
              className="mb-3 mt-8 scroll-mt-24 text-lg font-semibold text-white md:text-xl"
              {...props}
            />
          ),
          h4: ({ node: _n, ...props }) => (
            <h4 className="mb-2 mt-6 scroll-mt-24 text-base font-semibold text-white" {...props} />
          ),
          p: ({ node: _n, ...props }) => <p className="mb-5 text-white/90" {...props} />,
          a: ({ node: _n, href, children, ...props }) => {
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
              <a
                href={href}
                className={LINK_CLASS}
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            )
          },
          img: ({ node: _n, ...props }) => (
            <img className="my-8 h-auto w-full rounded-xl" {...props} />
          ),
          ul: ({ node: _n, ...props }) => <ul className="mb-5 ml-2 list-disc sm:ml-6" {...props} />,
          ol: ({ node: _n, ...props }) => (
            <ol className="mb-5 ml-2 list-decimal sm:ml-6" {...props} />
          ),
          li: ({ node: _n, ...props }) => <li className="mb-2 text-white/90" {...props} />,
          blockquote: ({ node: _n, ...props }) => (
            <blockquote
              className="my-8 border-l-2 border-light-cool pl-6 text-[21px] font-normal not-italic leading-[1.6] text-slate-100"
              {...props}
            />
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
          pre: ({ node: _n, ...props }) => (
            <pre
              className="mb-5 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4 text-sm"
              {...props}
            />
          ),
          table: ({ node: _n, ...props }) => (
            <div className="-mx-2 mb-6 overflow-x-auto md:mx-0">
              <table
                className="w-full min-w-[560px] border-collapse text-left text-base"
                {...props}
              />
            </div>
          ),
          th: ({ node: _n, ...props }) => (
            <th
              className="border-b border-white/10 px-3 py-2 font-semibold text-white"
              {...props}
            />
          ),
          td: ({ node: _n, ...props }) => (
            <td className="border-b border-white/5 px-3 py-2 text-white/90" {...props} />
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </article>
  )
}
