import NextAuth from 'next-auth'
import TwitterProvider from 'next-auth/providers/twitter'

export const authOptions = {
  providers: [
    TwitterProvider({
      clientId: 'Wmc3RXJDUktGMS1DdzRGdkYzc2k6MTpjaQ',
      clientSecret: '7s8-5x1jfggOyN8MAYbFIZ0tvyJrW7yPp-bv_n3rgw6D94fwlD', //dev secret, reset and add .env variable
      version: '2.0',
    }),
  ],
}

export default NextAuth(authOptions)
