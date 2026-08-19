import { h } from 'hastscript'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'

const LINK_CLASS =
  'text-blue-400 hover:text-blue-300 underline transition-colors break-words'

function isRoute(href?: string): boolean {
  return !!href && href.startsWith('/') && !href.startsWith('//')
}

/** Same-page anchor, including the `#` autolinks rehype adds to headings. */
function isAnchor(href?: string): boolean {
  return !!href && href.startsWith('#')
}

export default function DocMarkdown({ body }: { body: string }) {
  return (
    <article className="w-full break-words text-white text-base overflow-x-hidden docs-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSlug,
          [
            rehypeAutolinkHeadings,
            {
              content() {
                return [h('span.ml-2.hidden.group-hover:inline', '#')]
              },
              behavior: 'append',
            },
          ],
          rehypeRaw,
        ]}
        components={{
          h1: ({ node: _n, ...props }) => (
            <h1 className="group font-GoodTimes text-xl md:text-2xl mt-8 mb-4" {...props} />
          ),
          h2: ({ node: _n, ...props }) => (
            <h2 className="group font-GoodTimes text-lg md:text-xl mt-6 mb-3" {...props} />
          ),
          h3: ({ node: _n, ...props }) => (
            <h3 className="group font-GoodTimes text-base md:text-lg mt-5 mb-2" {...props} />
          ),
          h4: ({ node: _n, ...props }) => (
            <h4 className="group font-GoodTimes text-sm md:text-base mt-4 mb-2" {...props} />
          ),
          table: ({ node: _n, ...props }) => (
            <div className="mb-6 overflow-x-auto -mx-2 md:mx-0">
              <div className="min-w-full inline-block md:rounded-xl overflow-hidden md:border md:border-white/10 md:bg-gradient-to-br md:from-slate-700/20 md:to-slate-800/30">
                <table className="text-left w-full min-w-[600px] border-collapse" {...props} />
              </div>
            </div>
          ),
          th: ({ node: _n, ...props }) => (
            <th
              className="whitespace-normal border-b border-white/10 text-white font-semibold py-2 px-2 md:py-4 md:px-6 md:bg-slate-800/30 text-xs md:text-base"
              {...props}
            />
          ),
          td: ({ node: _n, ...props }) => (
            <td
              className="whitespace-normal border-b border-white/5 text-white/90 py-2 px-2 md:py-4 md:px-6 text-xs md:text-base"
              {...props}
            />
          ),
          p: ({ node: _n, ...props }) => (
            <p className="text-white/90 text-base leading-relaxed mb-4" {...props} />
          ),
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
                <Link href={href || '/docs'} className={LINK_CLASS}>
                  {children}
                </Link>
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
            <img className="max-w-full h-auto rounded-lg my-4" {...props} />
          ),
          ul: ({ node: _n, ...props }) => (
            <ul className="list-disc ml-2 sm:ml-6 mb-4 text-white text-base" {...props} />
          ),
          ol: ({ node: _n, ...props }) => (
            <ol className="list-decimal ml-2 sm:ml-6 mb-4 text-white text-base" {...props} />
          ),
          li: ({ node: _n, ...props }) => (
            <li className="text-white/90 text-base mb-2 leading-relaxed" {...props} />
          ),
          blockquote: ({ node: _n, ...props }) => (
            <blockquote
              className="border-l-2 border-light-cool/40 pl-4 my-4 text-white/80 italic"
              {...props}
            />
          ),
          code: ({ node: _n, className, children, ...props }) => {
            const inline = !className
            if (inline) {
              return (
                <code className="bg-white/10 rounded px-1 py-0.5 text-sm" {...props}>
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
              className="bg-black/40 border border-white/10 rounded-xl p-4 overflow-x-auto mb-4 text-sm"
              {...props}
            />
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </article>
  )
}
