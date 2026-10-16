import { useEffect, useState } from 'react'
import { getAttribution, typeformEmbedUrl } from '@/lib/analytics/attribution'

type AttributedTypeformFrameProps = {
  formId: string
}

// Hidden fields are appended only when analytics consent has already been
// granted. The Typeform form must define the same hidden field names or it
// ignores the values.
export default function AttributedTypeformFrame({ formId }: AttributedTypeformFrameProps) {
  const bare = typeformEmbedUrl(formId, {})
  const [src, setSrc] = useState(bare)

  useEffect(() => {
    setSrc(typeformEmbedUrl(formId, getAttribution()))
  }, [formId])

  return (
    <iframe
      src={src}
      title="Citizen profile"
      style={{ width: '100%', height: '700px', border: 'none' }}
      allow="microphone; camera"
    />
  )
}
