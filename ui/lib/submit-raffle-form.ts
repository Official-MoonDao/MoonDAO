import { GoogleSpreadsheet } from 'google-spreadsheet'

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID)
async function appendSpreadsheet(row: any) {
  try {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SHEETS_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_SECRET.replace(/\\n/g, '\n'),
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
    Date: new Date(Date.now()).toDateString(),
  }
  await appendSpreadsheet(newRow)
}
