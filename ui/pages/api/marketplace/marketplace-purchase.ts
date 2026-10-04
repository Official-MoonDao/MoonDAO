import CitizenABI from 'const/abis/Citizen.json'
import TeamABI from 'const/abis/Team.json'
import {
  CITIZEN_ADDRESSES,
  CITIZEN_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  DEPLOYED_ORIGIN,
  EB_TEAM_ID,
  MARKETPLACE_TABLE_NAMES,
  TEAM_ADDRESSES,
  TEAM_TABLE_NAMES,
} from 'const/config'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import { getContract, readContract, waitForReceipt } from 'thirdweb'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { getOwnedNFTs } from 'thirdweb/extensions/erc721'
import { FULL_DISCOUNT_BPS } from '@/lib/citizen/discountInvite'
import {
  createInvite,
  generateInviteToken,
  insertMarketplaceGiftTx,
  markMarketplaceGiftTxIssued,
  peekInvite,
  readMarketplaceGiftTx,
} from '@/lib/citizen/inviteTokens'
import {
  issueMarketplaceGiftInvite,
  readyMarketplaceGiftToken,
} from '@/lib/marketplace/giftInviteIssuance'
import { validateGiftPurchase } from '@/lib/marketplace/giftPurchase'
import {
  deliverMarketplaceReceipts,
  parsePurchaseBody,
} from '@/lib/marketplace/purchaseNotification'
import {
  extractEmailFromTypeformAnswers,
  lookupVendorEmail,
  resolveVendorTeamId,
  safeTransactionApiUrl,
} from '@/lib/marketplace/vendorEmail'
import { getMoonDaoGmailTransport, opEmail } from '@/lib/nodemailer/nodemailer'
import { getPrivyUserData } from '@/lib/privy'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'
import { fetchResponseFromFormIds } from '@/lib/typeform/hasAccessToResponse'
import { getBlocksInTimeframe } from '@/lib/utils/blocks'

// Pages Router reads the timeout from `config.maxDuration`. Without it this
// route sits on the ~10s platform default, which is shorter than vendor
// Typeform / Safe / citizen lookups — the function was killed before sendMail.
export const config = {
  maxDuration: 60,
}

const GIFT_INVITE_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days

function giftLinkForToken(token: string): string {
  const origin = (DEPLOYED_ORIGIN || '').replace(/\/$/, '')
  return `${origin}/citizen?invite=${token}`
}

const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)

const teamContract = getContract({
  address: TEAM_ADDRESSES[chainSlug],
  chain: DEFAULT_CHAIN_V5,
  client: serverClient,
  abi: TeamABI as any,
})

const citizenContract = getContract({
  address: CITIZEN_ADDRESSES[chainSlug],
  chain: DEFAULT_CHAIN_V5,
  client: serverClient,
  abi: CitizenABI as any,
})

async function fetchTypeformEmail(formIds: string[], responseId: string): Promise<string | null> {
  if (!formIds.length || !responseId) return null
  const data = await fetchResponseFromFormIds(formIds, responseId)
  return extractEmailFromTypeformAnswers(data?.items?.[0]?.answers)
}

async function getTeamFormId(teamId: string): Promise<string | null> {
  const teamRows = await queryTable(
    DEFAULT_CHAIN_V5,
    `SELECT formId FROM ${TEAM_TABLE_NAMES[chainSlug]} WHERE id = '${teamId}'`
  )
  const formId = teamRows?.[0]?.formId
  return typeof formId === 'string' && formId.trim() ? formId.trim() : null
}

async function getTeamOwner(teamId: string): Promise<string | null> {
  try {
    const owner = (await readContract({
      contract: teamContract,
      method: 'ownerOf' as string,
      params: [teamId],
    })) as string
    return owner || null
  } catch {
    return null
  }
}

async function getSafeOwners(address: string): Promise<string[]> {
  const api = safeTransactionApiUrl(chainSlug)
  if (!api || !address) return []
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(`${api}/api/v1/safes/${address}/`, {
      signal: controller.signal,
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.owners)
      ? data.owners.filter((owner: unknown) => typeof owner === 'string')
      : []
  } catch {
    return []
  } finally {
    clearTimeout(timeout)
  }
}

async function getCitizenFormId(wallet: string): Promise<string | null> {
  try {
    const tokenId = await readContract({
      contract: citizenContract,
      method: 'getOwnedToken' as string,
      params: [wallet],
    })
    const id = tokenId?.toString()
    if (!id || !/^\d+$/.test(id)) return null
    const rows = await queryTable(
      DEFAULT_CHAIN_V5,
      `SELECT formId FROM ${CITIZEN_TABLE_NAMES[chainSlug]} WHERE id = '${id}'`
    )
    const formId = rows?.[0]?.formId
    return typeof formId === 'string' && formId.trim() ? formId.trim() : null
  } catch {
    return null
  }
}

