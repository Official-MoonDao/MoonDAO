import {
  ArrowUpRightIcon,
  GlobeAltIcon,
  PencilIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline'
import { useWallets } from '@privy-io/react-auth'
import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import {
  ThirdwebNftMedia,
  useAddress,
  useContract,
  useNFT,
} from '@thirdweb-dev/react'
import {
  CITIZEN_ADDRESSES,
  DISCORD_GUILD_ID,
  HATS_ADDRESS,
  MOONEY_ADDRESSES,
  VMOONEY_ADDRESSES,
} from 'const/config'
import { GetServerSideProps } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useCitizenData } from '@/lib/citizen/useCitizenData'
import { useProjects } from '@/lib/discord/useProjects'
import { useWearer } from '@/lib/hats/useWearer'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import ChainContext from '@/lib/thirdweb/chain-context'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import { initSDK } from '@/lib/thirdweb/thirdweb'
import { useMOONEYBalance } from '@/lib/tokens/mooney-token'
import { useVMOONEYBalance } from '@/lib/tokens/ve-token'
import { CopyIcon, DiscordIcon, TwitterIcon } from '@/components/assets'
import { Hat } from '@/components/hats/Hat'
import StandardButton from '@/components/layout/StandardButton'
import Button from '@/components/subscription/Button'
import Card from '@/components/subscription/Card'
import { CitizenMetadataModal } from '@/components/subscription/CitizenMetadataModal'
import GeneralActions from '@/components/subscription/GeneralActions'
import Proposals from '@/components/subscription/Proposals'
import { SubscriptionModal } from '@/components/subscription/SubscriptionModal'

