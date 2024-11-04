import { CITIZEN_ADDRESSES, DEFAULT_CHAIN } from 'const/config'
import { privyAuth } from 'middleware/privyAuth'
import withMiddleware from 'middleware/withMiddleware'
import { transporter, opEmail } from '@/lib/nodemailer/nodemailer'
import { initSDK } from '@/lib/thirdweb/thirdweb'

const MARKETPLACE_PURHCASE_FIELDS: any = {
  address: 'Address',
  email: 'Email',
  item: 'Item',
  tx: 'Transaction',
}

const generateEmailContent = (data: any) => {
  const stringData = Object.entries(data).reduce(
    (str, [key, val]) =>
      (str += `${MARKETPLACE_PURHCASE_FIELDS[key]}: \n${val} \n \n`),
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
    html: `<!DOCTYPE html><html> <head> <title></title> <meta charset="utf-8"/> <meta name="viewport" content="width=device-width, initial-scale=1"/> <meta http-equiv="X-UA-Compatible" content="IE=edge"/> <style type="text/css"> body, table, td, a{-webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;}table{border-collapse: collapse !important;}body{height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important;}@media screen and (max-width: 525px){.wrapper{width: 100% !important; max-width: 100% !important;}.responsive-table{width: 100% !important;}.padding{padding: 10px 5% 15px 5% !important;}.section-padding{padding: 0 15px 50px 15px !important;}}.form-container{margin-bottom: 24px; padding: 20px; border: 1px dashed #ccc;}.form-heading{color: #2a2a2a; font-family: "Helvetica Neue", "Helvetica", "Arial", sans-serif; font-weight: 400; text-align: left; line-height: 20px; font-size: 18px; margin: 0 0 8px; padding: 0;}.form-answer{color: #2a2a2a; font-family: "Helvetica Neue", "Helvetica", "Arial", sans-serif; font-weight: 300; text-align: left; line-height: 20px; font-size: 16px; margin: 0 0 24px; padding: 0;}div[style*="margin: 16px 0;"]{margin: 0 !important;}</style> </head> <body style="margin: 0 !important; padding: 0 !important; background: #fff"> <div style=" display: none; font-size: 1px; color: #fefefe; line-height: 1px;  max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; " ></div><table border="0" cellpadding="0" cellspacing="0" width="100%"> <tr> <td bgcolor="#ffffff" align="center" style="padding: 10px 15px 30px 15px" class="section-padding" > <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px" class="responsive-table" > <tr> <td> <table width="100%" border="0" cellspacing="0" cellpadding="0"> <tr> <td> <table width="100%" border="0" cellspacing="0" cellpadding="0" > <tr> <td style=" padding: 0 0 0 0; font-size: 16px; line-height: 25px; color: #232323; " class="padding message-content" > <h2>MoonDAO Marketplace Purchase</h2> <div class="form-container">${htmlData}</div></td></tr></table> </td></tr></table> </td></tr></table> </td></tr></table> </body></html>`,
  }
}

async function handler(req: any, res: any) {
  if (req.method === 'POST') {
    const data = req.body
    if (!data) {
      return res.status(400).send({ message: 'Bad request' })
    }

    const { teamEmail, txHash, isCitizen, recipient, value, decimals } =
      JSON.parse(data)

    let verifiedCitizen = false
    let fromIsNotCitizen = false

    const sdk = initSDK(DEFAULT_CHAIN)
    const provider = sdk?.getProvider()
    const txReceipt = await provider?.getTransactionReceipt(txHash)

    try {
      const citizenContract = await sdk?.getContract(
        CITIZEN_ADDRESSES[DEFAULT_CHAIN.slug]
      )

      const ownedTokenId = await citizenContract?.call('getOwnedToken', [
        txReceipt.from,
      ])

      if (ownedTokenId) {
        verifiedCitizen = true
      }
    } catch (err: any) {
      if (isCitizen) {
        fromIsNotCitizen = true
      }
    }

    if (isCitizen && !verifiedCitizen) {
      fromIsNotCitizen = true
    }

    if (fromIsNotCitizen) {
      return res.status(400).json({ message: 'Citizen cannot be verified' })
    }

    const currBlockNumber = await provider?.getBlockNumber()
    if (currBlockNumber - txReceipt.blockNumber > 2) {
      return res.status(400).json({ message: 'Transaction is invalid' })
    }

    if (recipient !== txReceipt.to) {
      return res.status(400).json({ message: 'Recipient is incorrect' })
    }

    const txValue = Number(txReceipt.logs[0]?.data) / 10 ** +decimals
    if (+value !== txValue) {
      return res.status(400).json({ message: 'Transaction is invalid' })
    }

    try {
      await transporter.sendMail({
        from: opEmail,
        to: teamEmail,
        ...generateEmailContent(data),
        subject: 'MoonDAO | Marketplace Purchase',
      })

      return res.status(200).json({ success: true })
    } catch (err: any) {
      console.log(err)
      return res.status(400).json({
        message: err.message,
        blockNumbers: {
          currBlockNumber,
          txReceipt: txReceipt.blockNumber,
        },
      })
    }
  } else {
    res.status(405).send({ message: 'Method not allowed' })
  }
}
export default withMiddleware(handler, privyAuth)