// Same-isolate dedup for receipt mail. Gift invites are not locked by this set:
// a retry after a dropped response or a 504 often runs on another instance.
// issueMarketplaceGiftInvite reserves the tx hash in Redis instead.
const usedTransactions = new Set<string>()

setInterval(() => {
  usedTransactions.clear()
}, 60 * 60 * 1000)

const generateHTML = (htmlData: any) => {
  return `<!DOCTYPE html><html> <head> <title></title> <meta charset="utf-8"/> <meta name="viewport" content="width=device-width, initial-scale=1"/> <meta http-equiv="X-UA-Compatible" content="IE=edge"/> <style type="text/css"> body, table, td, a{-webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;}table{border-collapse: collapse !important;}body{height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important;}@media screen and (max-width: 525px){.wrapper{width: 100% !important; max-width: 100% !important;}.responsive-table{width: 100% !important;}.padding{padding: 10px 5% 15px 5% !important;}.section-padding{padding: 0 15px 50px 15px !important;}}.form-container{margin-bottom: 24px; padding: 20px; border: 1px dashed #ccc;}.form-heading{color: #2a2a2a; font-family: "Helvetica Neue", "Helvetica", "Arial", sans-serif; font-weight: 400; text-align: left; line-height: 20px; font-size: 18px; margin: 0 0 8px; padding: 0;}.form-answer{color: #2a2a2a; font-family: "Helvetica Neue", "Helvetica", "Arial", sans-serif; font-weight: 300; text-align: left; line-height: 20px; font-size: 16px; margin: 0 0 24px; padding: 0;}div[style*="margin: 16px 0;"]{margin: 0 !important;}</style> </head> <body style="margin: 0 !important; padding: 0 !important; background: #fff"> <div style=" display: none; font-size: 1px; color: #fefefe; line-height: 1px;  max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; " ></div><table border="0" cellpadding="0" cellspacing="0" width="100%"> <tr> <td bgcolor="#ffffff" align="center" style="padding: 10px 15px 30px 15px" class="section-padding" > <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px" class="responsive-table" > <tr> <td> <table width="100%" border="0" cellspacing="0" cellpadding="0"> <tr> <td> <table width="100%" border="0" cellspacing="0" cellpadding="0" > <tr> <td style=" padding: 0 0 0 0; font-size: 16px; line-height: 25px; color: #232323; " class="padding message-content" > <h2>MoonDAO Marketplace Purchase</h2> <div class="form-container">${htmlData}</div></td></tr></table> </td></tr></table> </td></tr></table> </td></tr></table> </body></html>`
}

const textLine = (label: string, value: unknown) => `${label}: ${value ?? ''}`

const generateVendorEmailContent = (payload: any) => {
  const { address, email, item, value, currency, quantity, shipping, txLink, isCitizen } = payload

  const citizenship = isCitizen
    ? 'Buyer is a citizen (regular price)'
    : 'Buyer is not a citizen (10% markup)'

  const text = [
    textLine('Wallet Address', address),
    textLine('Email', email),
    textLine('Item', item),
    textLine('Value', `${value ?? ''} ${currency ?? ''}`.trim()),
    textLine('Citizenship', citizenship),
    textLine('Quantity', quantity),
    textLine('Shipping Address', shipping),
    textLine('Transaction', txLink),
    'Please verify the transaction before fulfilling the order.',
  ].join('\n\n')

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
    <p>${citizenship}</p>
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
    text,
    html: generateHTML(htmlData),
  }
}

