import { useState, useRef, useEffect } from 'react'

export default function Video() {
    const [isMuted, setIsMuted] = useState(true)
    const [isPlaying, setIsPlaying] = useState(true)
    const [player, setPlayer] = useState<any>(null)
    const [isPlayerReady, setIsPlayerReady] = useState(false)
    const videoRef = useRef<HTMLIFrameElement>(null)

    useEffect(() => {
        // Initialize Vimeo player when component mounts
        const initPlayer = async () => {
            if (videoRef.current && (window as any).Vimeo) {
                try {
                    const vimeoPlayer = new (window as any).Vimeo.Player(videoRef.current)
                    
                    // Wait for player to be ready
                    vimeoPlayer.ready().then(() => {
                        setPlayer(vimeoPlayer)
                        setIsPlayerReady(true)
                        
                        // Set up event listeners
                        vimeoPlayer.on('play', () => setIsPlaying(true))
                        vimeoPlayer.on('pause', () => setIsPlaying(false))
                        vimeoPlayer.on('volumechange', async () => {
                            const muted = await vimeoPlayer.getMuted()
                            setIsMuted(muted)
                        })
                        
                        // Set initial state after player is ready
                        vimeoPlayer.setMuted(true)
                        vimeoPlayer.setLoop(true)
                        vimeoPlayer.play()
                    })
                } catch (error) {
                    console.error('Error initializing Vimeo player:', error)
                }
            }
        }

        // Wait for Vimeo SDK to load
        if ((window as any).Vimeo) {
            initPlayer()
        } else {
            const checkVimeo = setInterval(() => {
                if ((window as any).Vimeo) {
                    clearInterval(checkVimeo)
                    initPlayer()
                }
            }, 100)
            
            // Cleanup interval on unmount
            return () => clearInterval(checkVimeo)
        }
    }, [])

    const toggleMute = async () => {
        if (player && isPlayerReady) {
            try {
                const currentMuted = await player.getMuted()
                await player.setMuted(!currentMuted)
                setIsMuted(!currentMuted)
            } catch (error) {
                console.error('Error toggling mute:', error)
            }
        }
    }

    const togglePlayPause = async () => {
        if (player && isPlayerReady) {
            try {
                const paused = await player.getPaused()
                if (paused) {
                    await player.play()
                    setIsPlaying(true)
                } else {
                    await player.pause()
                    setIsPlaying(false)
                }
            } catch (error) {
                console.error('Error toggling play/pause:', error)
            }
        }
    }

    return (
        <section id="video-section" 
            className="relative bg-white lg:mt-[-110px] md:mt-[-50px] mt-[-60px] flex justify-center px-[20px] md:px-[40px]"
            >
            <div id="video-container" 
                className="max-w-[1200px] w-full"
                >
                <div id="video-wrapper" 
                    className="pt-[56.25%] relative rounded-lg z-40 group"
                    >
                    <iframe 
                        ref={videoRef}
                        id="video" 
                        className="absolute left-0 rounded-[20px] top-0 bg-dark-cool" 
                        src="https://player.vimeo.com/video/944146258?badge=0&amp;autopause=0&amp;autoplay=1&amp;muted=1&amp;loop=1&amp;controls=0&amp;player_id=0&amp;app_id=58479" 
                        allowFullScreen 
                        width="100%" height="100%" 
                        allow="autoplay; fullscreen" 
                    />
                    
                    {/* Custom Controls */}
                    <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        {/* Mute/Unmute Button */}
                        <button
                            onClick={toggleMute}
                            disabled={!isPlayerReady}
                            className={`p-2 rounded-full transition-colors ${
                                isPlayerReady
                                    ? 'bg-black/70 text-white hover:bg-black/90 cursor-pointer'
                                    : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                            }`}
                            style={{ cursor: isPlayerReady ? 'pointer' : 'not-allowed' }}
                            aria-label={isMuted ? "Unmute video" : "Mute video"}
                        >
                            {isMuted ? (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                                </svg>
                            )}
                        </button>
                        
                        {/* Play/Pause Button */}
                        <button
                            onClick={togglePlayPause}
                            disabled={!isPlayerReady}
                            className={`p-2 rounded-full transition-colors ${
                                isPlayerReady
                                    ? 'bg-black/70 text-white hover:bg-black/90 cursor-pointer'
                                    : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                            }`}
                            style={{ cursor: isPlayerReady ? 'pointer' : 'not-allowed' }}
                            aria-label={isPlaying ? "Pause video" : "Play video"}
                        >
                            {isPlaying ? (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z"/>
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    )
}
