import { GoogleSpreadsheet } from 'google-spreadsheet'
import KEYS from '../namegetKeys.js'

export async function submitRaffleForm({
  twitterName,
  discordName,
  walletAddress,
  email,
}: any) {
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID)
  async function appendSpreadsheet(row: any) {
    try {
      await doc.useServiceAccountAuth({
        client_email: process.env.GOOGLE_SHEETS_EMAIL,
        private_key: process.env.GOOGLE_SHEETS_SECRET.replace(/\\n/g, '\n'),
      })
      await doc.loadInfo()
      const sheet = doc.sheetsById['0']
      await sheet.addRow(row)
    } catch (e: any) {
      console.error('Error : ', e.message)
    }
  }
  const newRow = {
    DiscUsername: discordName,
    TwitterDisplayName: twitterName,
    WalletAddress: walletAddress,
    Email: email,
    Date: new Date(Date.now()).toDateString(),
  }
  await appendSpreadsheet(newRow)
}