const generateCitizenEmailContent = (payload: any) => {
  const { item, value, currency, quantity, txLink, teamLink, giftLink } = payload

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

  const text = [
    textLine('Team', teamLink),
    textLine('Item', item),
    textLine('Value', `${value ?? ''} ${currency ?? ''}`.trim()),
    textLine('Quantity', quantity),
    textLine('Transaction', txLink),
    giftLink ? textLine('Gift link', giftLink) : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  return {
    text,
    html: generateHTML(htmlData),
  }
}

async function handler(req: any, res: any) {
  if (req.method === 'POST') {
    // Next parses application/json into an object and leaves every other
    // content type as a string. Accept both so the receipt isn't dropped
    // because of the request's Content-Type.
    const payload = parsePurchaseBody(req.body)
    if (!payload) {
      return res.status(400).send({ message: 'Bad request' })
    }

    const email = typeof payload.email === 'string' ? payload.email : ''
    const txHash = typeof payload.txHash === 'string' ? payload.txHash : ''
    const accessToken = typeof payload.accessToken === 'string' ? payload.accessToken : ''
    const isGift = payload.isGift === true
    const listingId = payload.listingId
    const teamId = payload.teamId

    if (!txHash) {
      return res.status(400).send({ message: 'Bad request' })
    }

    // Verify the Privy access token
    const privyUserData = await getPrivyUserData(accessToken)
    if (!privyUserData) {
      return res.status(400).send({ message: 'Invalid access token' })
    }

    const { walletAddresses } = privyUserData
    if (walletAddresses.length === 0) {
      return res.status(400).send({ message: 'No wallet addresses found' })
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
      return res.status(400).send({ message: "Transaction is not from the user's wallet" })
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

    // Replay of a gift that already minted an invite returns that same link.
    // The in-memory set is only a same-isolate shortcut; the Redis record is
    // what stops a second isolate from minting another full-discount token.
    if (usedTransactions.has(txHash)) {
      if (!isGift) {
        return res.status(400).send({
          message: 'Transaction has already been processed for marketplace purchase',
        })
      }
      const ready = await readyMarketplaceGiftToken(
        { read: () => readMarketplaceGiftTx(txHash) },
        txReceipt.from
      )
      if (ready.status === 'ready') {
        return res.status(200).json({
          success: true,
          giftLink: giftLinkForToken(ready.token),
        })
      }
      if (ready.status === 'mismatch') {
        return res.status(400).send({
          message: 'Transaction has already been processed for marketplace purchase',
        })
      }
      if (ready.status === 'unavailable') {
        return res.status(500).send({
          message:
            'Invite storage is not configured. Please contact support to claim your gift.',
        })
      }
      // Reserved on this isolate, but the invite was never marked issued.
      usedTransactions.delete(txHash)
    }

    // Same-isolate mail dedup. Gift issuance is locked in Redis, not by this
    // set — a second isolate never sees it. Releasing the hash on a later
    // failure lets the buyer retry a payment that did not mint an invite.
    usedTransactions.add(txHash)

    const failAndRelease = (status: number, message: string) => {
      usedTransactions.delete(txHash)
      return res.status(status).send({ message })
    }

    // Derive the team that received this payment from the tx recipient. This
    // is only reliable for ETH listings: `sendTransaction({ to: recipient })`
    // makes tx.to the actual recipient, so "does that address own a Team NFT"
    // is a trustworthy, un-spoofable check — which is exactly why the gift-
    // citizenship flow below relies on it (gift listings are ETH-only). For
    // ERC20 listings (USDC/MOONEY/DAI — most listings) the buyer instead calls
    // `transfer()` ON THE TOKEN CONTRACT, so tx.to is the token contract
    // address, which never owns a Team NFT. That silently produced an empty
    // `ownedNFTs` and dropped the vendor email notification for every
    // non-ETH purchase.
    const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
    const teamAddress = txReceipt.to
    const ownedNFTs = await getOwnedNFTs({
      contract: teamContract,
      owner: teamAddress || '',
    })
    const teamTokenId = ownedNFTs?.[0]?.id.toString()

    // Resolve the listing row once, by its trusted on-chain-indexed id, so we
    // have a currency-agnostic source of the vendor's teamId for the email
    // lookup below and the gift-citizenship check doesn't need a second query.
    const numericListingId = Number(listingId)
    let listingRow: any = null
    if (Number.isInteger(numericListingId) && numericListingId >= 0) {
      try {
        const listingRows = await queryTable(
          DEFAULT_CHAIN_V5,
          `SELECT * FROM ${MARKETPLACE_TABLE_NAMES[chainSlug]} WHERE id = ${numericListingId}`
        )
        listingRow = listingRows?.[0] || null
      } catch (err: any) {
        console.log('Error looking up listing for marketplace purchase:', err)
      }
    }

    // Gift-a-citizenship: when the purchased listing is a verified gift listing
    // on the EB team and the buyer paid at least the listing price, issue a
    // one-time free-citizen invite link. Generating the token server-side after
    // a verified on-chain payment means the payment itself is the
    // authorization — buyers don't need to be operators.
    let giftLink: string | undefined
    if (isGift) {
      // Security anchor: both the listing's own recorded teamId AND the
      // on-chain-derived recipient's team must independently resolve to the
      // EB team. The latter can't be spoofed by the client (it's derived from
      // the real payment recipient), which is what actually proves the buyer
      // paid the EB team and not some other address. validateGiftPurchase
      // makes the authoritative accept/reject decision.
      const giftListing =
        listingRow && String(listingRow.teamId) === EB_TEAM_ID && String(teamTokenId) === EB_TEAM_ID
          ? listingRow
          : undefined

      // Read the actual ETH value transferred so we can bind the payment to
      // this specific gift listing (see validateGiftPurchase).
      const tx = await provider.getTransaction(txHash)
      const paidValueWei = BigInt(tx?.value?.toString() || '0')

      const validation = validateGiftPurchase({
        teamTokenId,
        listingId,
        listing: giftListing,
        paidValueWei,
      })
      if (!validation.ok) {
        return failAndRelease(validation.status, validation.message)
      }

      const issued = await issueMarketplaceGiftInvite(
        {
          insertIfAbsent: (record) =>
            insertMarketplaceGiftTx(txHash, record, GIFT_INVITE_TTL_SECONDS),
          read: () => readMarketplaceGiftTx(txHash),
          inviteState: async (token) => ((await peekInvite(token)) ? 'live' : 'missing'),
          createInvite: async (token) => {
            const created = await createInvite(
              token,
              {
                createdAt: Date.now(),
                label: `Gift citizenship purchase (listing #${numericListingId})`,
                createdBy: `marketplace-gift:${txReceipt.from}`,
                discountBps: FULL_DISCOUNT_BPS,
              },
              GIFT_INVITE_TTL_SECONDS
            )
            return !!created
          },
          markIssued: () => markMarketplaceGiftTxIssued(txHash, GIFT_INVITE_TTL_SECONDS),
        },
        { payer: txReceipt.from, newToken: generateInviteToken() }
      )
      if (!issued.ok) {
        return failAndRelease(
          issued.reason === 'mismatch' ? 400 : 500,
          issued.reason === 'mismatch'
            ? 'Transaction has already been processed for marketplace purchase'
            : 'Invite storage is not configured. Please contact support to claim your gift.'
        )
      }
      giftLink = giftLinkForToken(issued.token)
    }

    // Buyer receipt (BCC info@) goes out before vendor lookup. Typeform has no
    // timeout, and a Safe-owned team walks owner citizen forms — that used to
    // run first and the ~10s platform limit killed the function with zero mail.
    // A missing or rejected buyer address must still notify the vendor and ops.
    const buyerPayload = giftLink ? { ...payload, giftLink } : payload
    const delivery = await deliverMarketplaceReceipts({
      buyerEmail: email,
      opsEmail: opEmail,
      buyerContent: generateCitizenEmailContent(buyerPayload),
      vendorContent: generateVendorEmailContent(payload),
      lookupVendorEmail: async () => {
        const vendorTeamId = resolveVendorTeamId({
          listingTeamId: listingRow?.teamId,
          onchainTeamTokenId: teamTokenId,
          clientTeamId: teamId,
        })
        if (!vendorTeamId) return null
        try {
          return await lookupVendorEmail(vendorTeamId, {
            getTeamFormId,
            fetchTypeformEmail,
            getTeamOwner,
            getSafeOwners,
            getCitizenFormId,
            teamFormIds: [
              process.env.NEXT_PUBLIC_TYPEFORM_TEAM_FORM_ID as string,
              process.env.NEXT_PUBLIC_TYPEFORM_TEAM_EMAIL_FORM_ID as string,
            ].filter(Boolean),
            citizenFormIds: [
              process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID as string,
              process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_SHORT_FORM_ID as string,
              process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID as string,
            ].filter(Boolean),
          })
        } catch (err: any) {
          console.log('Error looking up vendor email for marketplace purchase:', err)
          return null
        }
      },
      sendMail: async (mail) => {
        await getMoonDaoGmailTransport().sendMail({
          from: opEmail,
          to: mail.to,
          ...(mail.bcc && mail.bcc.length > 0 ? { bcc: mail.bcc } : {}),
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
        })
      },
    })

    if (!delivery.buyerSent) {
      console.log('Failed to send buyer confirmation email')
      // The gift link is already generated and returned to the buyer in the
      // modal, so a failed confirmation email shouldn't fail the purchase.
      if (isGift && giftLink) {
        return res.status(200).json({ success: true, giftLink })
      }
      // Release the tx hash so a legitimate buyer can retry (e.g. transient
      // Gmail error) without the replay-attack guard blocking them. Vendor
      // and ops were already mailed above.
      return failAndRelease(
        500,
        'Payment received, but we could not send your confirmation email. Please contact support with your transaction hash.'
      )
    }

    if (!delivery.vendorSent) {
      console.log('Failed to send vendor notification email')
    }

    return res.status(200).json({ success: true, giftLink })
  } else {
    res.status(405).send({ message: 'Method not allowed' })
  }
}
export default withMiddleware(handler, authMiddleware)
