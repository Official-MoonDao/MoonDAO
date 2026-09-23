import { ReactNode } from 'react'

interface ProfileHeaderFrameProps {
  id?: string
  image: ReactNode
  children: ReactNode
}

/**
 * Shared chrome for citizen/team profile headers.
 * Stretch-aligns the text column so long GoodTimes names wrap inside the
 * card instead of expanding it past overflow-hidden parents.
 */
export default function ProfileHeaderFrame({ id, image, children }: ProfileHeaderFrameProps) {
  return (
    <div id={id} className="w-full min-w-0 max-w-[1080px] mx-auto">
      <div className="w-full min-w-0 bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30 overflow-hidden">
        <div id="frame-content-container" className="w-full min-w-0 p-4 sm:p-6">
          <div
            id="profile-description-section"
            className="flex w-full min-w-0 flex-col lg:flex-row items-stretch gap-6"
          >
            <div className="relative flex-shrink-0 self-center">{image}</div>
            <div
              id="profile-text-column"
              className="flex-1 min-w-0 w-full flex flex-col justify-center min-h-[200px] lg:min-h-[250px]"
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