export default function CitizenDetailPage() {
  const router = useRouter()
  const address = useAddress()

  const [tokenId, setTokenId] = useState<any>(router.query.tokenId)

  // //privy
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const { selectedChain, setSelectedChain } = useContext(ChainContext)

  const [subModalEnabled, setSubModalEnabled] = useState(false)
  const [citizenMetadataModalEnabled, setCitizenMetadataModalEnabled] =
    useState(false)

  //Data
  const { contract: citizenContract } = useContract(
    CITIZEN_ADDRESSES[selectedChain.slug]
  )
  const { data: nft } = useNFT(citizenContract, tokenId)

  const {
    socials,
    isPublic,
    subIsValid,
    isLoading: isLoadingCitizenData,
  } = useCitizenData(nft, citizenContract)

  //Balances
  const { contract: mooneyContract } = useContract(
    MOONEY_ADDRESSES[selectedChain.slug]
  )
  const { data: MOONEYBalance } = useMOONEYBalance(mooneyContract, nft?.owner)
  const { contract: vMooneyContract } = useContract(
    VMOONEY_ADDRESSES[selectedChain.slug]
  )

  const { data: VMOONEYBalance } = useVMOONEYBalance(
    vMooneyContract,
    nft?.owner
  )

  const [nativeBalance, setNativeBalance] = useState<number>(0)

  async function getNativeBalance() {
    const sdk = initSDK(selectedChain)
    const provider = sdk.getProvider()
    const balance: any = await provider.getBalance(nft?.owner || '')
    setNativeBalance(+(balance.toString() / 10 ** 18).toFixed(5))
  }

  //Subscription Data
  const { data: expiresAt } = useHandleRead(citizenContract, 'expiresAt', [
    nft?.metadata?.id || '',
  ])

  // //Hats
  const hats = useWearer(selectedChain, nft?.owner)
  const { contract: hatsContract } = useContract(HATS_ADDRESS)

  // get native balance for multisig
  useEffect(() => {
    if (nft?.owner) {
      getNativeBalance()
    }
  }, [nft])

  const projects = useProjects()

  useEffect(() => {
    setSelectedChain(
      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
    )
  }, [])

  if (!nft?.metadata || isLoadingCitizenData) return

  if (!subIsValid) {
    return (
      <Card>
        <p>The pass has expired, please connect the owner's wallet to renew.</p>
        <div className="mt-8 xl:mt-0">
          {subModalEnabled && (
            <SubscriptionModal
              setEnabled={setSubModalEnabled}
              nft={nft}
              validPass={subIsValid}
              expiresAt={expiresAt}
              subscriptionContract={citizenContract}
            />
          )}
          {expiresAt && (
            <div className="flex flex-col gap-4 items-start">
              {subIsValid && (
                <p className="opacity-50">
                  {'Exp: '}
                  {new Date(expiresAt?.toString() * 1000).toLocaleString()}
                </p>
              )}
              <Button
                onClick={() => {
                  if (address != nft?.owner)
                    return toast.error(
                      `Connect the entity admin wallet or multisig to extend the subscription.`
                    )
                  setSubModalEnabled(true)
                }}
              >
                {'Extend Subscription'}
              </Button>
            </div>
          )}
        </div>
      </Card>
    )
  }

  return (
    <div className="animate-fadeIn flex flex-col gap-6 w-full max-w-[1080px]">
      {/* Header and socials */}
      <Card className="flex flex-col xl:flex-row justify-between dark:bg-gradient-to-tr from-[#080C20] to-[#111A46] from-60%">
        <div>
          <div className="w-full flex flex-col lg:flex-row items-start gap-8 justify-between">
            <div className="flex gap-4">
              {nft?.metadata.image ? (
                <div className="w-[125px]">
                  <ThirdwebNftMedia
                    className="rounded-full"
                    metadata={nft.metadata}
                    height={'100%'}
                    width={'100%'}
                  />
                </div>
              ) : (
                <div className="w-[200px] h-[200px] bg-[#ffffff25] animate-pulse" />
              )}
              <div>
                <div className="flex gap-4">
                  {nft ? (
                    <h1 className="text-black dark:text-white text-3xl">
                      {nft.metadata.name}
                    </h1>
                  ) : (
                    <div className="w-[200px] h-[50px] bg-[#ffffff25] animate-pulse" />
                  )}
                  {citizenMetadataModalEnabled && (
                    <CitizenMetadataModal
                      nft={nft}
                      selectedChain={selectedChain}
                      setEnabled={setCitizenMetadataModalEnabled}
                    />
                  )}
                  {address === nft?.owner && (
                    <button
                      onClick={() => {
                        if (address != nft?.owner)
                          return toast.error(
                            'Connect the entity admin wallet or multisig to edit metadata.'
                          )
                        setCitizenMetadataModalEnabled(true)
                      }}
                    >
                      <PencilIcon width={35} height={35} />
                    </button>
                  )}
                </div>
                {nft?.owner ? (
                  <button
                    className="mt-4 flex items-center gap-2 text-moon-orange font-RobotoMono inline-block text-center w-full lg:text-left xl:text-lg"
                    onClick={() => {
                      navigator.clipboard.writeText(nft.owner)
                      toast.success('Address copied to clipboard')
                    }}
                  >
                    {nft.owner?.slice(0, 6) + '...' + nft.owner?.slice(-4)}
                    <CopyIcon />
                  </button>
                ) : (
                  <div className="mt-4 w-[200px] h-[50px] bg-[#ffffff25] animate-pulse" />
                )}
              </div>
            </div>
          </div>
          <div>
            {nft?.metadata.description ? (
              <p className="mt-4">{nft?.metadata.description || ''}</p>
            ) : (
              <div className="mt-4 w-full h-[30px] bg-[#ffffff25] animate-pulse" />
            )}
            {socials ? (
              <div className="mt-4 flex flex-col gap-2">
                {socials.discord && (
                  <button
                    className="flex gap-2"
                    onClick={() => {
                      navigator.clipboard.writeText(socials.discord)
                      toast.success('Discord username copied to clipboard.')
                    }}
                  >
                    <DiscordIcon />
                    {socials.discord}
                  </button>
                )}
                {socials.twitter && (
                  <Link
                    className="flex gap-2"
                    href={socials.twitter}
                    target="_blank"
                    passHref
                  >
                    <TwitterIcon />
                    {socials.twitter}
                  </Link>
                )}
                {socials.website && (
                  <Link
                    className="flex gap-2"
                    href={socials.website}
                    target="_blank"
                    passHref
                  >
                    <GlobeAltIcon height={25} width={25} />
                    {socials.website}
                  </Link>
                )}
              </div>
            ) : (
              <div className="my-4 w-[100px] h-[30px] bg-[#ffffff25] animate-pulse rounded-full" />
            )}
          </div>
        </div>
        {address === nft.owner && (
          <div className="mt-8 xl:mt-0">
            {subModalEnabled && (
              <SubscriptionModal
                setEnabled={setSubModalEnabled}
                nft={nft}
                validPass={subIsValid}
                expiresAt={expiresAt}
                subscriptionContract={citizenContract}
              />
            )}
            {expiresAt && (
              <div className="flex flex-col gap-4 items-start">
                <p className="opacity-50">
                  {'Exp: '}
                  {new Date(expiresAt?.toString() * 1000).toLocaleString()}
                </p>

                <Button
                  onClick={() => {
                    if (address != nft?.owner)
                      return toast.error(
                        `Connect the entity admin wallet or multisig to extend the subscription.`
                      )
                    setSubModalEnabled(true)
                  }}
                >
                  {'Extend Subscription'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {subIsValid ? (
        <div>
          {/* Mooney and Voting Power */}
          <div className="flex flex-col xl:flex-row gap-6">
            <div className="w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section">
              <h2 className="header font-GoodTimes opacity-[50%]">Assets</h2>
              <div className="mt-4 flex flex-col gap-4">
                <div className="">
                  <p className="text-xl">{`$MOONEY`}</p>
                  <p className="text-3xl">
                    {MOONEYBalance
                      ? (MOONEYBalance?.toString() / 10 ** 18).toLocaleString()
                      : 0}
                  </p>
                </div>
                <div className="">
                  <p className="text-xl">{`Voting Power`}</p>
                  <p className="text-2xl">
                    {VMOONEYBalance
                      ? (VMOONEYBalance?.toString() / 10 ** 18).toLocaleString()
                      : 0}
                  </p>
                </div>
              </div>
              <div className="p-4 flex flex-col xl:flex-row items-start xl:items-end gap-2">
                <StandardButton
                  className="w-full gradient-2 rounded-[5vmax]"
                  onClick={() =>
                    window.open(
                      'https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395&chain=mainnet'
                    )
                  }
                >
                  {'Get $MOONEY'}
                </StandardButton>
                <StandardButton
                  className="w-full gradient-2 rounded-[5vmax]"
                  onClick={() => router.push('/lock')}
                >
                  {'Stake $MOONEY'}
                </StandardButton>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col 2xl:flex-row">
            <div className="w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section">
              <div className="flex flex-col gap-6">
                {/* Proposals */}
                <Proposals />
              </div>
              <p className="header font-GoodTimes opacity-[50%]">Roles</p>
              <div className="py-4 flex flex-col gap-2 max-h-[300px] overflow-y-scroll">
                {hats.map((hat: any) => (
                  <div
                    key={hat.id}
                    className="py-2 border-2 dark:border-0 dark:bg-[#0f152f]"
                  >
                    <Hat
                      selectedChain={selectedChain}
                      hatId={hat.id}
                      hatsContract={hatsContract}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Projects */}
            <div className="w-full p-5 md:pr-0 md:pb-10 overflow-hiddend bg-slide-section">
              <p className="header font-GoodTimes opacity-[50%]">Projects</p>
              <div className="py-4 max-h-[600px] overflow-y-scroll flex flex-col gap-2">
                {projects &&
                  projects.map((p: any, i: number) => (
                    <Link
                      key={`project-${i}`}
                      className="flex items-center justify-between p-2 border-2 dark:border-0 dark:bg-[#0f152f]"
                      href={`https://discord.com/channels/${DISCORD_GUILD_ID}/${p.id}`}
                      target="_blank"
                      passHref
                    >
                      <div className={'flex justify-between p-2 '}>
                        {p.name}
                      </div>
                      <ArrowUpRightIcon
                        className="text-moon-orange"
                        height={24}
                      />
                    </Link>
                  ))}
              </div>
            </div>
            {/* General Actions */}
          </div>
          <div className="mt-6">
            <GeneralActions />
          </div>
        </div>
      ) : (
        // Subscription expired
        <Card>
          <p className="text-moon-orange">
            {`The pass has expired, please connect the owner's wallet to renew.`}
          </p>
        </Card>
      )}
    </div>
  )
}
