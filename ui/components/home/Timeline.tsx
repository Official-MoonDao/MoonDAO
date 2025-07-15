import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'

interface TimelineEvent {
  date: string
  year: number
  title: string
  description: string
  icon?: string
  iconAlt?: string
}

const timelineEvents: TimelineEvent[] = [
  {
    date: 'Nov 2021',
    year: 2021,
    title: 'MoonDAO Launch',
    description: 'MoonDAO was officially launched as the first decentralized autonomous organization focused on space exploration and lunar settlement.',
    icon: '/assets/moondao-logo.svg',
    iconAlt: 'MoonDAO Launch'
  },
  {
    date: 'Feb 2022',
    year: 2022,
    title: 'Raised $8M',
    description: 'Successfully raised 2600 ETH through community funding and announced partnership with Blue Origin for civilian space flights. Two tickets were purchased on Blue Origin flight.',
    icon: '/assets/icon-ethereum.svg',
    iconAlt: 'Fundraising Success'
  },
  {
    date: 'Aug 2022',
    year: 2022,
    title: 'First to Space',
    description: 'Coby Cotton was selected and successfully launched to space on Blue Origin\'s flight. MoonDAO also established its foundational constitution.',
    icon: '/assets/icon-astronaut.svg',
    iconAlt: 'Space Launch'
  },
  {
    date: 'May 2023',
    year: 2023,
    title: 'Project Funding',
    description: 'MoonDAO expanded its mission by funding 80+ space-related projects, supporting innovation in the space technology sector and fostering a thriving ecosystem of space entrepreneurs.',
    icon: '/assets/icon-project.svg',
    iconAlt: 'Project Funding'
  },
  {
    date: 'Jan 2024',
    year: 2024,
    title: 'Zero Gravity',
    description: 'Organized a zero gravity flight experience with three astronauts, advancing space training and research capabilities.',
    icon: '/assets/icon-plane.svg',
    iconAlt: 'Zero Gravity'
  },
  {
    date: 'May 2024',
    year: 2024,
    title: 'Space Network',
    description: 'Launched the Space Acceleration Network to foster collaboration and accelerate space technology development.',
    icon: '/assets/san-logo.svg',
    iconAlt: 'Space Network'
  },
  {
    date: 'Aug 2024',
    year: 2024,
    title: 'Second to Space',
    description: 'Eiman Jahangir was selected and successfully completed the journey to space, marking MoonDAO\'s second successful astronaut mission.',
    icon: '/assets/icon-astronaut.svg',
    iconAlt: 'Second Space Mission'
  },
  {
    date: 'May 2025',
    year: 2025,
    title: 'Launchpad',
    description: 'Launched the MoonDAO Launchpad platform, enabling decentralized funding for space missions and projects.',
    icon: '/assets/MoonDAOLaunchpad.svg',
    iconAlt: 'Launchpad Platform'
  },
  {
    date: '2025',
    year: 2025,
    title: 'Starship Access',
    description: '10,000s of engaged members. Fundraise for ownership of a Starship or equivalent launch vehicle, and guaranteed refuel missions.',
    icon: '/assets/icon-plane.svg',
    iconAlt: 'Starship Ownership'
  },
  {
    date: '2026',
    year: 2026,
    title: 'Settlement Design',
    description: '100,000s of engaged members. Design of major lunar settlement components completed, ready for manufacturing on Earth.',
    icon: '/assets/icon-project.svg',
    iconAlt: 'Settlement Design'
  },
  {
    date: '2027',
    year: 2027,
    title: 'Manufacturing',
    description: '1,000,000s of engaged members. Selection of first Moon settlers. Manufacturing of key components with Earth-based simulations.',
    icon: '/assets/icon-contract.svg',
    iconAlt: 'Manufacturing'
  },
  {
    date: '2028',
    year: 2028,
    title: 'Ready for Launch',
    description: '10,000,000s of engaged members. Components tested and ready for launch with Earth-based simulation complete.',
    icon: '/assets/icon-lander.svg',
    iconAlt: 'Ready for Launch'
  },
  {
    date: '2029',
    year: 2029,
    title: 'Moon Construction',
    description: 'Infrastructure is sent to the Moon and the first crew begins construction of the lunar settlement.',
    icon: '/assets/icon-globe.svg',
    iconAlt: 'Lunar Construction'
  },
  {
    date: 'Jan 2030',
    year: 2030,
    title: 'Lunar Party',
    description: 'The first minimum viable Lunar Settlement is complete. Host a New Year\'s Eve party on the Moon celebrating humanity\'s achievement.',
    icon: '/assets/icon-events.svg',
    iconAlt: 'Lunar Party'
  }
]

