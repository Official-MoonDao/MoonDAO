import { useState } from 'react'
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
  //get file name
  const [fileName, setFileName] = useState(
    uri ? uri : file?.name || ''
  )
  return (
    <div id={id} className="w-full max-w-[600px]">
      <div className="flex flex-row items-center gap-2 mb-2">
        {label && <p className={`text-sm font-GoodTimes`}>{label}</p>}
        {tooltip && <Tooltip text={tooltip}>?</Tooltip>}
      </div>
      <input
        type="file"
        accept={accept}
        onChange={async (e: any) => {
          const file = e.target.files[0]
          const chosenFileName = file?.name.slice(0, 20) || ''
          if (noBlankImages && (await isImageBlank(file))) {
            return toast.error('Please ensure your image is not blank.')
          }
          setFileName(chosenFileName)
          if (dimensions) {
            const resizedImage = crop
              ? await cropImage(file, dimensions[0], dimensions[1])
              : await fitImage(file, dimensions[0], dimensions[1])
            setFile(resizedImage)
          } else {
            setFile(file)
          }
        }}
        className="hidden"
        id="file-upload"
      />
      <label
        htmlFor="file-upload"
        className="group cursor-pointer flex flex-col items-center justify-center w-full rounded-2xl border-2 border-dashed border-white/20 hover:border-indigo-400/50 bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-300 py-8 px-6"
      >
        <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mb-3 group-hover:bg-indigo-500/20 transition-colors duration-300">
          <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
        </div>
        {fileName ? (
          <p className="text-white/80 text-sm font-medium">{fileName}</p>
        ) : (
          <>
            <p className="text-white/80 text-sm font-medium">Click to upload a photo</p>
            <p className="text-white/40 text-xs mt-1">
              {acceptText || 'PNG, JPEG, WEBP, GIF, or SVG'}
            </p>
          </>
        )}
      </label>
    </div>
  )
}
