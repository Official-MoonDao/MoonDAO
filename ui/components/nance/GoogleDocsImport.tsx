import { useState } from 'react'
import toast from 'react-hot-toast'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { DocumentTextIcon, ArrowPathIcon, LinkIcon } from '@heroicons/react/24/outline'

interface GoogleDocsImportProps {
  setMarkdown: (markdown: string) => void
  setTitle?: (title: string) => void
  onImportStart?: () => void
  onImportEnd?: () => void
}

export default function GoogleDocsImport({
  setMarkdown,
  setTitle,
  onImportStart,
  onImportEnd,
}: GoogleDocsImportProps) {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const isValidGoogleDocsUrl = (url: string): boolean => {
    return url.includes('docs.google.com/document/d/') || /^[a-zA-Z0-9_-]{25,}$/.test(url)
  }

  const handleImport = async () => {
    if (!url.trim()) {
      toast.error('Please enter a Google Docs URL', { style: toastStyle })
      return
    }

    if (!isValidGoogleDocsUrl(url)) {
      toast.error('Please enter a valid Google Docs URL', { style: toastStyle })
      return
    }

    setIsLoading(true)
    onImportStart?.()

    try {
      const response = await fetch('/api/google/docs/fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch document')
      }

      // Set the content in the editor
      setMarkdown(data.content)
      
      // Optionally set the title if provided
      if (setTitle && data.title) {
        setTitle(data.title)
      }

      toast.success('Document imported successfully!', { style: toastStyle })
      setUrl('')
    } catch (error: any) {
      console.error('Error importing Google Doc:', error)
      toast.error(error.message || 'Failed to import document', { style: toastStyle })
    } finally {
      setIsLoading(false)
      onImportEnd?.()
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleImport()
    }
  }

  return (
    <div className="flex flex-col gap-2 w-full min-w-[200px]">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Paste Google Docs URL..."
            disabled={isLoading}
            className="w-full pl-10 pr-3 py-2 bg-dark-cool border border-white/20 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleImport}
          disabled={isLoading || !url.trim()}
          className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-RobotoMono rounded-lg transition-all duration-300 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <DocumentTextIcon className="w-4 h-4" />
              Import
            </>
          )}
        </button>
      </div>
      <p className="text-xs text-gray-400">
        Make sure the document is shared with &quot;Anyone with the link&quot;
      </p>
    </div>
  )
}
