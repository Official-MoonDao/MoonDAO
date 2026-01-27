import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react'
import { getActionYamlFromBody, trimActionsFromBody } from '@nance/nance-sdk'
import { h } from 'hastscript'
import ReactMarkdown from 'react-markdown'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'

export default function MarkdownWithTOC({ body }: { body: string }) {
  return (
    <div className="w-full">
      <article className="prose prose-invert prose-lg max-w-none w-full break-words overflow-x-hidden">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[
            rehypeSlug,
            [
              rehypeAutolinkHeadings,
              {
                content(node: any) {
                  return [h('span.ml-2.hidden.group-hover:inline', '#')]
                },
                behavior: 'append',
              },
            ],
            rehypeRaw,
          ]}
          components={{
            h1: ({ node, ...props }) => (
              <h1 className="group font-GoodTimes text-3xl md:text-4xl mt-8 mb-4 text-white font-bold pb-3 border-b border-white/10" {...props} />
            ),
            h2: ({ node, ...props }) => (
              <h2 className="group font-GoodTimes text-2xl md:text-3xl mt-8 mb-4 text-white font-bold" {...props} />
            ),
            h3: ({ node, ...props }) => (
              <h3 className="group font-GoodTimes text-xl md:text-2xl mt-6 mb-3 text-white font-semibold" {...props} />
            ),
            h4: ({ node, ...props }) => (
              <h4 className="group font-GoodTimes text-lg md:text-xl mt-5 mb-2 text-white font-semibold" {...props} />
            ),
            h5: ({ node, ...props }) => (
              <h5 className="group font-GoodTimes text-base md:text-lg mt-4 mb-2 text-white font-medium" {...props} />
            ),
            h6: ({ node, ...props }) => (
              <h6 className="group font-GoodTimes text-sm md:text-base mt-3 mb-2 text-white font-medium" {...props} />
            ),
            table: ({ node, ...props }) => (
              <div className="my-8 overflow-x-auto -mx-2 md:mx-0">
                <div className="min-w-full inline-block rounded-xl overflow-hidden border border-white/10 bg-gradient-to-br from-slate-700/20 to-slate-800/30 shadow-xl">
                  <table className="text-left w-full min-w-[600px] border-collapse" {...props} />
                </div>
              </div>
            ),
            th: ({ node, ...props }) => (
              <th
                className="whitespace-normal border-b border-white/10 text-white font-bold py-3 px-4 md:py-4 md:px-6 bg-slate-800/50 text-sm md:text-base"
                {...props}
              />
            ),
            td: ({ node, ...props }) => (
              <td
                className="whitespace-normal border-b border-white/5 text-white/90 py-3 px-4 md:py-4 md:px-6 text-sm md:text-base"
                {...props}
              />
            ),
            p: ({ node, ...props }) => <p className="text-white/90 leading-relaxed mb-4 text-base md:text-lg" {...props} />,
            strong: ({ node, children, ...props }) => (
              <strong className="text-white font-bold" {...props}>
                {children}
              </strong>
            ),
            em: ({ node, ...props }) => <em className="text-white/90 italic" {...props} />,
            br: ({ node, ...props }) => <br className="my-2" {...props} />,
            a: ({ node, ...props }) => (
              <a
                className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/30 hover:decoration-blue-300/50 transition-all duration-200"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              />
            ),
            ul: ({ node, ...props }) => (
              <ul
                className="list-disc ml-6 mb-6 space-y-2 text-white/90"
                style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}
                {...props}
              />
            ),
            ol: ({ node, ...props }) => (
              <ol
                className="list-decimal ml-6 mb-6 space-y-2 text-white/90"
                style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}
                {...props}
              />
            ),
            li: ({ node, ...props }) => (
              <li
                className="text-white/90 leading-relaxed text-base md:text-lg"
                style={{ display: 'list-item' }}
                {...props}
              />
            ),
            blockquote: ({ node, ...props }) => (
              <blockquote
                className="border-l-4 border-blue-500/50 pl-4 py-2 my-6 italic text-white/80 bg-slate-800/20 rounded-r-lg"
                {...props}
              />
            ),
            code: ({ node, inline, ...props }: any) =>
              inline ? (
                <code
                  className="bg-slate-800/50 text-blue-300 px-2 py-1 rounded text-sm font-mono"
                  {...props}
                />
              ) : (
                <code
                  className="block bg-slate-900/50 text-green-300 p-4 rounded-lg overflow-x-auto text-sm font-mono my-4"
                  {...props}
                />
              ),
            pre: ({ node, ...props }) => (
              <pre className="bg-slate-900/50 rounded-lg overflow-x-auto my-6 p-4" {...props} />
            ),
          }}
        >
          {trimActionsFromBody(body)}
        </ReactMarkdown>
        {getActionYamlFromBody(body) && (
          <Disclosure as="div" className="text-gray bg-slate-200 rounded-lg">
            {({ open }) => <></>}
          </Disclosure>
        )}
      </article>
    </div>
  )
}
