import React, { useEffect } from 'react'
import { useErrorContext } from './ErrorProvider'

export default function ErrorCard({ error }: any) {
  const { removeError } = useErrorContext()
  let timer: ReturnType<typeof setTimeout>
  useEffect(() => {
    timer = setTimeout(() => {
      removeError(error.key)
    }, 5000)
  })
  return (
    <div className="card shadow-md bg-error text-primary-content animate-notification">
      <div className="card-body">
        <h2 className="card-title">Houston, we have a problem</h2>
        <p>
          {error?.message ||
            error?.reason ||
            error?.data?.message ||
            'Unknown error'}
        </p>
      </div>
      <div
        className="btn btn-sm btn-circle btn-ghost absolute right-6 top-1 p-2.5"
        onClick={() => {
          clearTimeout(timer)
          removeError(error.key)
        }}
      >
        ✕
      </div>
    </div>
  )
}
