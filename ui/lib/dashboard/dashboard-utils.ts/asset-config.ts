export const allowedAssets = {
  MOONEY: true,
  DAI: true,
  ETH: true,
  JBX: true,
  USDC: true,
  USDT: true,
  SAFE: true,
  BUSD: true,
  SHIB: true,
  WBTC: true,
  UNI: true,
  WETH: true,
  MATIC: true,
  MANA: true,
  ENS: true,
} as { [key: string]: boolean }

/* 
  This affects the TREASURY
  
  Edit this Dictionary to allow Tokens to be displayed as Assets or Transactions.
  
  The response from the API for both Assets and Transactions has a "tokenSymbol" property, entries whose tokenSymbol value isn't present in this dictionary are filtered out.
  */

export const assetImageExtension = {
  DAI: 'svg',
  BTC: 'svg',
  BNB: 'svg',
  ADA: 'svg',
  USDT: 'svg',
  ETH: 'svg',
  USDC: 'svg',
  JBX: 'png',
  MOONEY: 'png',
  SAFE: 'png',
  WBTC: 'png',
} as { [key: string]: string }

/*

This affects the TREASURY

The icons for Assets are in ./public/coins

To add an icon for a new Asset, drop the image in ./public/coins and write Assets official initials and the image extension in this Javascript object.

*/
