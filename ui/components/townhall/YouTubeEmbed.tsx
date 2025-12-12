import { useState } from 'react'

interface YouTubeEmbedProps {
  videoId: string
  className?: string
}

export default function YouTubeEmbed({ videoId, className = '' }: YouTubeEmbedProps) {
  const [isLoading, setIsLoading] = useState(true)
  const embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`

  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative overflow-hidden rounded-none lg:rounded-xl shadow-[0_0_10px_rgba(96,165,250,0.12),0_0_20px_rgba(147,51,234,0.08),0_0_30px_rgba(168,85,247,0.05)] lg:shadow-[0_0_15px_rgba(96,165,250,0.15),0_0_30px_rgba(147,51,234,0.1),0_0_45px_rgba(168,85,247,0.08)]">
        <div className="relative pb-[56.25%] h-0 bg-slate-900/50">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-900/80 backdrop-blur-sm">
              <img
                src="/assets/MoonDAO-Loading-Animation.svg"
                alt="Loading video"
                className="w-24 h-24 md:w-32 md:h-32 lg:w-40 lg:h-40 opacity-90"
              />
            </div>
          )}
          <iframe
            className="absolute top-0 left-0 w-full h-full"
            src={embedUrl}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            onLoad={() => setIsLoading(false)}
          />
        </div>
      </div>
    </div>
  )
}
