import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import { transporter, opEmail } from '@/lib/nodemailer/nodemailer'

const generateHTML = (proposalId: string, proposalTitle: string) => {
  const proposalUrl = `https://moondao.com/proposal/${proposalId}`
  const townHallCalendar = 'https://lu.ma/moondao'
  const ideationChannel =
    'https://discord.com/channels/914720248140279868/1027658256706961509'

  return `<!DOCTYPE html>
<html>
  <head>
    <title>Proposal Submitted - MoonDAO</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  </head>
  <body style="margin: 0; padding: 0; background: #ffffff; font-family: Arial, Helvetica, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #ffffff;">
      <tr>
        <td align="center" style="padding: 40px 20px;">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
            
            <!-- Header -->
            <tr>
              <td align="center" style="padding-bottom: 30px;">
                <h1 style="color: #1a1a2e; font-size: 28px; margin: 0 0 10px 0;">🚀 Proposal Submitted Successfully!</h1>
                <p style="color: #666; font-size: 16px; margin: 0;">Your proposal "<strong>${proposalTitle}</strong>" is now live.</p>
              </td>
            </tr>

            <!-- Proposal Link Box -->
            <tr>
              <td style="background: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
                <h2 style="color: #1a1a2e; font-size: 18px; margin: 0 0 16px 0;">Your Proposal (MDP-${proposalId})</h2>
                <p style="color: #666; margin-bottom: 16px; font-size: 14px; line-height: 1.5;">
                  Your proposal has been successfully submitted to MoonDAO and is now available for community review and discussion.
                </p>
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td align="center">
                      <a href="${proposalUrl}" style="display: inline-block; background: #3b82f6; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Your Proposal</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr><td style="height: 24px;"></td></tr>

            <!-- Next Steps Box -->
            <tr>
              <td style="background: #f8fafc; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0;">
                <h2 style="color: #1a1a2e; font-size: 18px; margin: 0 0 20px 0;">📋 Next Steps</h2>
                
                <!-- Step 1 -->
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 20px;">
                  <tr>
                    <td width="36" valign="top">
                      <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="width: 28px; height: 28px; background: #3b82f6; color: #ffffff; border-radius: 14px; text-align: center; font-weight: bold; font-size: 14px; line-height: 28px;">1</td>
                        </tr>
                      </table>
                    </td>
                    <td valign="top" style="padding-left: 12px;">
                      <h3 style="color: #1a1a2e; font-size: 16px; margin: 0 0 4px 0;">Attend the Next Town Hall</h3>
                      <p style="color: #666; font-size: 14px; margin: 0; line-height: 1.5;">Present your proposal to the community and answer questions during our weekly town hall meetings. This is crucial for building support.</p>
                      <p style="margin-top: 8px; margin-bottom: 0;"><a href="${townHallCalendar}" style="color: #3b82f6; text-decoration: underline;">View Town Hall Schedule →</a></p>
                    </td>
                  </tr>
                </table>

                <!-- Step 2 -->
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 20px;">
                  <tr>
                    <td width="36" valign="top">
                      <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="width: 28px; height: 28px; background: #3b82f6; color: #ffffff; border-radius: 14px; text-align: center; font-weight: bold; font-size: 14px; line-height: 28px;">2</td>
                        </tr>
                      </table>
                    </td>
                    <td valign="top" style="padding-left: 12px;">
                      <h3 style="color: #1a1a2e; font-size: 16px; margin: 0 0 4px 0;">Engage in Discord</h3>
                      <p style="color: #666; font-size: 14px; margin: 0; line-height: 1.5;">Share your proposal in the #ideation channel to gather feedback and build consensus before the voting period.</p>
                      <p style="margin-top: 8px; margin-bottom: 0;"><a href="${ideationChannel}" style="color: #3b82f6; text-decoration: underline;">Join the Discussion →</a></p>
                    </td>
                  </tr>
                </table>

                <!-- Step 3 -->
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td width="36" valign="top">
                      <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="width: 28px; height: 28px; background: #3b82f6; color: #ffffff; border-radius: 14px; text-align: center; font-weight: bold; font-size: 14px; line-height: 28px;">3</td>
                        </tr>
                      </table>
                    </td>
                    <td valign="top" style="padding-left: 12px;">
                      <h3 style="color: #1a1a2e; font-size: 16px; margin: 0 0 4px 0;">Prepare for Voting</h3>
                      <p style="color: #666; font-size: 14px; margin: 0; line-height: 1.5;">Once your proposal moves to the voting phase, ensure you have support from the community to pass the governance vote.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr><td style="height: 24px;"></td></tr>

            <!-- Tips Box -->
            <tr>
              <td style="background: #fef3c7; border-radius: 12px; padding: 20px; border: 1px solid #fcd34d;">
                <h3 style="color: #92400e; font-size: 16px; margin: 0 0 12px 0;">💡 Pro Tips for Success</h3>
                <ul style="margin: 0; padding-left: 20px; color: #78350f;">
                  <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.4;">Be prepared to present your proposal concisely (3-5 minutes) during town hall</li>
                  <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.4;">Engage with community feedback and be open to iterations</li>
                  <li style="margin-bottom: 8px; font-size: 14px; line-height: 1.4;">Build support by networking with other community members</li>
                  <li style="margin-bottom: 0; font-size: 14px; line-height: 1.4;">Address questions and concerns promptly in Discord</li>
                </ul>
              </td>
            </tr>

            <tr><td style="height: 30px;"></td></tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <p style="color: #666; font-size: 12px; margin: 0;">
                  This email was sent because you submitted a proposal on MoonDAO.<br />
                  <a href="https://moondao.com" style="color: #3b82f6; text-decoration: none;">moondao.com</a> · 
                  <a href="https://discord.gg/moondao" style="color: #3b82f6; text-decoration: none;">Discord</a> · 
                  <a href="https://twitter.com/OfficialMoonDAO" style="color: #3b82f6; text-decoration: none;">Twitter</a>
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

async function handler(req: any, res: any) {
  if (req.method === 'POST') {
    const { email, proposalId, proposalTitle } = req.body

    if (!email || !proposalId || !proposalTitle) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' })
    }

    try {
      await transporter.sendMail({
        from: opEmail,
        to: email,
        subject: `MoonDAO | Your Proposal (MDP-${proposalId}) Has Been Submitted`,
        html: generateHTML(proposalId, proposalTitle),
        bcc: [opEmail],
      })

      return res.status(200).json({ success: true })
    } catch (err: any) {
      console.error('Failed to send proposal confirmation email:', err)
      return res.status(500).json({ message: 'Failed to send email' })
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' })
  }
}

export default withMiddleware(handler, authMiddleware)
