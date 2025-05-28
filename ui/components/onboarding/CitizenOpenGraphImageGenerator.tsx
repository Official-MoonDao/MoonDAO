import html2canvas from 'html2canvas-pro'
import { MediaRenderer } from 'thirdweb/react'
import client from '@/lib/thirdweb/client'
import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'

// Add font face declaration
const fontStyle = `
  @font-face {
    font-family: 'GoodTimes';
    src: url('/fonts/GoodTimes.woff2') format('woff2'),
         url('/fonts/GoodTimes.woff') format('woff');
    font-weight: normal;
    font-style: normal;
    font-display: block;
  }
`

interface Props {
  ipfsImageUrl: string
  username: string
  citizenNumber: string | number
}

export function CitizenOpenGraphImageGenerator({ ipfsImageUrl, username, citizenNumber }: Props) {
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string>('')
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLHeadingElement>(null)

  // Inject GoodTimesOG font-face for preview only in this component
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: 'GoodTimesOG';
        src: url('/fonts/good_times_rg-webfont.woff') format('woff');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsImageLoaded(true)
    }, 2000)
    return () => clearTimeout(timer)
  }, [ipfsImageUrl])

  useEffect(() => {
    if (!textRef.current) return
    const text = textRef.current
    const container = text.parentElement
    if (!container) return
    text.style.setProperty('--text-length', username.length.toString())
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    const textWidth = text.scrollWidth
    const textHeight = text.scrollHeight
    const widthScale = containerWidth / textWidth
    const heightScale = containerHeight / textHeight
    const scaleFactor = Math.min(widthScale, heightScale) // Fill the full container
    
    text.style.setProperty('--scale-factor', scaleFactor.toString())
  }, [username])

  async function generateOGImage() {
    if (!containerRef.current) return
    await document.fonts.ready;
    await new Promise(resolve => setTimeout(resolve, 500)); // ensure render

    const fontFace = `
      @font-face {
        font-family: 'GoodTimesOG';
        src: url('/fonts/good_times_rg-webfont.woff') format('woff');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }
    `;

    const canvas = await html2canvas(containerRef.current, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      scale: 2,
      onclone: (clonedDoc) => {
        const style = clonedDoc.createElement('style');
        style.textContent = fontFace;
        clonedDoc.head.appendChild(style);
      }
    });
    const img = canvas.toDataURL('image/png');
    setGeneratedImageUrl(img);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={containerRef}
        id="ogImageContainer"
        className="w-[1200px] h-[630px] relative overflow-hidden"
      >
        <div className="absolute inset-0 flex items-center relative">
          {/* Complete container */}
            <div 
                className="flex w-[1200px] h-[630px]"
                style={{
                backgroundImage: 'url(/assets/rainbow-watercolor-og-bg.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
                }}
            >
                <div className="flex">
                    <div className="flex items-center justify-end h-full w-[500px] bg-gradient-to-r from-white to-[#001a4a] from-80% to-80% pl-10 pr-[2px] mr-[-2px]">
                        {/* Citizen image wrapper for proper rounding */}
                        <div className="rounded-[32px] overflow-hidden w-[460px] h-[460px] bg-white border-white border-[10px]">
                            <MediaRenderer
                                client={client}
                                src={ipfsImageUrl}
                                width="420"
                                height="420"
                                alt=""
                                style={{ 
                                    objectFit: 'cover', 
                                    objectPosition: 'center',
                                    width: '100%',
                                    height: '100%',
                                    display: 'block'
                                }}
                            />
                        </div>
                    </div>
                </div>
                <div 
                    className="h-full w-[700px] flex flex-col justify-center items-center"
                    style={{
                        background: `url(/assets/san-rainbow-og-bg-overlay.png), linear-gradient(to left, transparent, #001a4a)`,
                        backgroundSize: 'cover, cover',
                        backgroundPosition: 'center, center',
                        backgroundRepeat: 'no-repeat, no-repeat'
                    }}
                    >
                    <div className="mt-[-50px] w-[550px] h-[80px] flex items-end justify-center">
                        <h1 
                            ref={textRef}
                            id="username-text"
                            className="whitespace-nowrap text-center text-white"
                            style={{
                                fontFamily: 'GoodTimesOG, sans-serif',
                                fontSize: '48px',
                                lineHeight: '1',
                                transform: 'scale(var(--scale-factor, 1))',
                                transformOrigin: 'center'
                            }}
                        >
                            {username}
                        </h1>
                    </div>
                    <h2
                        className="whitespace-nowrap text-center text-white mt-4"
                        style={{
                            fontFamily: 'GoodTimesOG, sans-serif',
                            fontSize: '28px',
                            lineHeight: '1',
                        }}
                    >
                        Citizen # {citizenNumber}
                    </h2>
                </div>
            </div>    
        </div>
        {/* Username Overlay 
        <div className="absolute bottom-0 left-8 text-white w-[560px] h-[100px] flex items-center">
          <Image
            src="/assets/logo-san-sans-icon.svg"
            alt="SAN Logo"
            width={360}
            height={60}
            className="mr-4"
          />
        </div>
        */}
      </div>
      <button
        onClick={generateOGImage}
        disabled={!isImageLoaded}
        className={`px-4 py-2 ${
          isImageLoaded
            ? 'bg-blue-500 text-white hover:bg-blue-600' 
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isImageLoaded ? 'Generate OG Image' : 'Loading Image...'}
      </button>
      {generatedImageUrl && (
        <div className="mt-4">
          <img src={generatedImageUrl} alt="Generated OG Image" />
          <a
            href={generatedImageUrl}
            download="og-image.png"
            className="block mt-2 text-blue-500 hover:underline"
          >
            Download Image
          </a>
        </div>
      )}
    </div>
  )
}

// Test Component
interface TestProps {
  username: string
  ipfsImageUrl: string
  citizenNumber: string | number
}

export function TestOGImageGenerator({ username, ipfsImageUrl, citizenNumber }: TestProps) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">OG Image Generator</h1>
      <CitizenOpenGraphImageGenerator 
        ipfsImageUrl={ipfsImageUrl}
        username={username}
        citizenNumber={citizenNumber}
      />
    </div>
  )
}