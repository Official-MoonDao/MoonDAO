import TeamABI from 'const/abis/Team.json'
import {
  CITIZENSHIP_GIFT_TAG,
  DEFAULT_CHAIN_V5,
  DEPLOYED_ORIGIN,
  EB_TEAM_ID,
  MARKETPLACE_TABLE_NAMES,
  TEAM_ADDRESSES,
  TEAM_TABLE_NAMES,
} from 'const/config'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import { getContract, waitForReceipt } from 'thirdweb'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { getOwnedNFTs } from 'thirdweb/extensions/erc721'
import {
  createInvite,
  generateInviteToken,
} from '@/lib/citizen/inviteTokens'
import { getMoonDaoGmailTransport, opEmail } from '@/lib/nodemailer/nodemailer'
import { getPrivyUserData } from '@/lib/privy'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { fetchResponseFromFormIds } from '@/lib/typeform/hasAccessToResponse'
import { getBlocksInTimeframe } from '@/lib/utils/blocks'

const GIFT_INVITE_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days

const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)

const teamContract = getContract({
  address: TEAM_ADDRESSES[chainSlug],
  chain: DEFAULT_CHAIN_V5,
  client: serverClient,
  abi: TeamABI as any,
})

const MARKETPLACE_VENDOR_PURHCASE_FIELDS: any = {
  address: 'Address',
  email: 'Email',
  item: 'Item',
  tx: 'Transaction',
}

const MARKETPLACE_CITIZEN_PURHCASE_FIELDS: any = {
  item: 'Item',
  value: 'Value',
  quantity: 'Quantity',
  tx: 'Transaction',
}

// In-memory storage for used transaction hashes to prevent replay attacks
const usedTransactions = new Set<string>()

setInterval(() => {
  usedTransactions.clear()
}, 60 * 60 * 1000)

const generateHTML = (htmlData: any) => {
  return `<!DOCTYPE html><html> <head> <title></title> <meta charset="utf-8"/> <meta name="viewport" content="width=device-width, initial-scale=1"/> <meta http-equiv="X-UA-Compatible" content="IE=edge"/> <style type="text/css"> body, table, td, a{-webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;}table{border-collapse: collapse !important;}body{height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important;}@media screen and (max-width: 525px){.wrapper{width: 100% !important; max-width: 100% !important;}.responsive-table{width: 100% !important;}.padding{padding: 10px 5% 15px 5% !important;}.section-padding{padding: 0 15px 50px 15px !important;}}.form-container{margin-bottom: 24px; padding: 20px; border: 1px dashed #ccc;}.form-heading{color: #2a2a2a; font-family: "Helvetica Neue", "Helvetica", "Arial", sans-serif; font-weight: 400; text-align: left; line-height: 20px; font-size: 18px; margin: 0 0 8px; padding: 0;}.form-answer{color: #2a2a2a; font-family: "Helvetica Neue", "Helvetica", "Arial", sans-serif; font-weight: 300; text-align: left; line-height: 20px; font-size: 16px; margin: 0 0 24px; padding: 0;}div[style*="margin: 16px 0;"]{margin: 0 !important;}</style> </head> <body style="margin: 0 !important; padding: 0 !important; background: #fff"> <div style=" display: none; font-size: 1px; color: #fefefe; line-height: 1px;  max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; " ></div><table border="0" cellpadding="0" cellspacing="0" width="100%"> <tr> <td bgcolor="#ffffff" align="center" style="padding: 10px 15px 30px 15px" class="section-padding" > <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px" class="responsive-table" > <tr> <td> <table width="100%" border="0" cellspacing="0" cellpadding="0"> <tr> <td> <table width="100%" border="0" cellspacing="0" cellpadding="0" > <tr> <td style=" padding: 0 0 0 0; font-size: 16px; line-height: 25px; color: #232323; " class="padding message-content" > <h2>MoonDAO Marketplace Purchase</h2> <div class="form-container">${htmlData}</div></td></tr></table> </td></tr></table> </td></tr></table> </td></tr></table> </body></html>`
}

const generateVendorEmailContent = (data: any) => {
  const stringData = Object.entries(data).reduce(
    (str, [key, val]) =>
      (str += `${MARKETPLACE_VENDOR_PURHCASE_FIELDS[key]}: \n${val} \n \n`),
    ''
  )

  const {
    address,
    email,
    item,
    value,
    currency,
    quantity,
    shipping,
    txLink,
    isCitizen,
  } = JSON.parse(data)

  const htmlData = `
    <div>
    <label for="name"><strong>Wallet Address</strong></label>
    <p>${address}</p>
    <label for="email"><strong>Email</strong></label>
    <p>${email}</p>
    <label for="item"><strong>Item</strong></label>
    <p>${item}</p>
    <label for="value"><strong>Value</strong></label>
    <p>${value} ${currency}</p>
    <label for="citizenship"><strong>Citizenship</strong></label>
    <p>${
      isCitizen
        ? 'Buyer is a citizen (regular price)'
        : 'Buyer is not a citizen (10% markup)'
    }</p>
    <label for="quantity"><strong>Quantity</strong></label>
    <p>${quantity}</p>
    <label for="shipping"><strong>Shipping Address</strong></label>
    <p>${shipping}</p>
    <label for="tx"><strong>Transaction</strong></label>
    <p>${txLink}</p>
    <p>Please verify the transaction before fulfilling the order.</p>
    </div>
    `

  return {
    text: stringData,
    html: generateHTML(htmlData),
  }
}

