import Image from 'next/image'
import { useUserDiscordRoles } from '@/lib/discord/useUserDiscordRoles'

interface RoleBasedStarProps {
  userAddress?: string
  size?: number
  className?: string
}

export default function RoleBasedStar({ 
  userAddress, 
  size = 40, 
  className = '' 
}: RoleBasedStarProps) {
  const { highestRoleColor, highestRoleName, isLoading, roles, error } = useUserDiscordRoles(userAddress)

  // Create gradient background based on role color
  const getGradientStyle = (colorClass: string) => {
    // Map Tailwind text colors to CSS gradient colors
    const colorMap: Record<string, string[]> = {
      // Core leadership roles
      'text-yellow-500': ['#eab308', '#f59e0b'],     // Astronaut (Gold)
      'text-rose-700': ['#be185d', '#e11d48'],       // Executive (Deep Rose)
      
      // Governance roles  
      'text-emerald-400': ['#34d399', '#10b981'],    // Senator (Emerald)
      'text-purple-500': ['#a855f7', '#8b5cf6'],     // Project Lead (Purple)
      
      // Project and community roles
      'text-sky-500': ['#0ea5e9', '#06b6d4'],        // Project Contributor (Sky Blue)
      
      // Voting and citizenship
      'text-blue-600': ['#2563eb', '#1d4ed8'],       // Voter (Blue)
      'text-indigo-500': ['#6366f1', '#5b21b6'],     // Citizen (Indigo)
      
      // Token holder roles
      'text-blue-700': ['#1d4ed8', '#2563eb'],       // $MOONEY Whale
      'text-rose-500': ['#ef4444', '#f87171'],       // $MOONEY Millionaire
      'text-orange-700': ['#c2410c', '#ea580c'],     // $MOONEY Shark
      'text-lime-500': ['#84cc16', '#65a30d'],       // $MOONEY HODLER
      
      // Other community roles
      'text-zinc-500': ['#71717a', '#6b7280'],       // Ticket To Space Holder
      'text-blue-500': ['#3b82f6', '#2563eb'],       // Earthlings
      'text-indigo-600': ['#4f46e5', '#5b21b6'],     // MoonDAOcrew
      'text-rose-600': ['#dc2626', '#e11d48'],       // CN Member
      'text-emerald-500': ['#10b981', '#059669'],    // MoonDAO World
      'text-slate-400': ['#94a3b8', '#64748b'],      // Default/Member
    }

    const colors = colorMap[colorClass] || colorMap['text-slate-400']
    return {
      background: `linear-gradient(45deg, ${colors[0]}, ${colors[1]})`
    }
  }

  if (isLoading) {
    return (
      <div 
        className={`rounded-full flex items-center justify-center animate-pulse ${className}`}
        style={{ 
          width: size, 
          height: size,
          background: 'linear-gradient(45deg, #64748b, #94a3b8)'
        }}
      >
        <div className="w-4 h-4 rounded-full bg-white/30 animate-spin" />
      </div>
    )
  }

  return (
    <div 
      className={`rounded-full p-2 flex items-center justify-center ${className}`}
      style={getGradientStyle(highestRoleColor)}
      title={`Discord Role: ${highestRoleName}`}
    >
      <Image
        src="/../.././assets/icon-star.svg"
        alt={`${highestRoleName} role badge`}
        width={size * 0.6}
        height={size * 0.6}
        className="brightness-0 invert" // Makes the star white
      />
    </div>
  )
}
