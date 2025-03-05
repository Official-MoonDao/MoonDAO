import { useState } from 'react'

export type MissionActivityTabType = 'volume' | 'juicebox' | 'trending'

export default function MissionActivity() {
  const [tab, setTab] = useState<MissionActivityTabType>('volume')
  return <div></div>
}
