import Client from 'shopify-buy'

const client = Client.buildClient({
  domain: 'lifeship.myshopify.com',
  storefrontAccessToken: process.env.SHOPIFY_ACCESS_TOKEN,
  apiVersion: '2023-01',
})

export const parseShopifyResponse = (response: any) =>
  JSON.parse(JSON.stringify(response))

export async function getProductByHandle(handle: string) {
  try {
    return parseShopifyResponse(await client.product.fetchByHandle(handle))
  } catch (err) {
    console.error(err)
  }
}

export async function getKits() {
  try {
    return parseShopifyResponse([
      await getProductByHandle('dna-to-moon'),
      await getProductByHandle('pet-kit'),
      await getProductByHandle('ash-on-the-moon'),
      await getProductByHandle('beam-your-photo-to-the-moon'),
    ])
  } catch (err) {
    console.error(err)
  }
}

export async function checkout(
  quantityDNA: number,
  quantityAshes: number,
  quantityPet: number,
  walletAddress: string = 'none'
) {
  try {
    if (quantityDNA <= 0 && quantityAshes <= 0 && quantityPet <= 0)
      return Error('Checkout has no quantity')
    const kitDNA = await getProductByHandle('dna-to-moon')
    const kitAshes = await getProductByHandle('ash-on-the-moon')
    const kitPetDNA = await getProductByHandle('pet-kit')
    const checkout = await client.checkout.create()
    await client.checkout.updateAttributes(checkout.id, {
      customAttributes: [{ key: 'WalletAddress', value: walletAddress }],
    })
    if (quantityDNA > 0) {
      await client.checkout.addLineItems(checkout.id, [
        {
          variantId: kitDNA.variants[0].id,
          quantity: quantityDNA,
        },
      ])
    }
    if (quantityAshes > 0) {
      await client.checkout.addLineItems(checkout.id, [
        {
          variantId: kitAshes.variants[0].id,
          quantity: quantityAshes,
        },
      ])
    }
    if (quantityPet > 0) {
      await client.checkout.addLineItems(checkout.id, [
        {
          variantId: kitPetDNA.variants[0].id,
          quantity: quantityPet,
        },
      ])
    }
    await client.checkout.addDiscount(checkout.id, 'MOONDAO')
    console.log(client.checkout)
    const newCheckout = await client.checkout.fetch(checkout.id)
    return newCheckout.webUrl
  } catch (err) {
    console.error(err)
  }
}
