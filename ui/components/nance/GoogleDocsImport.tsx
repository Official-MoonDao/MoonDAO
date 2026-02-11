import { useState } from 'react'
import toast from 'react-hot-toast'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { DocumentTextIcon, ArrowPathIcon, LinkIcon, CloudArrowDownIcon } from '@heroicons/react/24/outline'

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
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center gap-2 text-white">
        <CloudArrowDownIcon className="w-5 h-5 text-indigo-400" />
        <span className="font-medium">Import from Google Docs</span>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <LinkIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Paste your Google Docs URL here..."
            disabled={isLoading}
            className="w-full pl-12 pr-4 py-3 bg-black/40 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          onClick={handleImport}
          disabled={isLoading || !url.trim()}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-indigo-500/25 min-w-[140px]"
        >
          {isLoading ? (
            <>
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <DocumentTextIcon className="w-5 h-5" />
              Import
            </>
          )}
        </button>
      </div>
      
      <p className="text-xs text-gray-400 flex items-center gap-1">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        Document must be shared with &quot;Anyone with the link can view&quot;
      </p>
    </div>
  )
}
