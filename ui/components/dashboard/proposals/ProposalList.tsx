import { useState } from 'react'
import { useGQLQuery } from '../../../lib/utils/hooks/useGQLQuery'

export default function ProposalList({ data }: any) {
  const [skip, setSkip] = useState(0)
  const pages = [...Array(6)]

  return <></>
}
