import NextAuth from 'next-auth'
import TwitterProvider from 'next-auth/providers/twitter'

export const authOptions = {
  providers: [
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
      version: '2.0',
    }),
  ],
}

export default NextAuth(authOptions)
