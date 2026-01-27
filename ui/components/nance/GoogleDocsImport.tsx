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
      toast.error('Invalid Google Docs URL', { style: toastStyle })
      return
    }

    setIsLoading(true)
    onImportStart?.()

    try {
      const response = await fetch('/api/google/docs/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch document')

      setMarkdown(data.content)
      if (setTitle && data.title) setTitle(data.title)

      toast.success('Document imported', { style: toastStyle })
      setUrl('')
    } catch (error: any) {
      toast.error(error.message || 'Failed to import', { style: toastStyle })
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
    <div className="flex flex-col gap-3 w-full lg:min-w-[300px]">
      <label className="block text-sm font-medium text-white">
        Import from Google Docs
      </label>
      <div className="relative">
        <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Paste Google Docs URL..."
          disabled={isLoading}
          className="w-full pl-10 pr-3 py-3 bg-dark-cool border border-white/20 rounded-xl text-white placeholder-gray-400 focus:border-blue-500 disabled:opacity-50"
        />
      </div>
      <button
        type="button"
        onClick={handleImport}
        disabled={isLoading || !url.trim()}
        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <ArrowPathIcon className="w-5 h-5 animate-spin" />
            Importing...
          </>
        ) : (
          <>
            <DocumentTextIcon className="w-5 h-5" />
            Import Document
          </>
        )}
      </button>
      <p className="text-xs text-gray-400 text-center">
        Make sure the document is shared with &quot;Anyone with the link&quot;
      </p>
    </div>
  )
}
