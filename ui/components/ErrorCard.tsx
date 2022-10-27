import React, { useEffect } from 'react'
import { useErrorContext } from './ErrorProvider'
import classes from './styles/error-card.module.scss'

export default function ErrorCard({ error }: any) {
  const { removeError } = useErrorContext()

  useEffect(() => {
    setTimeout(() => {
      removeError(error.key)
    }, 4900)
  })
  return (
    <div className={classes.errorCard}>
      <div className="card shadow-md bg-error text-primary-content">
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
          className="btn btn-sm btn-circle btn-ghost absolute right-6 top-1"
          onClick={() => removeError(error.key)}
        >
          ✕
        </div>
      </div>
    </div>
  )
}
