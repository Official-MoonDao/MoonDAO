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
    uri ? uri : file?.name || 'No file chosen'
  )
  return (
    <div id={id} className="relative flex flex-col gap-2 max-w-[250px]">
      <div className="flex flex-row items-center gap-2">
        {label && <p className={`text-sm font-GoodTimes`}>{label}</p>}
        {tooltip && <Tooltip text={tooltip}>?</Tooltip>}
      </div>
      <input
        type="file"
        accept={accept}
        onChange={async (e: any) => {
          const file = e.target.files[0]
          const chosenFileName = file?.name.slice(0, 20) || 'No file chosen'
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
        className="cursor-pointer gradient-2 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded inline-flex items-center"
      >
        <svg
          className="w-4 h-4 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 4v16m8-8H4"
          ></path>
        </svg>
        <span>Choose File</span>
      </label>
      <span id="file-chosen" className=" text-gray-600 break-words">
        {fileName}
      </span>
      {acceptText && <p className="text-xs text-gray-500">{acceptText}</p>}
    </div>
  )
}
