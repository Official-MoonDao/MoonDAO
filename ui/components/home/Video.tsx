import { useState, useRef, useEffect, useCallback } from 'react'

export default function Video() {
    const [isMuted, setIsMuted] = useState(true)
    const [isPlaying, setIsPlaying] = useState(false) // Start paused
    const [player, setPlayer] = useState<any>(null)
    const [isPlayerReady, setIsPlayerReady] = useState(false)
    const [isInView, setIsInView] = useState(false)
    const videoRef = useRef<HTMLIFrameElement>(null)
    const sectionRef = useRef<HTMLDivElement>(null)

    // Handle video play/pause based on viewport visibility
    const handleVideoPlayback = useCallback(async () => {
        if (player && isPlayerReady) {
            try {
                if (isInView) {
                    await player.play()
                    setIsPlaying(true)
                } else {
                    await player.pause()
                    setIsPlaying(false)
                }
            } catch (error) {
                console.error('Error controlling video playback:', error)
            }
        }
    }, [player, isPlayerReady, isInView])

    // Set up intersection observer to detect when video is in viewport
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    setIsInView(entry.isIntersecting)
                })
            },
            {
                threshold: 0.3, // Start playing when 30% of video is visible
                rootMargin: '0px 0px -100px 0px' // Add some margin to prevent premature triggering
            }
        )

        if (sectionRef.current) {
            observer.observe(sectionRef.current)
        }

        return () => {
            if (sectionRef.current) {
                observer.unobserve(sectionRef.current)
            }
        }
    }, [])

    // Handle video playback when visibility or player state changes
    useEffect(() => {
        handleVideoPlayback()
    }, [handleVideoPlayback])

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
                        // Don't autoplay - let intersection observer handle it
                        vimeoPlayer.pause()
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
        <section 
            ref={sectionRef}
            id="video-section" 
            className="relative bg-dark-cool"
            >
            <div id="video-container" 
                className="w-full h-full max-w-[1920px] 2xl:max-w-[2560px] mx-auto"
                >
                <div id="video-wrapper" 
                    className="w-full aspect-video relative z-40 group"
                    >
                    <iframe 
                        ref={videoRef}
                        id="video" 
                        className="absolute left-0 top-0 bg-dark-cool w-full h-full object-cover" 
                        src="https://player.vimeo.com/video/944146258?badge=0&amp;autopause=0&amp;autoplay=0&amp;muted=1&amp;loop=1&amp;controls=0&amp;player_id=0&amp;app_id=58479" 
                        allowFullScreen 
                        width="100%" height="100%" 
                        allow="autoplay; fullscreen"
                        style={{ objectFit: 'cover' }}
                    />
                    
                    {/* Video Loading State */}
                    {!isPlayerReady && (
                        <div className="absolute inset-0 bg-dark-cool flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                <p className="text-white/60 text-sm">Loading video...</p>
                            </div>
                        </div>
                    )}
                    
                    {/* Video Paused Overlay */}
                    {isPlayerReady && !isPlaying && (
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                            <div className="bg-black/50 rounded-full p-4">
                                <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z"/>
                                </svg>
                            </div>
                        </div>
                    )}
                    
                    {/* Custom Controls */}
                    <div className="absolute bottom-4 right-4 2xl:bottom-6 2xl:right-6 3xl:bottom-8 3xl:right-8 flex gap-2 2xl:gap-3 3xl:gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        {/* Mute/Unmute Button */}
                        <button
                            onClick={toggleMute}
                            disabled={!isPlayerReady}
                            className={`p-2 2xl:p-3 3xl:p-4 rounded-full transition-colors ${
                                isPlayerReady
                                    ? 'bg-black/70 text-white hover:bg-black/90 cursor-pointer'
                                    : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                            }`}
                            style={{ cursor: isPlayerReady ? 'pointer' : 'not-allowed' }}
                            aria-label={isMuted ? "Unmute video" : "Mute video"}
                        >
                            {isMuted ? (
                                <svg className="w-5 h-5 2xl:w-6 2xl:h-6 3xl:w-7 3xl:h-7" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                                </svg>
                            ) : (
                                <svg className="w-5 h-5 2xl:w-6 2xl:h-6 3xl:w-7 3xl:h-7" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                                </svg>
                            )}
                        </button>
                        
                        {/* Play/Pause Button */}
                        <button
                            onClick={togglePlayPause}
                            disabled={!isPlayerReady}
                            className={`p-2 2xl:p-3 3xl:p-4 rounded-full transition-colors ${
                                isPlayerReady
                                    ? 'bg-black/70 text-white hover:bg-black/90 cursor-pointer'
                                    : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                            }`}
                            style={{ cursor: isPlayerReady ? 'pointer' : 'not-allowed' }}
                            aria-label={isPlaying ? "Pause video" : "Play video"}
                        >
                            {isPlaying ? (
                                <svg className="w-5 h-5 2xl:w-6 2xl:h-6 3xl:w-7 3xl:h-7" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                                </svg>
                            ) : (
                                <svg className="w-5 h-5 2xl:w-6 2xl:h-6 3xl:w-7 3xl:h-7" fill="currentColor" viewBox="0 0 24 24">
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
