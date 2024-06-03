import { useState } from 'react'
import { Job } from '../jobs/Job'

type EntityJobModalProps = {
  entityId: string
  setEnabled: Function
}

export default function EntityJobModal({
  entityId,
  setEnabled,
}: EntityJobModalProps) {
  const [jobData, setJobData] = useState<Job>()

  return (
    <div
      onMouseDown={(e: any) => {
        if (e.target.id === 'entity-job-modal-backdrop') setEnabled(false)
      }}
      id="entity-job-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <div className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md">
        <p>Add a Job</p>
      </div>
    </div>
  )
}
