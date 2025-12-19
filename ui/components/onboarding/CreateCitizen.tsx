import { XMarkIcon } from '@heroicons/react/24/outline'
import { Options } from '@layerzerolabs/lz-v2-utilities'
import { waitForMessageReceived } from '@layerzerolabs/scan-client'
import { getAccessToken } from '@privy-io/react-auth'
import { Widget } from '@typeform/embed-react'
import {
  CITIZEN_ADDRESSES,
  CITIZEN_CROSS_CHAIN_MINT_ADDRESSES,
  LAYERZERO_SOURCE_CHAIN_TO_DESTINATION_EID,
  CK_NETWORK_SIGNUP_FORM_ID,
  CK_NETWORK_SIGNUP_TAG_ID,
  DEPLOYED_ORIGIN,
  DEFAULT_CHAIN_V5,
  DISCORD_CITIZEN_ROLE_ID,
} from 'const/config'
import { ethers } from 'ethers'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  prepareContractCall,
  readContract,
  sendAndConfirmTransaction,
  waitForReceipt,
} from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import useWindowSize from '../../lib/team/use-window-size'
import { useOnrampAutoTransaction } from '@/lib/coinbase/useOnrampAutoTransaction'
import { useOnrampInitialStage } from '@/lib/coinbase/useOnrampInitialStage'
import useSubscribe from '@/lib/convert-kit/useSubscribe'
import useTag from '@/lib/convert-kit/useTag'
import sendDiscordMessage from '@/lib/discord/sendDiscordMessage'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import { arbitrum, base, ethereum, sepolia, arbitrumSepolia } from '@/lib/rpc/chains'
import { useGasPrice } from '@/lib/rpc/useGasPrice'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import cleanData from '@/lib/tableland/cleanData'
import { getChainSlug, v4SlugToV5Chain } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import waitForERC721 from '@/lib/thirdweb/waitForERC721'
import { CitizenData, formatCitizenShortFormData } from '@/lib/typeform/citizenFormData'
import waitForResponse from '@/lib/typeform/waitForResponse'
import {
  renameFile,
  fileToBase64,
  base64ToFile,
  isSerializedFile,
  SerializedFile,
} from '@/lib/utils/files'
import { useFormCache } from '@/lib/utils/hooks/useFormCache'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
import CitizenABI from '../../const/abis/Citizen.json'
import CrossChainMinterABI from '../../const/abis/CrossChainMinter.json'
import { CBOnrampModal } from '../coinbase/CBOnrampModal'
import Container from '../layout/Container'
import ContentLayout from '../layout/ContentLayout'
import { ExpandedFooter } from '../layout/ExpandedFooter'
import { Steps } from '../layout/Steps'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import { ImageGenerator } from './CitizenImageGenerator'
import { StageContainer } from './StageContainer'

