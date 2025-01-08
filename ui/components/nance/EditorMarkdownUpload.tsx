import { useRef } from 'react'
import toast from 'react-hot-toast'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'

export default function EditorMarkdownUpload({
  setMarkdown,
}: {
  setMarkdown: (markdown: string) => void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFileUpload = (event: any) => {
    const file = event.target.files[0]
    if (
      file &&
      (file.type === 'text/markdown' || file.name.toLowerCase().endsWith('.md'))
    ) {
      const reader = new FileReader()
      reader.onload = (e: any) => {
        const markdownContent = e.target.result
        setMarkdown(markdownContent)
      }
      reader.readAsText(file)
    } else {
      toast.error('Please upload a valid markdown file.', { style: toastStyle })
    }
  }

  return (
    <div>
      <input
        type="file"
        accept=".md"
        style={{ display: 'none' }}
        id="markdown-upload"
        onChange={handleFileUpload}
        ref={fileInputRef}
      />
      <label htmlFor="markdown-upload">
        <button
          type="button"
          className="p-1 w-full min-w-[200px] gradient-2 rounded-lg"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload Markdown
        </button>
      </label>
    </div>
  )
}
