import { useState } from 'react'

export default function FileInput({ setFile }: any) {
  const [fileName, setFileName] = useState('No file chosen')
  return (
    <div className="relative">
      <input
        type="file"
        accept="image/*"
        onChange={(e: any) => {
          const file = e.target.files[0]
          const chosenFileName = file?.name.slice(0, 20) || 'No file chosen'
          setFileName(chosenFileName)
          setFile(file)
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
      <span id="file-chosen" className="ml-3 text-gray-600">
        {fileName}
      </span>
    </div>
  )
}
