import { useState } from 'react'

type ProposalListProps = {
  data: any
  skip: number
  setSkip: Function
}

export default function ProposalList({
  data,
  skip,
  setSkip,
}: ProposalListProps) {
  const pages = [...Array(6)]

  return <></>
}
