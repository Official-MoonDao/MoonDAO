import { GoogleSpreadsheet } from 'google-spreadsheet'

let doc: any
//Init GoogleSheets
async function spreadsheetAuth() {
  try {
    doc = new GoogleSpreadsheet(process.env.NEXT_PUBLIC_GOOGLE_SPREADSHEET_ID)
    await doc.useServiceAccountAuth({
      client_email: process.env.NEXT_PUBLIC_GOOGLE_SHEETS_EMAIL,
      private_key: process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SECRET.replace(
        /\\n/g,
        '\n'
      ),
    })
  } catch (e: any) {
    console.error('google-sheets: useServiceAcount', e.message)
  }
}

async function appendSpreadsheet(row: any) {
  try {
    await spreadsheetAuth()
    await doc.loadInfo()
    const sheet = doc.sheetsById['0']
    await sheet.addRow(row)
  } catch (e: any) {
    console.error('google-sheets: append spreadsheet', e.message)
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
  console.log(newRow)
  await appendSpreadsheet(newRow)
}

export async function checkUserData({
  twitterName,
  discordName,
  walletAddress,
  email,
}: any) {
  try {
    await spreadsheetAuth()
    await doc.loadInfo()
    const sheet = doc.sheetsById['0']
    const rows = await sheet.getRows()
    const userHasEnteredRaffle =
      rows.filter(
        (row: any) =>
          row.DiscUsername === discordName ||
          row.TwitterDisplayName === twitterName ||
          row.Email === email ||
          row.WalletAddress === walletAddress
      ).length > 0 && true
    return userHasEnteredRaffle
  } catch (e: any) {
    console.error('google-sheets: checkUserData', e.message)
  }
}