const generateCitizenEmailContent = (data: any) => {
  const stringData = Object.entries(data).reduce(
    (str, [key, val]) =>
      (str += `${MARKETPLACE_CITIZEN_PURHCASE_FIELDS[key]}: \n${val} \n \n`),
    ''
  )

  const { item, value, currency, quantity, txLink, teamLink, giftLink } =
    JSON.parse(data)

  const giftSection = giftLink
    ? `
    <label for="giftLink"><strong>Your Gift Citizenship Link</strong></label>
    <p>Share this one-time link with whoever you want to gift a citizenship to. They can use it to mint their free citizenship.</p>
    <p><a href="${giftLink}">${giftLink}</a></p>
  `
    : ''

  const htmlData = `
  <div>
    <label for="teamLink"><strong>Team</strong></label>
    <p>${teamLink}</p>
    <label for="item"><strong>Item</strong></label>
    <p>${item}</p>
    <label for="value"><strong>Value</strong></label>
    <p>${value} ${currency}</p>
    <label for="quantity"><strong>Quantity</strong></label>
    <p>${quantity}</p>
    <label for="tx"><strong>Transaction</strong></label>
    <p>${txLink}</p>
    ${giftSection}
  </div>
  `

  return {
    text: stringData,
    html: generateHTML(htmlData),
  }
}

