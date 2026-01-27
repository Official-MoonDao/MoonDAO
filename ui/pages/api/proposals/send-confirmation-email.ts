import { NextApiRequest, NextApiResponse } from 'next'
import { transporter, opEmail } from '@/lib/nodemailer/nodemailer'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'

const generateHTML = (proposalId: string, proposalTitle: string) => {
  const proposalUrl = `https://moondao.com/proposal/${proposalId}`
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    body{margin:0;padding:20px;font-family:Arial,sans-serif;background:#f5f5f5}
    .container{max-width:600px;margin:0 auto;background:#fff;padding:30px;border-radius:8px}
    h1{color:#667eea;margin:0 0 20px}
    .button{background:#667eea;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;margin:20px 0}
    .details{background:#f8f9fa;padding:15px;border-radius:6px;margin:20px 0}
  </style>
</head>
<body>
  <div class="container">
    <h1>Proposal Submitted</h1>
    <p>Your proposal has been submitted to MoonDAO.</p>
    <div class="details">
      <strong>MDP-${proposalId}</strong><br/>
      ${proposalTitle}
    </div>
    <a href="${proposalUrl}" class="button">View Proposal</a>
    <p><strong>Next Steps:</strong></p>
    <ol>
      <li>Join the Discord thread for your proposal</li>
      <li>Engage with community feedback</li>
      <li>Monitor voting when it begins</li>
    </ol>
    <p style="color:#666;font-size:14px;margin-top:30px">- MoonDAO Team</p>
  </div>
</body>
</html>`
}

async function POST(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { email, proposalId, proposalTitle } = req.body

    if (!email || !proposalId || !proposalTitle) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' })
    }

    const proposalUrl = `https://moondao.com/proposal/${proposalId}`
    const htmlContent = generateHTML(proposalId, proposalTitle)
    
    const plainTextContent = `Proposal Submitted

Your proposal MDP-${proposalId} "${proposalTitle}" has been submitted to MoonDAO.

View: ${proposalUrl}

Next Steps:
1. Join the Discord thread
2. Engage with community feedback
3. Monitor voting when it begins

- MoonDAO Team`

    const mailOptions = {
      from: opEmail,
      to: email,
      subject: `MoonDAO Proposal MDP-${proposalId} Submitted`,
      text: plainTextContent,
      html: htmlContent,
    }

    const info = await transporter.sendMail(mailOptions)

    return res.status(200).json({ success: true })
  } catch (error: any) {
    console.error('Email send failed:', error)
    return res.status(500).json({ error: 'Failed to send email' })
  }
}

export default withMiddleware(POST, rateLimit)
