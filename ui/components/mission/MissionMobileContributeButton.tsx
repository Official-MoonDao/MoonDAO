import { useEffect, useState } from 'react'
import { useWindowSize } from 'react-use'
import MissionPayRedeem from './MissionPayRedeem'
import type { MissionPayRedeemProps } from './MissionPayRedeem'

type MissionMobileContributeButtonProps = Omit<
  MissionPayRedeemProps,
  'onlyButton' | 'visibleButton' | 'buttonMode'
> & {
  isPayRedeemContainerVisible: boolean
  deadlinePassed: boolean
}

export default function MissionMobileContributeButton({
  isPayRedeemContainerVisible,
  deadlinePassed,
  ...missionPayRedeemProps
}: MissionMobileContributeButtonProps) {
  const [isMounted, setIsMounted] = useState(false)
  const { width: windowWidth } = useWindowSize()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted || windowWidth === 0 || windowWidth >= 768 || deadlinePassed) {
    return null
  }

  return (
    <div className={`fixed bottom-8 transition-opacity duration-300`}>
      <MissionPayRedeem
        {...missionPayRedeemProps}
        onlyButton
        visibleButton={!isPayRedeemContainerVisible}
        buttonMode="fixed"
      />
    </div>
  )
}
