import { NextApiRequest, NextApiResponse } from 'next'
import { transporter, opEmail } from '@/lib/nodemailer/nodemailer'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'

const generateHTML = (proposalId: string, proposalTitle: string) => {
  const proposalUrl = `https://moondao.com/proposal/${proposalId}`
  
  return `<!DOCTYPE html>
<html>
<head>
  <title>Proposal Submitted Successfully</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <style type="text/css">
    body, table, td, a{-webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;}
    table{border-collapse: collapse !important;}
    body{height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important;}
    @media screen and (max-width: 525px){
      .wrapper{width: 100% !important; max-width: 100% !important;}
      .responsive-table{width: 100% !important;}
      .padding{padding: 10px 5% 15px 5% !important;}
      .section-padding{padding: 0 15px 50px 15px !important;}
    }
    .button{
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 8px;
      display: inline-block;
      margin: 20px 0;
      font-weight: bold;
    }
    .content-section{
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .next-steps{
      background: #e3f2fd;
      padding: 15px;
      border-left: 4px solid #2196F3;
      margin: 20px 0;
    }
  </style>
</head>
<body style="margin: 0 !important; padding: 0 !important; background: #fff">
  <table border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td bgcolor="#ffffff" align="center" style="padding: 10px 15px 30px 15px" class="section-padding">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px" class="responsive-table">
          <tr>
            <td>
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 20px 0; text-align: center;">
                    <img src="https://moondao.com/assets/moon-logo.png" alt="MoonDAO" style="max-width: 120px; height: auto;"/>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 0 20px 0; font-size: 16px; line-height: 25px; color: #232323;" class="padding message-content">
                    <h1 style="color: #667eea; margin: 0 0 20px 0;">🎉 Proposal Submitted Successfully!</h1>
                    
                    <p>Congratulations! Your proposal has been successfully submitted to MoonDAO.</p>
                    
                    <div class="content-section">
                      <h2 style="color: #333; font-size: 18px; margin: 0 0 10px 0;">Proposal Details</h2>
                      <p style="margin: 5px 0;"><strong>Proposal ID:</strong> MDP-${proposalId}</p>
                      <p style="margin: 5px 0;"><strong>Title:</strong> ${proposalTitle}</p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${proposalUrl}" class="button">View Your Proposal</a>
                    </div>
                    
                    <div class="next-steps">
                      <h3 style="color: #1976D2; margin: 0 0 15px 0; font-size: 18px;">📋 Next Steps</h3>
                      <ol style="margin: 0; padding-left: 20px; line-height: 1.8;">
                        <li><strong>Community Discussion:</strong> Your proposal is now open for community feedback. Engage with the community in the discussion thread.</li>
                        <li><strong>Discord Thread:</strong> A dedicated Discord thread has been created for your proposal. Join the conversation and answer questions.</li>
                        <li><strong>Temperature Check:</strong> Monitor community sentiment and gather feedback to refine your proposal if needed.</li>
                        <li><strong>Voting Period:</strong> If your proposal gains traction, it will move to an official voting period where MoonDAO citizens will vote.</li>
                      </ol>
                    </div>
                    
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                      <p style="margin: 0; color: #856404;"><strong>💡 Tips for Success:</strong></p>
                      <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #856404;">
                        <li>Respond promptly to community questions and feedback</li>
                        <li>Be open to constructive criticism and suggestions</li>
                        <li>Share your proposal on social media and in relevant channels</li>
                        <li>Update your proposal if needed based on community input</li>
                      </ul>
                    </div>
                    
                    <p style="margin: 30px 0 10px 0;">Need help? Join our <a href="https://discord.gg/moondao" style="color: #667eea; text-decoration: none;">Discord community</a> or check out our <a href="https://docs.moondao.com" style="color: #667eea; text-decoration: none;">documentation</a>.</p>
                    
                    <p style="margin: 20px 0 0 0; color: #666; font-size: 14px;">Best regards,<br/>The MoonDAO Team</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td bgcolor="#f8f9fa" align="center" style="padding: 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
          <tr>
            <td align="center" style="font-size: 12px; color: #666;">
              <p>© 2026 MoonDAO. All rights reserved.</p>
              <p>This email was sent because you submitted a proposal on moondao.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

async function POST(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { email, proposalId, proposalTitle } = req.body

    if (!email || !proposalId || !proposalTitle) {
      return res.status(400).json({ 
        error: 'Missing required fields: email, proposalId, and proposalTitle are required' 
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' })
    }

    const proposalUrl = `https://moondao.com/proposal/${proposalId}`
    const htmlContent = generateHTML(proposalId, proposalTitle)
    
    const plainTextContent = `
Proposal Submitted Successfully!

Congratulations! Your proposal has been successfully submitted to MoonDAO.

Proposal Details:
- Proposal ID: MDP-${proposalId}
- Title: ${proposalTitle}

View your proposal: ${proposalUrl}

Next Steps:
1. Community Discussion: Your proposal is now open for community feedback. Engage with the community in the discussion thread.
2. Discord Thread: A dedicated Discord thread has been created for your proposal. Join the conversation and answer questions.
3. Temperature Check: Monitor community sentiment and gather feedback to refine your proposal if needed.
4. Voting Period: If your proposal gains traction, it will move to an official voting period where MoonDAO citizens will vote.

Tips for Success:
- Respond promptly to community questions and feedback
- Be open to constructive criticism and suggestions
- Share your proposal on social media and in relevant channels
- Update your proposal if needed based on community input

Need help? Join our Discord community: https://discord.gg/moondao

Best regards,
The MoonDAO Team
    `

    const mailOptions = {
      from: opEmail,
      to: email,
      subject: `MoonDAO Proposal MDP-${proposalId} Submitted Successfully`,
      text: plainTextContent,
      html: htmlContent,
    }

    await transporter.sendMail(mailOptions)

    console.log(`Confirmation email sent to ${email} for proposal MDP-${proposalId}`)

    return res.status(200).json({ 
      success: true, 
      message: 'Confirmation email sent successfully' 
    })
  } catch (error: any) {
    console.error('Error sending confirmation email:', error)
    return res.status(500).json({ 
      error: 'Failed to send confirmation email',
      details: error.message 
    })
  }
}

export default withMiddleware(POST, rateLimit)
