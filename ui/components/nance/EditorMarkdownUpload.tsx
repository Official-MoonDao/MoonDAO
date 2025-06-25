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
          className="px-4 py-3 w-full min-w-[200px] bg-gradient-to-r from-green-600/20 to-emerald-600/20 hover:from-green-600/30 hover:to-emerald-600/30 border border-green-500/30 hover:border-green-500/50 text-green-400 hover:text-green-300 font-RobotoMono rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl text-sm"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload Markdown
        </button>
      </label>
    </div>
  )
}
