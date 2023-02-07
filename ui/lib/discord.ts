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
    const token = await getToken(code, devUri)
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

export const discordOauthUrl = {
  dev: 'https://discord.com/api/oauth2/authorize?client_id=1068591529620418610&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fraffle&response_type=code&scope=identify%20email',
  preview:
    'https://discord.com/api/oauth2/authorize?client_id=1068591529620418610&redirect_uri=https%3A%2F%2Fdeploy-preview-17--moondao-stc.netlify.app%2Fraffle&response_type=code&scope=identify%20email',
  production:
    'https://discord.com/api/oauth2/authorize?client_id=1068591529620418610&redirect_uri=https%3A%2F%2Fapp.moondao.com%2Fraffle&response_type=code&scope=identify%20email',
}
