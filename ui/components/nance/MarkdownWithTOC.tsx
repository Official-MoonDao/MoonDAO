import { h } from 'hastscript'
import ReactMarkdown from 'react-markdown'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'

export default function MarkdownWithTOC({ body }: { body: string }) {
  return (
    <article className="prose prose-table:table-fixed mx-auto break-words text-gray-500">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          rehypeSanitize,
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
        ]}
        components={{
          h2: ({ node, ...props }) => <h2 className="group" {...props} />,
          h3: ({ node, ...props }) => <h3 className="group" {...props} />,
          h4: ({ node, ...props }) => <h4 className="group" {...props} />,
          h5: ({ node, ...props }) => <h5 className="group" {...props} />,
          h6: ({ node, ...props }) => <h6 className="group" {...props} />,
        }}
      >
        {body}
      </ReactMarkdown>
    </article>
  )
}
