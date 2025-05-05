import { TestOGImageGenerator } from '@/components/onboarding/CitizenOpenGraphImageGenerator'
import { useState } from 'react'

export default function TestOGImagePage() {
  const [username, setUsername] = useState('Alison Mattos')
  const [ipfsUrl, setIpfsUrl] = useState('ipfs://QmWPm5Yx6XjvRk1H8orUBh3HtMFJ7DvDMU9cayyyBHeSxD')

  return (
    <div className="z-50 min-h-screen p-8 fixed top-0 left-0 w-full h-full bg-black overflow-scroll">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">OG image preview</h1>
        
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="relative block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                placeholder="Enter username"
              />
            </div>
            
            <div>
              <label htmlFor="ipfsUrl" className="block text-sm font-medium text-gray-700 mb-1">
                IPFS Image URL
              </label>
              <input
                type="text"
                id="ipfsUrl"
                value={ipfsUrl}
                onChange={(e) => setIpfsUrl(e.target.value)}
                className="text-black w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter IPFS URL (ipfs://...)"
              />
            </div>
          </div>
        </div>

        <TestOGImageGenerator 
          username={username}
          ipfsImageUrl={ipfsUrl}
        />
      </div>
    </div>
  )
} 