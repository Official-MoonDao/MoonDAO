export default function ThirdwebEditionDropEmbed({ tokenId }: any) {
  return (
    <div className="flex flex-col justify-center items-center p-1 bg-raffleOrange rounded-2xl">
      <div className="flex flex-col justify-center items-center p-4 bg-[#2b2a33] rounded-2xl">
        <p className="m-2 text-n3blue w-full text-center tracking-tighter">
          {`
          Connect your wallet to the NFT provider below`}
        </p>
        <iframe
          className="rounded-2xl"
          src="https://gateway.ipfscdn.io/ipfs/QmRHAgPic1HeakAw9EU7WRjt4NPE19pWb8hCorRNhw4Zdy/erc1155.html?contract=0x3053a1c1d007a2607E9a8aC1dD953d28A4804272&chainId=5&tokenId=1&theme=dark&primaryColor=blue"
          width="100%"
          height="600px"
        />
      </div>
    </div>
  )
}
