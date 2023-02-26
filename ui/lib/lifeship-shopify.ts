import Client from 'shopify-buy'

const client = Client.buildClient({
  domain: 'lifeship.myshopify.com',
  storefrontAccessToken: process.env.SHOPIFY_ACCESS_TOKEN,
  apiVersion: '2023-01',
})

export async function getProductByHandle(handle: string) {
  try {
    return parseShopifyResponse(await client.product.fetchByHandle(handle))
  } catch (err) {
    console.error(err)
  }
}

export async function buyDNAKit(
  quantity: number,
  walletAddress: string = '0x0000'
) {
  const product = await getProductByHandle('dna-to-moon')
  const checkout = await client.checkout.create()
  await client.checkout.updateAttributes(checkout.id, {
    customAttributes: [{ key: 'WalletAddress', value: walletAddress }],
  })
  await client.checkout.addLineItems(checkout.id, [
    {
      variantId: product.variants[0].id,
      quantity: quantity,
    },
  ])
  await client.checkout.addDiscount(checkout.id, 'MOONDAO')
  const newCheckout = await client.checkout.fetch(checkout.id)
  return newCheckout.webUrl
}

export const parseShopifyResponse = (response: any) =>
  JSON.parse(JSON.stringify(response))
