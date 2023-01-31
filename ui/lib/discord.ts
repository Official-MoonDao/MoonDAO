import DiscordOauth2 from 'discord-oauth2'

const oauth = new DiscordOauth2()

async function getToken(code: any, redirectUri: string) {
  return await oauth.tokenRequest({
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    code,
    scope: 'identify email',
    grantType: 'authorization_code',
    redirectUri,
  })
}

export async function getUserDiscordData(code: any) {
  const devUri = `http://localhost:3000/raffle`
  const previewUri = 'https://deploy-preview-17--moondao-stc.netlify.app/raffle'
  const productionUri = `https://app.moondao.com/raffle`
  try {
    const token = await getToken(code, previewUri)
    const admin = await oauth.getUser(token.access_token)
    return {
      id: admin.id,
      username: admin.username,
      email: admin.email,
    }
  } catch (err: any) {
    return err.message
  }
}