export default function Timeline() {
  const [selectedEvent, setSelectedEvent] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  // Function to update selected event based on scroll position
  const updateSelectedEventOnScroll = () => {
    if (!scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const containerRect = container.getBoundingClientRect()
    const containerCenter = containerRect.left + containerRect.width / 2

    let closestIndex = 0
    let closestDistance = Infinity

    // Find which card is closest to the center of the viewport
    Array.from(container.children).forEach((child, index) => {
      if (child instanceof HTMLElement) {
        const childRect = child.getBoundingClientRect()
        const childCenter = childRect.left + childRect.width / 2
        const distance = Math.abs(childCenter - containerCenter)

        if (distance < closestDistance) {
          closestDistance = distance
          closestIndex = index
        }
      }
    })

    if (closestIndex !== selectedEvent) {
      setSelectedEvent(closestIndex)
    }
  }

  // Add scroll event listener
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      // Update immediately for smoother feedback
      updateSelectedEventOnScroll()
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setStartX(e.pageX - (scrollContainerRef.current?.offsetLeft || 0))
    setScrollLeft(scrollContainerRef.current?.scrollLeft || 0)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return
    e.preventDefault()
    const x = e.pageX - (scrollContainerRef.current.offsetLeft || 0)
    const walk = (x - startX) * 2
    scrollContainerRef.current.scrollLeft = scrollLeft - walk
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true)
    setStartX(e.touches[0].pageX - (scrollContainerRef.current?.offsetLeft || 0))
    setScrollLeft(scrollContainerRef.current?.scrollLeft || 0)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !scrollContainerRef.current) return
    const x = e.touches[0].pageX - (scrollContainerRef.current.offsetLeft || 0)
    const walk = (x - startX) * 2
    scrollContainerRef.current.scrollLeft = scrollLeft - walk
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  const scrollToEvent = (index: number) => {
    setSelectedEvent(index)
    if (scrollContainerRef.current) {
      const eventElement = scrollContainerRef.current.children[index] as HTMLElement
      if (eventElement) {
        const container = scrollContainerRef.current
        const containerRect = container.getBoundingClientRect()
        const elementRect = eventElement.getBoundingClientRect()
        
        // Calculate the scroll position to center the element
        const scrollPosition = 
          container.scrollLeft + 
          elementRect.left - 
          containerRect.left - 
          (containerRect.width - elementRect.width) / 2
        
        container.scrollTo({
          left: scrollPosition,
          behavior: 'smooth'
        })
      }
    }
  }

  return (
    <section className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 w-full py-12 lg:py-16 xl:py-20 2xl:py-24 3xl:py-28 relative overflow-hidden">
      {/* Background decoration with stars */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500 rounded-full blur-3xl"></div>
        {/* Stars */}
        <div className="absolute top-10 left-10 w-1 h-1 bg-white rounded-full opacity-60"></div>
        <div className="absolute top-20 right-20 w-1 h-1 bg-white rounded-full opacity-40"></div>
        <div className="absolute top-40 left-1/3 w-0.5 h-0.5 bg-white rounded-full opacity-50"></div>
        <div className="absolute bottom-40 right-1/3 w-1 h-1 bg-white rounded-full opacity-60"></div>
        <div className="absolute top-60 right-40 w-0.5 h-0.5 bg-white rounded-full opacity-40"></div>
        <div className="absolute bottom-60 left-40 w-1 h-1 bg-white rounded-full opacity-50"></div>
        <div className="absolute top-80 left-1/2 w-0.5 h-0.5 bg-white rounded-full opacity-60"></div>
      </div>
      
      <div className="px-8 md:px-12 lg:px-16 2xl:px-24 3xl:px-32 relative z-10">
        <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto flex flex-col items-center">
          <h2 className="header font-GoodTimes text-center text-white mb-8 lg:mb-12 xl:mb-16 2xl:mb-20 3xl:mb-24 text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl 3xl:text-7xl">
            Journey to the Moon
          </h2>

          {/* Desktop Timeline */}
          <div className="hidden xl:block w-full">
            <div className="relative h-[500px] w-full">{/* Increased height from h-96 to h-[500px] */}

              {/* SVG for a smooth x^4 curve with steady start and steep finish */}
              <svg className="absolute inset-0 w-full h-full z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="timelineGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="50%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#06B6D4" />
                  </linearGradient>
                </defs>
                <path
                  d={(() => {
                    // Generate path using y = x^4 for steady start, steep finish
                    let pathData = '';
                    for (let i = 0; i <= 100; i++) {
                      const normalizedX = i / 100; // 0 to 1
                      const xPercent = normalizedX * 90 + 5; // 5% to 95%
                      
                      // Single smooth function: x^4 for steady start, steep finish
                      const funcY = Math.pow(normalizedX, 4); // x^4 curve
                      
                      // Convert to percentage (invert y-axis) - moon reaches title level
                      const yPercent = 75 - funcY * 75; // 75% to 0% (moon at title level)
                      
                      if (i === 0) {
                        pathData += `M ${xPercent} ${yPercent}`;
                      } else {
                        pathData += ` L ${xPercent} ${yPercent}`;
                      }
                    }
                    return pathData;
                  })()}
                  stroke="url(#timelineGradient)"
                  strokeWidth="3"
                  fill="none"
                  className="drop-shadow-lg"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              
              {/* Timeline events positioned along the smooth x^4 curve */}
              <div className="absolute inset-0">
                {timelineEvents.map((event, index) => {
                  // Smooth x^4 curve: steady start, steep finish to the moon
                  const normalizedX = index / (timelineEvents.length - 1); // 0 to 1
                  const xPercent = normalizedX * 90 + 5; // 5% to 95%
                  
                  // Single smooth function: x^4 for steady start, steep finish
                  const funcY = Math.pow(normalizedX, 4); // x^4 curve
                  
                  // Convert to percentage (invert y-axis) - moon reaches title level
                  const yPercent = 75 - funcY * 75; // 75% to 0% (moon at title level)
                  
                  const isLastEvent = index === timelineEvents.length - 1;
                  const isCurrentEvent = index === 7; // Q2 2025 - Launchpad Launched (we are here)
                  
                  return (
                    <div
                      key={index}
                      className={`absolute cursor-pointer transition-all duration-300 ${
                        selectedEvent === index ? 'scale-110 z-20' : 'hover:scale-105 z-10'
                      }`}
                      style={{
                        left: `${xPercent}%`,
                        top: `${yPercent}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                      onClick={() => setSelectedEvent(index)}
                    >
                      {/* Event dot with icon or moon for last event */}
                      {isLastEvent ? (
                        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 border-4 border-gray-100 shadow-2xl shadow-blue-400/50 flex items-center justify-center z-30 overflow-hidden">
                          {/* Moon surface gradient overlay */}
                          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400"></div>
                          
                          {/* Moon craters - more realistic sizes and positions */}
                          <div className="absolute top-2 left-3 w-3 h-3 rounded-full bg-gray-400 opacity-60 z-10"></div>
                          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-gray-500 opacity-50 z-10"></div>
                          <div className="absolute bottom-3 left-1/2 w-2.5 h-2.5 rounded-full bg-gray-400 opacity-55 z-10"></div>
                          <div className="absolute top-1/2 left-2 w-1.5 h-1.5 rounded-full bg-gray-500 opacity-45 z-10"></div>
                          <div className="absolute bottom-5 right-3 w-1 h-1 rounded-full bg-gray-500 opacity-40 z-10"></div>
                          
                          {/* Subtle shadow for 3D effect */}
                          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-transparent via-transparent to-gray-500 opacity-20 z-10"></div>
                          
                          {/* Central highlight for spherical effect */}
                          <div className="absolute top-3 left-3 w-4 h-4 rounded-full bg-gray-100 opacity-40 blur-sm z-10"></div>
                        </div>
                      ) : (
                        <div className={`relative w-16 h-16 rounded-full border-4 transition-all duration-300 flex items-center justify-center flex-shrink-0 z-30 ${
                          selectedEvent === index 
                            ? 'bg-gradient-to-br from-purple-600 to-blue-600 border-purple-400 shadow-lg shadow-purple-400/50' 
                            : isCurrentEvent
                            ? 'bg-gradient-to-br from-green-600 to-emerald-600 border-green-400 shadow-lg shadow-green-400/50'
                            : 'bg-slate-800 border-slate-500 hover:border-purple-300'
                        }`}>
                          {event.icon && (
                            <Image
                              src={event.icon}
                              alt={event.iconAlt || event.title}
                              width={32}
                              height={32}
                              className={`transition-all duration-300 ${
                                selectedEvent === index ? 'opacity-100 brightness-110' : 'opacity-70'
                              }`}
                            />
                          )}
                          {/* "We are here" indicator */}
                          {isCurrentEvent && (
                            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 z-40">
                              <div className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap shadow-lg">
                                We are here
                              </div>
                              <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-green-500 mx-auto"></div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Event info - Absolutely positioned and centered */}
                      <div 
                        className={`absolute text-center transition-all duration-300 ${
                          selectedEvent === index ? 'opacity-100' : 'opacity-60 hover:opacity-80'
                        }`}
                        style={{
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: '140px',
                          whiteSpace: 'normal',
                          top: 'calc(100% + 16px)' // All text below the events
                        }}
                      >
                        {isLastEvent ? (
                          <>
                            <div className="text-gray-300 text-sm font-bold font-GoodTimes">
                              THE MOON
                            </div>
                            <div className="text-white text-xs mt-1">
                              Settlement Complete
                            </div>
                            <div className="text-purple-300 text-xs">
                              2030
                            </div>
                          </>
                        ) : (
                          <>
                            <div className={`text-sm font-bold ${isCurrentEvent ? 'text-green-300' : 'text-purple-300'}`}>
                              {event.date}
                            </div>
                            <div className="text-white text-xs mt-1 leading-tight min-h-[2.5rem] flex items-center justify-center">
                              <span className="break-words hyphens-auto">
                                {event.title}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Selected event details */}
            <div className="mt-12 bg-black/30 backdrop-blur-xl rounded-2xl p-8 border border-white/10 h-64 flex flex-col">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                  {timelineEvents[selectedEvent].icon && (
                    <Image
                      src={timelineEvents[selectedEvent].icon}
                      alt={timelineEvents[selectedEvent].iconAlt || timelineEvents[selectedEvent].title}
                      width={32}
                      height={32}
                      className="opacity-90"
                    />
                  )}
                </div>
                <div className="text-purple-300 text-lg font-bold">
                  {timelineEvents[selectedEvent].date}
                </div>
              </div>
              <h3 className="text-white text-2xl font-GoodTimes mb-4">
                {timelineEvents[selectedEvent].title}
              </h3>
              <p className="text-gray-300 leading-relaxed text-lg flex-1 overflow-hidden">
                {timelineEvents[selectedEvent].description}
              </p>
            </div>
          </div>

          {/* Mobile Timeline - Horizontal Scroll */}
          <div className="xl:hidden w-full">
            <div
              ref={scrollContainerRef}
              className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ userSelect: 'none' }}
            >
              {timelineEvents.map((event, index) => (
                <div
                  key={index}
                  className="flex-shrink-0 w-72 sm:w-80 md:w-96 bg-black/30 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
                  onClick={() => setSelectedEvent(index)}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                      {event.icon && (
                        <Image
                          src={event.icon}
                          alt={event.iconAlt || event.title}
                          width={24}
                          height={24}
                          className="opacity-90"
                        />
                      )}
                    </div>
                    <div className="text-purple-300 text-lg font-bold">
                      {event.date}
                    </div>
                  </div>
                  <h3 className="text-white text-xl font-GoodTimes mb-4 leading-tight">
                    {event.title}
                  </h3>
                  <p className="text-gray-300 leading-relaxed">
                    {event.description}
                  </p>
                </div>
              ))}
            </div>
            
            {/* Scroll indicator */}
            <div className="flex justify-center mt-6">
              <div className="flex gap-3">
                {timelineEvents.map((_, index) => (
                  <button
                    key={index}
                    className={`h-3 rounded-full transition-all duration-300 ${
                      index === selectedEvent 
                        ? 'bg-purple-400 w-8' 
                        : 'bg-gray-600 hover:bg-gray-500 w-3'
                    }`}
                    onClick={() => scrollToEvent(index)}
                    aria-label={`Go to timeline event ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>


    </section>
  )
}
