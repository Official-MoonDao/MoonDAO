import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'

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
        {description || ''}
      </ReactMarkdown>
    </div>
  )
}
