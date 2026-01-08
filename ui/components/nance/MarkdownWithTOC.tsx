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
    <div>
      <article className="w-full break-words text-white overflow-x-hidden">
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
            h2: ({ node, ...props }) => (
              <h2 className="group font-GoodTimes text-xl md:text-2xl mt-6 mb-3" {...props} />
            ),
            h3: ({ node, ...props }) => (
              <h3 className="group font-GoodTimes text-lg md:text-xl mt-5 mb-2" {...props} />
            ),
            h4: ({ node, ...props }) => (
              <h4 className="group font-GoodTimes text-base md:text-lg mt-4 mb-2" {...props} />
            ),
            h5: ({ node, ...props }) => (
              <h5 className="group font-GoodTimes text-sm md:text-base mt-3 mb-2" {...props} />
            ),
            h6: ({ node, ...props }) => (
              <h6 className="group font-GoodTimes text-sm md:text-base mt-3 mb-2" {...props} />
            ),
            table: ({ node, ...props }) => (
              <div className="mb-6 overflow-x-auto -mx-2 md:mx-0">
                <div className="min-w-full inline-block md:rounded-xl overflow-hidden md:border md:border-white/10 md:bg-gradient-to-br md:from-slate-700/20 md:to-slate-800/30">
                  <table className="text-left w-full min-w-[600px] border-collapse" {...props} />
                </div>
              </div>
            ),
            th: ({ node, ...props }) => (
              <th
                className="whitespace-normal border-b border-white/10 text-white font-semibold py-2 px-2 md:py-4 md:px-6 md:bg-slate-800/30 text-xs md:text-base"
                {...props}
              />
            ),
            td: ({ node, ...props }) => (
              <td
                className="whitespace-normal border-b border-white/5 text-white/90 py-2 px-2 md:py-4 md:px-6 text-xs md:text-base"
                {...props}
              />
            ),
            p: ({ node, ...props }) => <p className="text-white" {...props} />,
            strong: ({ node, children, ...props }) => (
              <strong className="text-white font-bold" {...props}>
                {children}
              </strong>
            ),
            em: ({ node, ...props }) => <em className="text-white italic" {...props} />,
            br: ({ node, ...props }) => <br {...props} />,
            a: ({ node, ...props }) => (
              <a
                className="text-blue-400 hover:text-blue-300 underline transition-colors"
                {...props}
              />
            ),
            ul: ({ node, ...props }) => (
              <ul
                className="list-disc ml-6 mb-4 text-white"
                style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}
                {...props}
              />
            ),
            ol: ({ node, ...props }) => (
              <ol
                className="list-decimal ml-6 mb-4 text-white"
                style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}
                {...props}
              />
            ),
            li: ({ node, ...props }) => (
              <li
                className="text-white mb-3 leading-relaxed"
                style={{ marginBottom: '0.75rem', display: 'list-item' }}
                {...props}
              />
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
