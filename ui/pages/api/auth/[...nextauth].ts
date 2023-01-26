import NextAuth from 'next-auth'
import TwitterProvider from 'next-auth/providers/twitter'

export const authOptions = {
  providers: [
    TwitterProvider({
      clientId: 'Wmc3RXJDUktGMS1DdzRGdkYzc2k6MTpjaQ',
      clientSecret: 'ell7ydKMJZdNuWpehdf9vDjGFGTdUOmV-an-cU7YsQYFLzF7dE',
      version: '2.0',
    }),
  ],
}

export default NextAuth(authOptions)
