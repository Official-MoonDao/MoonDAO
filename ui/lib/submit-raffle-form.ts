import { GoogleSpreadsheet } from 'google-spreadsheet'
import KEYS from '../namegetKeys'

const doc = new GoogleSpreadsheet(KEYS.googleSpreadsheetId)

async function appendSpreadsheet(row: any) {
  try {
    await doc.useServiceAccountAuth({
      client_email: KEYS.googlSheetsEmail,
      private_key: KEYS.googleSheetsSecret?.replace(/\\n/g, '\n'),
    })

    await doc.loadInfo()

    const sheet = doc.sheetsById['0']
    console.log(sheet)
    await sheet.addRow(row)
  } catch (e) {
    console.error('Error : ', e)
  }
}

export async function submitRaffleForm({
  twitterName,
  discordName,
  walletAddress,
  email,
}: any) {
  const newRow = {
    DiscUsername: discordName,
    TwitterDisplayName: twitterName,
    WalletAddress: walletAddress,
    Email: email,
  }
  await appendSpreadsheet(newRow)
}
