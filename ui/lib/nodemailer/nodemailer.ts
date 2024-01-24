import nodemailer from 'nodemailer'

const opEmail = 'info@moondao.com'

const emailList = [
  process.env.NODEMAILER_MOONDAO_PRIMARY_EMAIL,
  process.env.NODEMAILER_SFBW_PRIMARY_EMAIL,
]

export const transporter: any = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: opEmail,
    pass: process.env.NODEMAILER_PASSWORD,
  },
})

export const zeroGMailOptions = {
  from: opEmail,
  to: emailList,
}
