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
  const devUri = `http://localhost:3000/zero-g`
  const previewUri = 'https://deploy-preview-27--moondao-stc.netlify.app/zero-g'
  const productionUri = `https://moondao.com/zero-g`
  try {
    const token = await getToken(code, productionUri)
    const user = await oauth.getUser(token.access_token)
    return {
      id: user.id,
      username: user.username,
      email: user.email,
    }
  } catch (err: any) {
    return err.message
  }
}

export const discordOauthUrl = {
  dev: 'https://discord.com/api/oauth2/authorize?client_id=1068591529620418610&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fzero-g&response_type=code&scope=identify%20email',
  preview:
    'https://discord.com/api/oauth2/authorize?client_id=1068591529620418610&redirect_uri=https%3A%2F%2Fdeploy-preview-27--moondao-stc.netlify.app%2Fzero-g&response_type=code&scope=identify%20email',
  production:
    'https://discord.com/api/oauth2/authorize?client_id=1068591529620418610&redirect_uri=https%3A%2F%2Fapp.moondao.com%2Fzero-g&response_type=code&scope=identify%20email',
}
