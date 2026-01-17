# MoonDAO Liquidity

## Pools

- [mainnet locked](https://app.uniswap.org/explore/pools/ethereum/0xbba1cec0f41c88da8ad30b5c28681e98f482c07defc9f88660e35b22db2a0248)
- [mainnet feehook](https://app.uniswap.org/explore/pools/ethereum/0xea64ebb3719a49e29d3dafb4ccae943d815e9070555b07accf17b91cbdeec236)
- [arbitrum locked](https://app.uniswap.org/explore/pools/arbitrum/0x3899a47c70ef4af9f74cb82b6362b8e2ae75c25d07815c431012c6e4f4f5e358)
- [arbitrum feehook](https://app.uniswap.org/explore/pools/arbitrum/0x2103a0b5e584fbdee4e57097725b786382986dc8d28240791a286bc1547dd24e)
- [base feehook](https://app.uniswap.org/explore/pools/base/0xc36f5087f8586241ae1d9533a1a3effbb84d4a43d0a64e4395f484313fa006ff)

## Fee Hook

The fee hook automatically withdraws trading fees and distributes them to vMOONEY holders. In order to be eligible, vMOONEY holders must check in weekly from the moondao.com dashboard. A [cron job](https://github.com/Official-MoonDao/MoonDAO/blob/main/.github/workflows/weekly-fee-distribution.yml) runs weekly to distribute the fees to checked in holders. Fees are distributed propotionally based on vMOONEY holdings on the given chain.

The fee hook owns the NFT for all pools which are registered to it. Pool NFTs can be transferred out via [transferPosition](https://arbiscan.io/address/0x6D9C97c94c88a67d1A93BBC8ccAe3a5322208844#writeContract#F19) for liquidity operations.