async function handler(req: any, res: any) {
  if (req.method === 'POST') {
    const data = req.body
    if (!data) {
      return res.status(400).send({ message: 'Bad request' })
    }

    const { email, txHash, accessToken, isGift, listingId } = JSON.parse(data)

    // Verify the Privy access token
    const privyUserData = await getPrivyUserData(accessToken)
    if (!privyUserData) {
      return res.status(400).send({ message: 'Invalid access token' })
    }

    const { walletAddresses } = privyUserData
    if (walletAddresses.length === 0) {
      return res.status(400).send({ message: 'No wallet addresses found' })
    }

    // Check if transaction has already been used for email sending
    if (usedTransactions.has(txHash)) {
      return res.status(400).send({
        message:
          'Transaction has already been processed for marketplace purchase',
      })
    }

    // Verify transaction exists and is valid
    const txReceipt = await waitForReceipt({
      client: serverClient,
      chain: DEFAULT_CHAIN_V5,
      transactionHash: txHash,
    })

    // Verify transaction is from user's wallet
    let txIsFromUsersWallet = false
    for (const walletAddress of walletAddresses) {
      if (txReceipt.from.toLowerCase() === walletAddress.toLowerCase()) {
        txIsFromUsersWallet = true
        break
      }
    }

    if (!txIsFromUsersWallet) {
      return res
        .status(400)
        .send({ message: "Transaction is not from the user's wallet" })
    }

    // Check if transaction is recent (within 10 minutes)
    const txBlockNumber = Number(txReceipt.blockNumber)
    const provider = ethers5Adapter.provider.toEthers({
      client: serverClient,
      chain: DEFAULT_CHAIN_V5,
    })
    const currBlockNumber = await provider.getBlockNumber()
    const maxBlocksAge = getBlocksInTimeframe(DEFAULT_CHAIN_V5, 10) // 10 minutes
    const blockAge = currBlockNumber - txBlockNumber

    if (blockAge > maxBlocksAge) {
      return res.status(400).send({
        message: `Transaction is too old. Must be within 10 minutes (${maxBlocksAge} blocks). Transaction is ${blockAge} blocks old.`,
      })
    }

    // Mark transaction as used to prevent replay attacks
    usedTransactions.add(txHash)

    //Get the team email from the tx to address
    const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
    const teamAddress = txReceipt.to
    const ownedNFTs = await getOwnedNFTs({
      contract: teamContract,
      owner: teamAddress || '',
    })
    const teamTokenId = ownedNFTs?.[0]?.id.toString()

    // Gift-a-citizenship: when the purchased listing is a verified gift listing
    // on the EB team and the buyer paid at least the listing price, issue a
    // one-time free-citizen invite link. Generating the token server-side after
    // a verified on-chain payment means the payment itself is the
    // authorization — buyers don't need to be operators.
    let giftLink: string | undefined
    if (isGift) {
      if (String(teamTokenId) !== EB_TEAM_ID) {
        return res
          .status(400)
          .send({ message: 'Gift purchases are only available on the EB team' })
      }

      const numericListingId = Number(listingId)
      if (!Number.isInteger(numericListingId) || numericListingId < 0) {
        return res.status(400).send({ message: 'Invalid listing' })
      }

      const listingRows = await queryTable(
        DEFAULT_CHAIN_V5,
        `SELECT * FROM ${MARKETPLACE_TABLE_NAMES[chainSlug]} WHERE id = ${numericListingId} AND teamId = ${teamTokenId}`
      )
      const giftListing: any = listingRows?.[0]

      if (!giftListing || giftListing.tag !== CITIZENSHIP_GIFT_TAG) {
        return res
          .status(400)
          .send({ message: 'Listing is not a gift citizenship listing' })
      }

      if (giftListing.currency !== 'ETH') {
        return res
          .status(400)
          .send({ message: 'Gift purchases must be paid in ETH' })
      }

      // Verify the buyer actually paid (at least) the listing price in ETH.
      const tx = await provider.getTransaction(txHash)
      const valueWei = BigInt(tx?.value?.toString() || '0')
      const priceNum = parseFloat(String(giftListing.price).replace(/,/g, ''))
      const expectedWei = BigInt(Math.floor(priceNum * 1e18))
      const minWei = (expectedWei * 99n) / 100n // small tolerance for rounding
      if (priceNum <= 0 || valueWei < minWei) {
        return res
          .status(400)
          .send({ message: 'Payment does not cover the listing price' })
      }

      const token = generateInviteToken()
      const created = await createInvite(
        token,
        {
          createdAt: Date.now(),
          label: `Gift citizenship purchase (listing #${numericListingId})`,
          createdBy: `marketplace-gift:${txReceipt.from}`,
        },
        GIFT_INVITE_TTL_SECONDS
      )
      if (!created) {
        return res.status(500).send({
          message:
            'Invite storage is not configured. Please contact support to claim your gift.',
        })
      }
      const origin = (DEPLOYED_ORIGIN || '').replace(/\/$/, '')
      giftLink = `${origin}/citizen?invite=${token}`
    }

    const teamRows = await queryTable(
      DEFAULT_CHAIN_V5,
      `SELECT * FROM ${TEAM_TABLE_NAMES[chainSlug]} WHERE id = '${teamTokenId}'`
    )
    const team: any = teamRows?.[0]

    // Get team form IDs (same as in hasAccessToResponse.ts)
    const teamFormIds = [
      process.env.NEXT_PUBLIC_TYPEFORM_TEAM_FORM_ID as string,
      process.env.NEXT_PUBLIC_TYPEFORM_TEAM_EMAIL_FORM_ID as string,
    ].filter(Boolean)

    // Fetch team typeform response from multiple form IDs
    let teamTypeformData = null
    if (team?.formId && typeof team.formId === 'string') {
      teamTypeformData = await fetchResponseFromFormIds(
        teamFormIds,
        team.formId
      )
    }

    let teamTypeformEmail = null
    if (teamTypeformData && teamTypeformData.items?.length > 0) {
      const teamTypeformResponse = teamTypeformData.items[0]
      // Look for email in different possible field structures
      teamTypeformEmail =
        teamTypeformResponse.answers?.find(
          (answer: any) =>
            answer.field?.type === 'email' || answer.type === 'email'
        )?.email || teamTypeformResponse.answers?.email
    }

    // For gift purchases the critical deliverable is the buyer's gift link, so
    // a missing vendor email shouldn't block the purchase. For normal listings
    // the vendor email is required to fulfill the order.
    if (!teamTypeformEmail && !isGift) {
      return res.status(400).send({ message: 'No team email found' })
    }

    // Inject the server-generated gift link into the buyer's email payload.
    const buyerEmailData = giftLink
      ? JSON.stringify({ ...JSON.parse(data), giftLink })
      : data

    try {
      if (teamTypeformEmail) {
        await getMoonDaoGmailTransport().sendMail({
          from: opEmail,
          to: teamTypeformEmail,
          ...generateVendorEmailContent(data),
          subject: 'MoonDAO | Marketplace Purchase',
        })
      }
      await getMoonDaoGmailTransport().sendMail({
        from: opEmail,
        to: email,
        ...generateCitizenEmailContent(buyerEmailData),
        subject: 'MoonDAO | Marketplace Purchase',
        bcc: [opEmail],
      })
      return res.status(200).json({ success: true, giftLink })
    } catch (err: any) {
      console.log(err)
      // The gift link is already generated and returned to the buyer in the
      // modal, so a failed confirmation email shouldn't fail the purchase.
      if (isGift && giftLink) {
        return res.status(200).json({ success: true, giftLink })
      }
      // Remove transaction from used set if email failed, allowing retry
      usedTransactions.delete(txHash)
      return res.status(400).json({
        message: err.message,
      })
    }
  } else {
    res.status(405).send({ message: 'Method not allowed' })
  }
}
export default withMiddleware(handler, authMiddleware)
