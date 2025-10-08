import { useState, useEffect, useContext } from 'react'
import { prepareContractCall } from 'thirdweb'
import { useSendTransaction } from 'thirdweb/react'
import CitizenContext from '@/lib/citizen/citizen-context'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { CITIZEN_TABLE_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import CitizenTableABI from 'const/abis/CitizenTable.json'

export interface DashboardPreferences {
  showQuests: boolean
  showProjects: boolean
  showJobs: boolean
  showLaunchpad: boolean
  showEvents: boolean
  showGlobalMap: boolean
}

const DEFAULT_PREFERENCES: DashboardPreferences = {
  showQuests: true,
  showProjects: true,
  showJobs: true,
  showLaunchpad: true,
  showEvents: true,
  showGlobalMap: true,
}

export function useDashboardPreferences() {
  const [preferences, setPreferences] = useState<DashboardPreferences>(DEFAULT_PREFERENCES)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  const { citizen } = useContext(CitizenContext)
  const { mutate: sendTransaction } = useSendTransaction()
  
  const citizenTableContract = useContract({
    address: CITIZEN_TABLE_ADDRESSES[DEFAULT_CHAIN_V5.id],
    abi: CitizenTableABI,
    chain: DEFAULT_CHAIN_V5,
  })

  // Load preferences on mount
  useEffect(() => {
    loadPreferences()
  }, [citizen])

  const loadPreferences = async () => {
    setIsLoading(true)
    
    try {
      // If user has citizen NFT, try to load from on-chain data
      if (citizen?.metadata?.dashPrefs) {
        try {
          const onChainPrefs = JSON.parse(citizen.metadata.dashPrefs)
          setPreferences({ ...DEFAULT_PREFERENCES, ...onChainPrefs })
          setIsLoading(false)
          return
        } catch (error) {
          console.error('Failed to parse on-chain dashboard preferences:', error)
        }
      }
      
      // Fallback to localStorage
      const stored = localStorage.getItem('dashboardPreferences')
      if (stored) {
        try {
          setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(stored) })
        } catch (error) {
          console.error('Failed to parse localStorage dashboard preferences:', error)
        }
      }
    } catch (error) {
      console.error('Error loading preferences:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const updatePreferences = async (newPreferences: Partial<DashboardPreferences>) => {
    const updated = { ...preferences, ...newPreferences }
    setPreferences(updated)
    
    // Always save to localStorage as immediate backup
    localStorage.setItem('dashboardPreferences', JSON.stringify(updated))
    
    // If user has citizen NFT, save to blockchain
    if (citizen?.id && citizenTableContract) {
      try {
        setIsSaving(true)
        
        const transaction = prepareContractCall({
          contract: citizenTableContract,
          method: 'updateTableDynamic' as string,
          params: [
            citizen.id,
            ["dashPrefs"],
            [JSON.stringify(updated)]
          ]
        })

        sendTransaction(transaction, {
          onSuccess: () => {
            console.log('Dashboard preferences saved to blockchain')
          },
          onError: (error) => {
            console.error('Failed to save preferences to blockchain:', error)
          },
          onSettled: () => {
            setIsSaving(false)
          }
        })
      } catch (error) {
        console.error('Error preparing blockchain transaction:', error)
        setIsSaving(false)
      }
    }
  }

  const resetPreferences = async () => {
    setPreferences(DEFAULT_PREFERENCES)
    localStorage.setItem('dashboardPreferences', JSON.stringify(DEFAULT_PREFERENCES))
    
    // If user has citizen NFT, reset on blockchain
    if (citizen?.id && citizenTableContract) {
      try {
        setIsSaving(true)
        
        const transaction = prepareContractCall({
          contract: citizenTableContract,
          method: 'updateTableDynamic' as string,
          params: [
            citizen.id,
            ["dashPrefs"],
            [JSON.stringify(DEFAULT_PREFERENCES)]
          ]
        })

        sendTransaction(transaction, {
          onSuccess: () => {
            console.log('Dashboard preferences reset on blockchain')
          },
          onError: (error) => {
            console.error('Failed to reset preferences on blockchain:', error)
          },
          onSettled: () => {
            setIsSaving(false)
          }
        })
      } catch (error) {
        console.error('Error preparing reset transaction:', error)
        setIsSaving(false)
      }
    }
  }

  return {
    preferences,
    updatePreferences,
    resetPreferences,
    isLoading,
    isSaving,
  }
}
