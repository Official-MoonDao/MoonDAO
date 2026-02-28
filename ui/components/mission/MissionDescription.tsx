import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'

/**
 * Toast UI Editor (used by NanceEditor) outputs single \n between paragraphs
 * in WYSIWYG mode instead of the standard \n\n required by CommonMark.
 * See: https://github.com/nhn/tui.editor/issues/2747
 *
 * This function normalizes single newlines between text lines into double
 * newlines so ReactMarkdown creates proper <p> tags with paragraph spacing.
 * Already-correct \n\n sequences and HTML content pass through unchanged.
 */
export function normalizeMarkdownParagraphs(md: string): string {
  if (!md) return ''
  // Skip normalization for content that is primarily HTML
  if (md.trimStart().startsWith('<')) return md
  return md.replace(/([^\n])\n(?!\n)/g, '$1\n\n')
}

export default function MissionDescription({
  description,
  className = '',
}: {
  description: string
  className?: string
}) {
  return (
    <div className={`prose prose-invert max-w-none ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {normalizeMarkdownParagraphs(description)}
      </ReactMarkdown>
    </div>
  )
}
