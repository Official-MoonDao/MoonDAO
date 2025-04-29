import { NextApiHandler } from 'next'
import NextAuth, { NextAuthOptions, DefaultUser } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { verifyPrivyAuth } from '@/lib/privy/privyAuth'

// Extend the built-in types
declare module 'next-auth' {
  interface User extends DefaultUser {
    accessToken: string
  }
  interface Session {
    accessToken?: string
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Privy',
      credentials: {
        accessToken: { label: 'Access Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.accessToken) return null

        try {
          const auth = await verifyPrivyAuth(credentials.accessToken)

          if (!auth) return null

          if (auth.appId !== process.env.NEXT_PUBLIC_PRIVY_APP_ID) return null

          return {
            id: auth.userId,
            accessToken: credentials.accessToken,
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async session({ session, token }) {
      return {
        ...session,
        accessToken: token.accessToken,
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = user.accessToken
      }
      return token
    },
  },
}

const authHandler: NextApiHandler = NextAuth(authOptions)
export default authHandler
