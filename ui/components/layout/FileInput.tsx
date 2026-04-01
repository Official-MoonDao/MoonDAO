import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { isImageBlank } from '@/lib/utils/images'
import { fitImage, cropImage } from '@/lib/utils/images'
import Tooltip from './Tooltip'

type FileInputProps = {
  id?: string
  file?: File | undefined
  uri?: string
  label?: string
  setFile: Function
  noBlankImages?: boolean
  dimensions?: number[]
  crop?: boolean
  accept?: string
  acceptText?: string
  tooltip?: string
}

export default function FileInput({
  id,
  label,
  file,
  uri,
  setFile,
  noBlankImages,
  dimensions,
  crop,
  accept = 'image/*',
  acceptText = '',
  tooltip,
}: FileInputProps) {
  const [fileName, setFileName] = useState(
    uri ? uri : file?.name || ''
  )
  const [isDragOver, setIsDragOver] = useState(false)

  const processFile = useCallback(
    async (selectedFile: File) => {
      const chosenFileName = selectedFile?.name.slice(0, 28) || ''
      if (noBlankImages && (await isImageBlank(selectedFile))) {
        return toast.error('Please ensure your image is not blank.')
      }
      setFileName(chosenFileName)
      if (dimensions) {
        const resizedImage = crop
          ? await cropImage(selectedFile, dimensions[0], dimensions[1])
          : await fitImage(selectedFile, dimensions[0], dimensions[1])
        setFile(resizedImage)
      } else {
        setFile(selectedFile)
      }
    },
    [noBlankImages, dimensions, crop, setFile]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile) processFile(droppedFile)
    },
    [processFile]
  )

  return (
    <div id={id} className="relative flex flex-col gap-2 w-full">
      {(label || tooltip) && (
        <div className="flex flex-row items-center gap-2">
          {label && <p className="text-sm font-GoodTimes text-white">{label}</p>}
          {tooltip && <Tooltip text={tooltip}>?</Tooltip>}
        </div>
      )}
      <input
        type="file"
        accept={accept}
        onChange={async (e: any) => {
          const file = e.target.files[0]
          if (file) processFile(file)
        }}
        className="hidden"
        id="file-upload"
      />
      <label
        htmlFor="file-upload"
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`group cursor-pointer w-full rounded-2xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-3 py-8 px-4 ${
          isDragOver
            ? 'border-indigo-400 bg-indigo-500/10'
            : fileName
            ? 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-400/60'
            : 'border-white/[0.12] bg-white/[0.02] hover:border-white/[0.25] hover:bg-white/[0.04]'
        }`}
      >
        {/* Upload icon */}
        <div
          className={`rounded-xl p-3 transition-colors ${
            fileName
              ? 'bg-emerald-500/10'
              : 'bg-white/[0.04] group-hover:bg-white/[0.08]'
          }`}
        >
          {fileName ? (
            <svg
              className="w-6 h-6 text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="w-6 h-6 text-slate-400 group-hover:text-slate-300 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          )}
        </div>

        {fileName ? (
          <>
            <span className="text-sm text-emerald-300 font-medium truncate max-w-full">
              {fileName}
            </span>
            <span className="text-xs text-slate-500">Click or drop to replace</span>
          </>
        ) : (
          <>
            <div className="text-center">
              <span className="text-sm text-slate-300 font-medium">
                Drop your image here
              </span>
              <span className="text-sm text-slate-500"> or </span>
              <span className="text-sm text-indigo-400 font-medium">browse</span>
            </div>
            {acceptText && (
              <span className="text-xs text-slate-500">{acceptText}</span>
            )}
          </>
        )}
      </label>
    </div>
  )
}
