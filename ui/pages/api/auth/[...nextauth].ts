import NextAuth from 'next-auth'
import DiscordProvider from 'next-auth/providers/discord'
import TwitterProvider from 'next-auth/providers/twitter'
import KEYS from '../../../namegetKeys'

export const authOptions = {
  providers: [
    TwitterProvider({
      clientId: KEYS.twitterClientId,
      clientSecret: KEYS.twitterClientSecret,
      version: '2.0',
    }),
  ],
}

export default NextAuth(authOptions)