export default function CreateCitizen({ selectedChain, setSelectedTier }: any) {
  const router = useRouter()
  const { setSelectedChain } = useContext(ChainContextV5)
  const { selectedWallet, setSelectedWallet } = useContext(PrivyWalletContext)

  const defaultChainSlug = getChainSlug(DEFAULT_CHAIN_V5)
  const selectedChainSlug = getChainSlug(selectedChain)
  const isTestnet = process.env.NEXT_PUBLIC_CHAIN != 'mainnet'
  const chains = isTestnet ? [sepolia, arbitrumSepolia] : [arbitrum, base, ethereum]
  const destinationChain = isTestnet ? sepolia : arbitrum
  const account = useActiveAccount()
  // In test mode (Cypress), use mock address from window if available
  const mockAddress = typeof window !== 'undefined' && (window as any).__CYPRESS_MOCK_ADDRESS__
  const address = account?.address || mockAddress

  // Form state caching - needs to be defined before useOnrampInitialStage
  const { cache, setCache, clearCache, restoreCache } = useFormCache<{
    stage: number
    citizenData: CitizenData
    citizenImage: SerializedFile | null
    inputImage: SerializedFile | null
    agreedToCondition: boolean
    selectedChainSlug: string
  }>('CreateCitizenCacheV1', address)

  const [stage, setStage] = useState<number>(0)
  const [lastStage, setLastStage] = useState<number>(0)

  const restoredStage = useOnrampInitialStage(address, restoreCache, 0, 2)
  useEffect(() => {
    if (restoredStage !== 0) {
      setStage(restoredStage)
    }
  }, [restoredStage])

  //Input Image for Image Generator
  const [inputImage, setInputImage] = useState<File>()
  //Final Image for Citizen Profile
  const [citizenImage, setCitizenImage] = useState<any>()

  const [citizenData, setCitizenData] = useState<CitizenData>({
    name: '',
    email: '',
    description: '',
    location: '',
    view: '',
    discord: '',
    website: '',
    twitter: '',
    formResponseId: '',
  })
  const [agreedToCondition, setAgreedToCondition] = useState<boolean>(false)

  const [isLoadingMint, setIsLoadingMint] = useState<boolean>(false)
  const [isImageGenerating, setIsImageGenerating] = useState(false)
  const [freeMint, setFreeMint] = useState(false)
  const [onrampModalOpen, setOnrampModalOpen] = useState(false)
  const [requiredEthAmount, setRequiredEthAmount] = useState(0)
  const [estimatedGas, setEstimatedGas] = useState<bigint>(BigInt(0))
  const [isLoadingGasEstimate, setIsLoadingGasEstimate] = useState(false)

  const { effectiveGasPrice } = useGasPrice(selectedChain)

  const citizenContract = useContract({
    address: CITIZEN_ADDRESSES[defaultChainSlug],
    abi: CitizenABI,
    chain: DEFAULT_CHAIN_V5,
  })
  const crossChainMintContract = useContract({
    address: CITIZEN_CROSS_CHAIN_MINT_ADDRESSES[selectedChainSlug],
    abi: CrossChainMinterABI,
    chain: selectedChain,
  })

  // Redirect handling and auto-transaction
  const calculateCost = useCallback(
    async (formattedCost: string) => {
      const LAYER_ZERO_TRANSFER_COST = BigInt('3000000000000000')

      // Use effectiveGasPrice if available, otherwise fallback to 0
      const gasCostWei = effectiveGasPrice ? estimatedGas * effectiveGasPrice : BigInt(0)
      const gasCostEth = Number(gasCostWei) / 1e18

      let totalCost = Number(formattedCost) + gasCostEth
      if (selectedChainSlug !== defaultChainSlug) {
        totalCost += Number(LAYER_ZERO_TRANSFER_COST) / 1e18
      }
      return totalCost
    },
    [selectedChainSlug, defaultChainSlug, estimatedGas, effectiveGasPrice]
  )

  const handleFormRestore = useCallback(
    (restored: any) => {
      setStage(restored.stage || 2)
      setCitizenData(restored.formData.citizenData)
      if (restored.formData.citizenImage && isSerializedFile(restored.formData.citizenImage)) {
        setCitizenImage(base64ToFile(restored.formData.citizenImage))
      }
      if (restored.formData.inputImage && isSerializedFile(restored.formData.inputImage)) {
        setInputImage(base64ToFile(restored.formData.inputImage))
      }
      setAgreedToCondition(restored.formData.agreedToCondition)
      if (restored.formData.selectedChainSlug) {
        const chain = v4SlugToV5Chain(restored.formData.selectedChainSlug)
        if (chain) {
          setSelectedChain(chain)
        }
      }
    },
    [setSelectedChain]
  )

  const { isMobile } = useWindowSize()

  const subscribeToNetworkSignup = useSubscribe(CK_NETWORK_SIGNUP_FORM_ID)
  const tagToNetworkSignup = useTag(CK_NETWORK_SIGNUP_TAG_ID)

  const { nativeBalance, refetch: refetchNativeBalance } = useNativeBalance()

  const callMint = useCallback(async () => {
    const imageToUse = citizenImage || inputImage
    if (!imageToUse) return toast.error('Please upload an image and complete the previous steps.')

    // In test mode, address may come from mock, so only check address
    if (!address) {
      return toast.error('Please connect your wallet to continue.')
    }

    // Check if gas estimation is ready
    if (
      !estimatedGas ||
      estimatedGas === BigInt(0) ||
      !effectiveGasPrice ||
      effectiveGasPrice === BigInt(0)
    ) {
      setIsLoadingMint(false)
      return toast.error('Gas estimation is still loading. Please wait a moment and try again.')
    }

    // Set loading state immediately to prevent multiple clicks
    setIsLoadingMint(true)

    try {
      const cost: any = await readContract({
        contract: citizenContract,
        method: 'getRenewalPrice' as string,
        params: [address, 365 * 24 * 60 * 60],
      })
      const LAYER_ZERO_TRANSFER_COST = BigInt('3000000000000000')

      const formattedCost = ethers.utils.formatEther(cost.toString()).toString()

      const gasCostWei = estimatedGas * effectiveGasPrice
      const gasCostEth = Number(gasCostWei) / 1e18

      let totalCost = Number(formattedCost) + gasCostEth
      if (selectedChainSlug !== defaultChainSlug) {
        totalCost += Number(LAYER_ZERO_TRANSFER_COST) / 1e18
      }

      if (!freeMint && +nativeBalance < totalCost) {
        // Calculate the amount needed (shortfall already includes gas cost)
        const shortfall = totalCost - +nativeBalance

        // Add a small buffer (5%) to ensure transaction succeeds after onramp
        const requiredAmount = shortfall * 1.05

        // Open the onramp modal with the required amount
        setRequiredEthAmount(requiredAmount)
        setOnrampModalOpen(true)
        setIsLoadingMint(false)
        return
      }

      const renamedCitizenImage = renameFile(imageToUse, `${citizenData.name} Citizen Image`)

      const { cid: newImageIpfsHash } = await pinBlobOrFile(renamedCitizenImage)

      if (!newImageIpfsHash) {
        setIsLoadingMint(false)
        return toast.error('Error pinning image to IPFS.')
      }

      //mint
      let receipt: any
      if (freeMint) {
        const res = await fetch(`/api/mission/freeMint`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json', // Important: Specify the content type
          },
          body: JSON.stringify({
            address: address,
            name: citizenData.name,
            image: `ipfs://${newImageIpfsHash}`,
            privacy: 'public',
            formId: citizenData.formResponseId,
          }),
        })
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'Mint failed' }))
          console.error(errorData)
          setIsLoadingMint(false)
          return toast.error(errorData.error || 'Failed to mint citizen')
        }
        receipt = await res.json()
      } else if (selectedChainSlug !== defaultChainSlug) {
        if (!account) {
          setIsLoadingMint(false)
          return toast.error('Please connect your wallet to continue.')
        }

        const GAS_LIMIT = 300000 // Gas limit for the executor
        const MSG_VALUE = cost // msg.value for the lzReceive() function on destination in wei

        const _options = Options.newOptions().addExecutorLzReceiveOption(GAS_LIMIT, MSG_VALUE)

        const transaction = await prepareContractCall({
          contract: crossChainMintContract,
          method: 'crossChainMint' as string,
          params: [
            LAYERZERO_SOURCE_CHAIN_TO_DESTINATION_EID[selectedChainSlug].toString(),
            _options.toHex(),
            address,
            citizenData.name,
            '',
            `ipfs://${newImageIpfsHash}`,
            '',
            '',
            '',
            '',
            'public',
            citizenData.formResponseId,
          ],
          value: MSG_VALUE + LAYER_ZERO_TRANSFER_COST,
        })
        const originReceipt: any = await sendAndConfirmTransaction({
          transaction,
          account,
        })
        // Get a list of messages by transaction hash
        const message = await waitForMessageReceived(
          isTestnet ? 19999 : 1, // 19999 resolves to testnet, 1 to mainnet, see https://cdn.jsdelivr.net/npm/@layerzerolabs/scan-client@0.0.8/dist/client.mjs
          originReceipt.transactionHash
        )
        receipt = await waitForReceipt({
          client: client,
          chain: destinationChain,
          transactionHash: message.dstTxHash as `0x${string}`,
        })
      } else {
        if (!account) {
          setIsLoadingMint(false)
          return toast.error('Please connect your wallet to continue.')
        }

        const transaction = await prepareContractCall({
          contract: citizenContract,
          method: 'mintTo' as string,
          params: [
            address,
            citizenData.name,
            '',
            `ipfs://${newImageIpfsHash}`,
            '',
            '',
            '',
            '',
            'public',
            citizenData.formResponseId,
          ],
          value: cost,
        })

        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      }

      // Verify receipt exists before processing
      if (!receipt || !receipt.logs) {
        setIsLoadingMint(false)
        return toast.error('Transaction failed. Please try again.')
      }

      // Define the event signature for the Transfer event
      const transferEventSignature = ethers.utils.id('Transfer(address,address,uint256)')
      // Find the log that matches the Transfer event signature
      const transferLog = receipt.logs.find((log: any) => log.topics[0] === transferEventSignature)

      if (!transferLog) {
        setIsLoadingMint(false)
        return toast.error('Could not find mint event in transaction.')
      }

      const mintedTokenId = ethers.BigNumber.from(transferLog.topics[3]).toString()

      if (mintedTokenId) {
        await tagToNetworkSignup(citizenData.email)

        const citizenNFT = await waitForERC721(citizenContract, +mintedTokenId)
        const citizenName = citizenData.name
        const citizenPrettyLink = generatePrettyLinkWithId(citizenName, mintedTokenId)

        // Call the referral API to record the referral
        try {
          const accessToken = await getAccessToken()

          // Check if there's a referral parameter in the URL
          const urlParams = new URLSearchParams(window.location.search)
          const referredBy = urlParams.get('referredBy')

          if (referredBy && referredBy !== address) {
            // Call the referral API
            const referralResponse = await fetch('/api/xp/citizen-referred', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                referrerAddress: referredBy,
                accessToken: accessToken,
              }),
            })

            if (referralResponse.ok) {
              const result = await referralResponse.json()
              toast.success('Referral recorded successfully!')
            } else {
              const error = await referralResponse.json()
              console.error('Failed to record referral:', error)
            }
          }
        } catch (error) {
          console.error('Error recording referral:', error)
        }

        setTimeout(async () => {
          await sendDiscordMessage(
            'networkNotifications',
            `## [**${citizenName}**](${DEPLOYED_ORIGIN}/citizen/${citizenPrettyLink}?_timestamp=123456789) has just become a <@&${DISCORD_CITIZEN_ROLE_ID}> of the Space Acceleration Network!`
          )

          // Clear localStorage cache for citizen data
          const cacheKey = `moondao_citizen_${address?.toLowerCase()}_${DEFAULT_CHAIN_V5.id}`
          if (typeof window !== 'undefined') {
            localStorage.removeItem(cacheKey)
          }
          // Clear form cache
          clearCache()

          // Redirect to home page
          router.push('/')
          setIsLoadingMint(false)
        }, 10000)
      }
    } catch (err) {
      console.error(err)
      setIsLoadingMint(false)
    }
  }, [
    citizenImage,
    inputImage,
    account,
    address,
    citizenContract,
    selectedChainSlug,
    defaultChainSlug,
    freeMint,
    nativeBalance,
    citizenData,
    crossChainMintContract,
    isTestnet,
    destinationChain,
    tagToNetworkSignup,
    clearCache,
    router,
    estimatedGas,
    effectiveGasPrice,
  ])

  const checkBalanceSufficient = useCallback(async () => {
    try {
      const cost: any = await readContract({
        contract: citizenContract,
        method: 'getRenewalPrice' as string,
        params: [address, 365 * 24 * 60 * 60],
      })
      const formattedCost = ethers.utils.formatEther(cost.toString()).toString()
      const totalCost = await calculateCost(formattedCost)
      return +nativeBalance >= totalCost
    } catch (error) {
      console.error('Error checking balance:', error)
      return false
    }
  }, [address, citizenContract, nativeBalance, calculateCost])

  const estimateMintGas = useCallback(async () => {
    if (!account || !address || !citizenData.name) return

    setIsLoadingGasEstimate(true)

    try {
      const cost: any = await readContract({
        contract: citizenContract,
        method: 'getRenewalPrice' as string,
        params: [address, 365 * 24 * 60 * 60],
      })

      const LAYER_ZERO_TRANSFER_COST = BigInt('3000000000000000')
      const isCrossChain = selectedChainSlug !== defaultChainSlug

      let gasEstimate: bigint = BigInt(0)

      if (isCrossChain) {
        const GAS_LIMIT = 300000
        const MSG_VALUE = cost

        const _options = Options.newOptions().addExecutorLzReceiveOption(GAS_LIMIT, MSG_VALUE)

        const transaction = await prepareContractCall({
          contract: crossChainMintContract,
          method: 'crossChainMint' as string,
          params: [
            LAYERZERO_SOURCE_CHAIN_TO_DESTINATION_EID[selectedChainSlug].toString(),
            _options.toHex(),
            address,
            citizenData.name,
            '',
            'ipfs://placeholder',
            '',
            '',
            '',
            '',
            'public',
            citizenData.formResponseId || '0000',
          ],
          value: MSG_VALUE + LAYER_ZERO_TRANSFER_COST,
        })

        try {
          const txData =
            typeof transaction.data === 'function' ? await transaction.data() : transaction.data

          const estimateResponse = await fetch('/api/rpc/estimate-gas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chainId: selectedChain.id,
              from: address,
              to: CITIZEN_CROSS_CHAIN_MINT_ADDRESSES[selectedChainSlug],
              data: txData,
              value: `0x${(MSG_VALUE + LAYER_ZERO_TRANSFER_COST).toString(16)}`,
            }),
          })

          if (!estimateResponse.ok) {
            throw new Error(`Gas estimation API returned ${estimateResponse.status}`)
          }

          const estimateData = await estimateResponse.json()

          if (estimateData.error) {
            throw new Error(estimateData.error)
          }

          gasEstimate = BigInt(estimateData.gasEstimate)
        } catch (estimationError: any) {
          console.error('Gas estimation error:', estimationError)
          gasEstimate = BigInt(300000)
        }
      } else {
        const transaction = await prepareContractCall({
          contract: citizenContract,
          method: 'mintTo' as string,
          params: [
            address,
            citizenData.name,
            '',
            'ipfs://placeholder',
            '',
            '',
            '',
            '',
            'public',
            citizenData.formResponseId || '0000',
          ],
          value: cost,
        })

        try {
          const txData =
            typeof transaction.data === 'function' ? await transaction.data() : transaction.data

          const estimateResponse = await fetch('/api/rpc/estimate-gas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chainId: selectedChain.id,
              from: address,
              to: CITIZEN_ADDRESSES[defaultChainSlug],
              data: txData,
              value: `0x${cost.toString(16)}`,
            }),
          })

          if (!estimateResponse.ok) {
            throw new Error(`Gas estimation API returned ${estimateResponse.status}`)
          }

          const estimateData = await estimateResponse.json()

          if (estimateData.error) {
            throw new Error(estimateData.error)
          }

          gasEstimate = BigInt(estimateData.gasEstimate)
        } catch (estimationError: any) {
          console.error('Gas estimation error:', estimationError)
          gasEstimate = BigInt(200000)
        }
      }

      const bufferPercent = isCrossChain ? 180 : 130
      const gasWithBuffer = (gasEstimate * BigInt(bufferPercent)) / BigInt(100)
      setEstimatedGas(gasWithBuffer)
      setIsLoadingGasEstimate(false)
    } catch (error) {
      console.error('Error estimating gas:', error instanceof Error ? error.message : error)
      const isCrossChain = selectedChainSlug !== defaultChainSlug
      setEstimatedGas(isCrossChain ? BigInt(300000) : BigInt(200000))
      setIsLoadingGasEstimate(false)
    }
  }, [
    account,
    address,
    citizenData.name,
    citizenData.formResponseId,
    citizenContract,
    crossChainMintContract,
    selectedChainSlug,
    defaultChainSlug,
    selectedChain,
  ])

  useEffect(() => {
    if (stage === 2 && address && citizenData.name) {
      estimateMintGas()
    }
  }, [stage, address, citizenData.name, selectedChainSlug, estimateMintGas])

  useOnrampAutoTransaction({
    address,
    context: 'citizen',
    expectedChainSlug: selectedChainSlug,
    refetchNativeBalance,
    onTransaction: callMint,
    onFormRestore: handleFormRestore,
    checkBalanceSufficient,
    shouldProceed: (restored) => restored.formData.agreedToCondition,
    restoreCache,
    getChainSlugFromCache: (restored) => restored?.formData?.selectedChainSlug,
    setStage,
    setSelectedWallet,
    waitForReady: () => {
      const ready = !isLoadingGasEstimate && estimatedGas > BigInt(0) && effectiveGasPrice !== undefined && effectiveGasPrice > BigInt(0)
      if (!ready) {
        console.log('[WaitForReady]', {
          isLoadingGasEstimate,
          estimatedGas: estimatedGas.toString(),
          effectiveGasPrice: effectiveGasPrice?.toString(),
        })
      }
      return ready
    },
  })

  const submitTypeform = useCallback(
    async (formResponse: any) => {
      const { formId, responseId } = formResponse

      await waitForResponse(formId, responseId)

      const accessToken = await getAccessToken()

      const responseRes = await fetch(`/api/typeform/response`, {
        method: 'POST',
        body: JSON.stringify({
          accessToken: accessToken,
          responseId: responseId,
          formId: formId,
        }),
      })

      const data = await responseRes.json()

      //fomat answers into an object
      const citizenShortFormData = formatCitizenShortFormData(data.answers, responseId)

      //subscribe to newsletter
      const subRes = await subscribeToNetworkSignup(citizenShortFormData.email)
      if (subRes.ok) {
        console.log('Subscribed to network signup')
      }

      //escape single quotes and remove emojis
      const cleanedCitizenShortFormData = cleanData(citizenShortFormData)

      setCitizenData(cleanedCitizenShortFormData as any)

      setStage(2)
    },
    [subscribeToNetworkSignup]
  )

  // When the generated image arrives, stop showing the loading animation in stage 2
  useEffect(() => {
    if (isImageGenerating && citizenImage) {
      setIsImageGenerating(false)
    }
  }, [citizenImage, isImageGenerating])

  // Cache form state before navigating to onramp
  useEffect(() => {
    if (stage >= 0 && address && (citizenData.name || citizenImage || inputImage)) {
      const serializeAndCache = async () => {
        const serializedCitizenImage = citizenImage ? await fileToBase64(citizenImage) : null
        const serializedInputImage = inputImage ? await fileToBase64(inputImage) : null
        setCache(
          {
            stage,
            citizenData,
            citizenImage: serializedCitizenImage,
            inputImage: serializedInputImage,
            agreedToCondition,
            selectedChainSlug,
          },
          stage
        )
      }
      serializeAndCache()
    }
  }, [
    stage,
    citizenData,
    citizenImage,
    inputImage,
    agreedToCondition,
    address,
    setCache,
    selectedChainSlug,
  ])

  useEffect(() => {
    if (stage > lastStage) {
      setLastStage(stage)
    }
  }, [stage, lastStage])

  useEffect(() => {
    if (!address) return

    const getTotalPaid = async () => {
      const res = await fetch(`/api/mission/freeMint?address=${address}`, {
        method: 'GET',
      })
      if (!res.ok) {
        const errorText = await res.text() // Or response.json()
        console.error(errorText)
      } else {
        const { data } = await res.json()
        if (data.eligible) {
          setFreeMint(true)
        }
      }
    }
    getTotalPaid()
  }, [address])

  return (
    <Container>
      <ContentLayout
        isProfile
        mode="compact"
        header="Join The Network"
        mainPadding
        headerSize="max(20px, 3vw)"
        preFooter={
          <>
            <ExpandedFooter
              callToActionImage="/assets/MoonDAO-Logo-White.svg"
              callToActionTitle="Join the Network"
              callToActionButtonText="Learn More"
              callToActionButtonLink="/join"
              hasCallToAction={true}
              darkBackground={true}
              isFullwidth={false}
            />
          </>
        }
        description=""
      >
        <div className="flex flex-row w-full">
          <div className="px-8 bg-black/20 backdrop-blur-sm border border-white/10 lg:p-8 rounded-[2vmax] md:m-5 mb-0 md:mb-0 w-full flex flex-col lg:max-w-[1000px]">
            <div className="flex p-2 pb-0 flex-row w-full justify-between max-w-[600px] items-start">
              <Steps
                className="mb-4 w-[300px] sm:w-[600px] lg:max-w-[900px] md:-ml-16 -ml-10"
                steps={['Design', 'Profile', 'Checkout']}
                currStep={stage}
                lastStep={lastStage}
                setStep={setStage}
              />
              <button
                onClick={() => setSelectedTier(null)}
                className="hover:scale-110 transition-transform"
              >
                <XMarkIcon width={50} height={50} className="text-white" />
              </button>
            </div>

            {/* Typeform form */}
            {stage === 0 && (
              <StageContainer
                className={`mb-10`}
                title="Design"
                description={
                  <>
                    <b>Create your unique and personalized AI passport photo.</b> The uploaded photo{' '}
                    <u>MUST</u> contain a face, but it can be a photo of yourself or an avatar that
                    represents you well. Image generation may take up to a minute, so please
                    continue to the next step to fill out your profile.
                  </>
                }
              >
                <ImageGenerator
                  image={citizenImage}
                  setImage={setCitizenImage}
                  inputImage={inputImage}
                  setInputImage={setInputImage}
                  nextStage={() => setStage(1)}
                  stage={stage}
                  generateInBG
                  onGenerationStateChange={setIsImageGenerating}
                />
                {process.env.NEXT_PUBLIC_ENV === 'dev' && (
                  <button
                    onClick={() => {
                      setCitizenData({
                        name: 'Test',
                        description: 'Testing',
                        email: 'test@test.com',
                        discord: '',
                        website: 'https://moondao.com',
                        twitter: '',
                        location: 'Earth',
                        view: 'public',
                        formResponseId: '0000',
                      })

                      const file = new File([''], 'test.png', {
                        type: 'image/png',
                      })

                      setCitizenImage(file)
                      setStage(2)
                    }}
                  >
                    Use Testing Data
                  </button>
                )}
              </StageContainer>
            )}
            {/* Upload & Create Image */}
            {stage === 1 && (
              <StageContainer
                title="Citizen Profile"
                description="Please complete your citizen profile."
              >
                <div className="w-full max-w-[900px] bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden relative">
                  <Widget
                    className="w-full"
                    id={process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_SHORT_FORM_ID as string}
                    onSubmit={submitTypeform}
                    height={700}
                  />
                </div>
              </StageContainer>
            )}
            {/* Pin Image and Metadata to IPFS, Mint NFT to Gnosis Safe */}
            {stage === 2 && (
              <StageContainer
                title="Mint Citizen"
                description="Please review your onchain profile before finalizing your registration"
              >
                {/* <p className="mt-6 w-[400px] font-[Lato] text-base xl:text-lg lg:text-left text-left text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
                  {`Make sure all your information is displayed correcly.`}
                </p>
                <p className="mt-6 w-[400px] font-[Lato] text-base xl:text-lg lg:text-left text-left text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
                  {`Welcome to the future of off-world coordination with MoonDAO.`}
                </p> */}
                <div className="flex flex-col items-center">
                  <div className="relative w-[600px] h-[600px] rounded-2xl border border-slate-600/30 bg-slate-900/40 overflow-hidden">
                    <Image
                      src={
                        citizenImage
                          ? URL.createObjectURL(citizenImage)
                          : inputImage
                          ? URL.createObjectURL(inputImage)
                          : '/assets/MoonDAO-Loading-Animation.svg'
                      }
                      alt="citizen-image"
                      width={600}
                      height={600}
                      className="rounded-2xl"
                    />
                    {isImageGenerating && !citizenImage && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <img
                          src="/assets/MoonDAO-Loading-Animation.svg"
                          alt="generating"
                          className="w-40 h-40 opacity-90"
                        />
                      </div>
                    )}
                    {!citizenImage && !inputImage && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-800/50 rounded-2xl">
                        <p className="text-white text-center px-4">
                          Please complete the previous steps to generate your citizen image
                        </p>
                      </div>
                    )}
                  </div>
                  {citizenImage && (
                    <div className="mt-4 text-center">
                      <p className="text-slate-300">Your personalized citizen passport photo</p>
                      <button
                        onClick={() => setStage(0)}
                        className="mt-2 text-sky-400 hover:text-sky-300 text-sm underline transition-colors"
                      >
                        Edit Image
                      </button>
                    </div>
                  )}
                  {!citizenImage && inputImage && (
                    <div className="mt-4 text-center">
                      <p className="text-slate-300 opacity-75">
                        {isImageGenerating
                          ? 'Image generation in progress...'
                          : 'Using uploaded image'}
                      </p>
                      <button
                        onClick={() => setStage(0)}
                        className="mt-2 text-sky-400 hover:text-sky-300 text-sm underline transition-colors"
                      >
                        Edit Image
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col w-full md:p-5 mt-10 max-w-[600px]">
                  <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                    <h3 className="font-GoodTimes text-xl mb-4 text-white">Citizen Overview</h3>
                    <div className="grid gap-4">
                      {isMobile ? (
                        Object.keys(citizenData)
                          .filter((v) => v != 'newsletterSub' && v != 'formResponseId')
                          .map((v, i) => {
                            return (
                              <div
                                className="flex flex-col p-4 bg-slate-800/50 rounded-lg border border-slate-600/30"
                                key={'citizenData' + i}
                              >
                                <p className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-1">
                                  {v}:
                                </p>
                                <p className="text-white">
                                  {/**@ts-expect-error */}
                                  {citizenData[v]!}
                                </p>
                              </div>
                            )
                          })
                      ) : (
                        <div className="space-y-3">
                          {Object.keys(citizenData)
                            .filter((v) => v != 'newsletterSub' && v != 'formResponseId')
                            .map((v, i) => {
                              return (
                                <div
                                  className="flex justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-600/30"
                                  key={'citizenData' + i}
                                >
                                  <span className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                                    {v}:
                                  </span>
                                  <span className="text-white max-w-xs text-right">
                                    {/**@ts-expect-error */}
                                    {citizenData[v]!}
                                  </span>
                                </div>
                              )
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col w-full md:p-5 mt-8 max-w-[600px]">
                  <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                    <h2 className="font-GoodTimes text-xl mb-6 text-white">
                      Important Information
                    </h2>
                    <div className="flex flex-col rounded-[20px] bg-slate-800/50 border border-slate-600/30 p-5 pb-10 md:p-5">
                      <h3 className="font-GoodTimes text-lg mb-3 text-white">Citizenship</h3>
                      <p className="text-slate-300 leading-relaxed">
                        Citizenship lasts for one year and can be renewed at any time. Any wallet
                        funds are self-custodied and are not dependent on registration.
                      </p>
                    </div>
                    <p className="mt-6 text-center text-slate-300 font-medium">
                      Welcome to the future of on-chain, off-world coordination with MoonDAO!
                    </p>
                  </div>
                </div>
                <div className="flex flex-row items-center mt-6 p-4 bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl">
                  <label
                    className="relative flex items-center p-3 rounded-full cursor-pointer"
                    htmlFor="link"
                  >
                    <input
                      checked={agreedToCondition}
                      onChange={(e) => setAgreedToCondition(e.target.checked)}
                      type="checkbox"
                      className="before:content[''] peer relative h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-slate-400 transition-all before:absolute before:top-2/4 before:left-2/4 before:block before:h-12 before:w-12 before:-translate-y-2/4 before:-translate-x-2/4 before:rounded-full before:bg-slate-500 before:opacity-0 before:transition-opacity checked:border-slate-300 checked:bg-slate-700 checked:before:bg-slate-700 hover:before:opacity-10"
                      id="link"
                    />
                    <span className="absolute text-white transition-opacity opacity-0 pointer-events-none top-2/4 left-2/4 -translate-y-2/4 -translate-x-2/4 peer-checked:opacity-100">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        stroke="currentColor"
                        strokeWidth="1"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        ></path>
                      </svg>
                    </span>
                  </label>
                  <label
                    className="mt-px font-light text-slate-300 select-none max-w-[550px]"
                    htmlFor="link"
                  >
                    <p className="text-white">
                      I have read and accepted the
                      <Link
                        rel="noopener noreferrer"
                        className="text-sky-400 hover:text-sky-300 transition-colors"
                        href="/terms-of-service"
                      >
                        {' '}
                        Terms and Conditions{' '}
                      </Link>{' '}
                      and the{' '}
                      <Link
                        className="text-sky-400 hover:text-sky-300 transition-colors"
                        href="/privacy-policy"
                        rel="noopener noreferrer"
                      >
                        Privacy Policy
                      </Link>
                      .
                    </p>
                  </label>
                </div>
                <div className="mt-6">
                  <NetworkSelector chains={chains} />
                </div>
                <PrivyWeb3Button
                  id="citizen-checkout-button"
                  skipNetworkCheck={true}
                  label={
                    isLoadingMint
                      ? 'Creating Citizen...'
                      : isLoadingGasEstimate
                      ? 'Estimating Gas...'
                      : 'Become a Citizen'
                  }
                  className="mt-6 w-auto px-8 py-2 gradient-2 hover:scale-105 transition-transform rounded-xl font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  isDisabled={!agreedToCondition || isLoadingMint || isLoadingGasEstimate}
                  action={callMint}
                />
                {isLoadingMint && (
                  <div className="mt-4 p-4 bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl">
                    <p className="text-slate-300 text-center">
                      Creating your citizen profile on the blockchain...
                    </p>
                    <p className="text-slate-400 text-sm text-center mt-2">
                      This process can take up to a minute. Please wait while the transaction is
                      processed.
                    </p>
                  </div>
                )}
              </StageContainer>
            )}
          </div>
        </div>
        {/* Dev Buttons */}
        {process.env.NEXT_PUBLIC_ENV === 'dev' && (
          <div className="flex flex-row justify-center gap-4">
            <button id="citizen-back-button" onClick={() => setStage(stage - 1)}>
              BACK
            </button>
            <button id="citizen-next-button" onClick={() => setStage(stage + 1)}>
              NEXT
            </button>
          </div>
        )}
      </ContentLayout>
      {address && (
        <CBOnrampModal
          enabled={onrampModalOpen}
          setEnabled={setOnrampModalOpen}
          address={address}
          selectedChain={selectedChain}
          ethAmount={requiredEthAmount}
          context="citizen"
          agreed={agreedToCondition}
          selectedWallet={selectedWallet}
          onExit={() => {
            setIsLoadingMint(false)
          }}
          onBeforeNavigate={async () => {
            const serializedCitizenImage = citizenImage
              ? await fileToBase64(citizenImage)
              : null
            const serializedInputImage = inputImage ? await fileToBase64(inputImage) : null
            setCache(
              {
                stage,
                citizenData,
                citizenImage: serializedCitizenImage,
                inputImage: serializedInputImage,
                agreedToCondition,
                selectedChainSlug,
              },
              stage
            )
          }}
        />
      )}
    </Container>
  )
}
