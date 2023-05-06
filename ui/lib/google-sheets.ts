import { GoogleSpreadsheet } from 'google-spreadsheet'

let doc: any
//Init GoogleSheets
async function spreadsheetAuth() {
  try {
    doc = new GoogleSpreadsheet(process.env.NEXT_PUBLIC_GOOGLE_SPREADSHEET_ID)
    await doc.useServiceAccountAuth({
      client_email: process.env.NEXT_PUBLIC_GOOGLE_SHEETS_EMAIL,
      private_key: String(
        `-----BEGIN PRIVATE KEY-----\n${process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SECRET_1}${process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SECRET_2}iVwSBxZEjn+FafKGr0pVQrQeH\nEnCyHrrIrh4rKZ7vdTMJ4azXwrmVjS0iVoxILJzxXFAbzBF8rA7FJleNX/2jvKbF\n5yl4sfqpsl2aGDZKux6ltWPc8+UP3cgm5AmADxUqYLQ969NlJ1zq7Xf+TR+kTsNG\n1S7DnzbleswmUXhb8oiUSP7KB7zHAggjjPglgBshlUKrI65syQzHLoM5inMmS68Y\nA/u/dhkJEPXuuKcddtcQRhKOJVuxM4vNuqi76B6KPBAQITvmFv+rOunDuheQlRPm\nDePrLPdQ1u3Pfb3dH1Ji/l35eOaqDx1RZZEfLs/vsQKBgQDpLHTynyGjkF2aUt7I\nWifDWJ/70mSASw4pzUBCWs8KE4GpfmXIrTz3LZ5eLpzw38rXmoZFGbJe8ACUUuta\n7xokCCHbmYCv81jLETkVLD6bYDKmbLUT0l6n3zPrAXECgmhEcaFonj5BfUqvcnHa\ntPjwS0sDfMjxHP8hLyn6q3ZsZQKBgQDULcphmXJPS+uWFzEXspzbhFI//J62GhYM\na2MW6rlGoCRlXxHqqj1nW6nXVRseya9j8MXcuJycyPWH12M3rbAW1DKKVwsmvXrA\nmSUmLYPcCEfOo3hlld45rokvrGDgDVfY8cTijI+/M55b3l+/ph4M5q9elSg0YgXw\nXr1tmNbyYwKBgA1z0CdzQNiT6qKNp2a9tM+TXF+F6uBv9Bg7TDrHzGwTZgamUS77\nt6m3Cwz5+Xn4H1bDBn4UFnNdu1rTUdrEMqjjgziNKZx9GKFWlAmBrPb/3Mw3N1c2\natmaif9D7QYtCeDxAVPs1UCn/tgSbTkl+bq7TU+dMmaeuqVqeCyLGeD1AoGAVGPK\nBLuVPXjCwLWErxo5TQ358L03GtKRRmtHxAujmTWEhFUluSHwvjU0/hI5cStieOuA\npuM+VxWOonLGYZTRXqMTXvZz1vqx4fyHTAH6Wf9pIATgk/bhpiuHIND8zuA/umee\nmUSyv6d2Kq/tgTo+5X6y7XmBviPmnM3xpa+OfmUCgYBWF/LgH2ltTE/dBo5HLOxh\nOIel06DkA2KYOKhHKFmGGUDjcWMpd5U2Q2OzyWbsy2KDfCsyj40Ckz/8QyjCsVOV\nzAnQVcvbHIjRXjaz++Ou949dhTFWWkS5+n9dEAGScjZE0cNjQYA8XiH1EP/7fvF5\nK/wGrxKlvy/dGTyLz4Qk2A==\n-----END PRIVATE KEY-----`
      ).replace(/\\n/g, '\n'),
    })
  } catch (e: any) {
    console.error('google-sheets: useServiceAcount', e.message)
  }
}

async function appendSpreadsheet(row: any, sheetId: string) {
  try {
    if (!doc) await spreadsheetAuth()
    await doc.loadInfo()
    const sheet = await doc.sheetsById[sheetId]
    await sheet.addRow(row)
  } catch (e: any) {
    console.error('google-sheets: append spreadsheet', e.message)
  }
}
//zero-g raffle submit raffle form
export async function submitRaffleForm({
  twitterName,
  userDiscordData,
  walletAddress,
  email,
}: any) {
  const newRow = {
    DiscUsername: userDiscordData.username,
    DiscID: userDiscordData.id,
    TwitterDisplayName: twitterName,
    WalletAddress: walletAddress,
    Email: email,
    Date: new Date(Date.now()).toDateString(),
  }
  await appendSpreadsheet(newRow, '0')
}
//zero-g raffle check user data
export async function checkUserDataRaffle({
  twitterName,
  userDiscordData,
  walletAddress,
  email,
}: any) {
  try {
    if (!doc) await spreadsheetAuth()
    await doc.loadInfo()
    const sheet = await doc.sheetsById['0']
    const rows = await sheet.getRows()
    const userHasEnteredRaffle = await rows.some(
      (row: any) =>
        row.DiscID === userDiscordData.id ||
        row.TwitterDisplayName === twitterName ||
        row.Email === email ||
        row.WalletAddress === walletAddress
    )
    return userHasEnteredRaffle
  } catch (err: any) {
    console.error('google-sheets: checkUserDataRaffle', err.message)
  }
}
//zero-g raffle get user data
export async function getUserDataRaffle(walletAddress: string) {
  try {
    if (!doc) await spreadsheetAuth()
    await doc.loadInfo()
    const sheet = await doc.sheetsById['596388473']
    const rows = await sheet.getRows()
    const userData = await rows.find(
      (row: any) => row.WalletAddress === walletAddress
    )
    return userData
  } catch (err: any) {
    console.error('google-sheets: getUserDataRaffle', err.message)
    if (
      err.message.startsWith(
        "Google API error - [429] Quota exceeded for quota metric 'Read requests' and limit 'Read requests per minute per user' of service 'sheets.googleapis.com' for consumer '"
      )
    ) {
      return 'rate limit'
    }
  }
}

//zero-g reservation
export async function checkUserDataReservation({
  fullName,
  email,
  walletAddress = '',
}: any) {
  try {
    if (!doc) await spreadsheetAuth()
    await doc.loadInfo()
    const sheet = await doc.sheetsById['1202870397']
    const rows = await sheet.getRows()
    const userHasEnteredRaffle = await rows.some(
      (row: any) =>
        row.FullName === fullName ||
        row.Email === email ||
        row?.WalletAddress === walletAddress
    )
    return userHasEnteredRaffle
  } catch (err: any) {
    console.error('google-sheets: checkUserDataRaffle', err.message)
  }
}
//zero-g reservation
export async function submitReservation({
  fullName,
  email,
  isVMOONEYHolder = false,
  walletAddress = 'none',
}: any) {
  const newRow = {
    FullName: fullName,
    Email: email,
    IsVMOONEYHolder: isVMOONEYHolder,
    Timestamp: new Date(Date.now()),
    WalletAddress: walletAddress,
  }
  await appendSpreadsheet(newRow, '1202870397')
}
