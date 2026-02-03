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
    <style type="text/css">
      body, table, td, a {
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
      table {
        border-collapse: collapse !important;
      }
      body {
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        font-family: "Helvetica Neue", "Helvetica", "Arial", sans-serif;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 40px 20px;
      }
      .header {
        text-align: center;
        margin-bottom: 30px;
      }
      .header h1 {
        color: #1a1a2e;
        font-size: 28px;
        margin: 0 0 10px 0;
      }
      .header p {
        color: #666;
        font-size: 16px;
        margin: 0;
      }
      .success-icon {
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #22c55e, #3b82f6);
        border-radius: 50%;
        margin: 0 auto 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .content-box {
        background: #f8fafc;
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 24px;
        border: 1px solid #e2e8f0;
      }
      .content-box h2 {
        color: #1a1a2e;
        font-size: 18px;
        margin: 0 0 16px 0;
      }
      .proposal-link {
        display: inline-block;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        color: white !important;
        padding: 12px 24px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
        margin: 10px 0;
      }
      .step {
        display: flex;
        margin-bottom: 16px;
      }
      .step-number {
        width: 28px;
        height: 28px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
        margin-right: 12px;
        flex-shrink: 0;
      }
      .step-content h3 {
        color: #1a1a2e;
        font-size: 16px;
        margin: 0 0 4px 0;
      }
      .step-content p {
        color: #666;
        font-size: 14px;
        margin: 0;
        line-height: 1.5;
      }
      .step-content a {
        color: #3b82f6;
        text-decoration: underline;
      }
      .tips-box {
        background: #fef3c7;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 24px;
        border: 1px solid #fcd34d;
      }
      .tips-box h3 {
        color: #92400e;
        font-size: 16px;
        margin: 0 0 12px 0;
      }
      .tips-box ul {
        margin: 0;
        padding-left: 20px;
        color: #78350f;
      }
      .tips-box li {
        margin-bottom: 8px;
        font-size: 14px;
        line-height: 1.4;
      }
      .footer {
        text-align: center;
        color: #666;
        font-size: 12px;
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #e2e8f0;
      }
      .footer a {
        color: #3b82f6;
        text-decoration: none;
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background: #ffffff;">
    <div class="container">
      <div class="header">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://moondao.com/assets/MoonDAO-Logo-White.svg" alt="MoonDAO" style="height: 50px; background: #1a1a2e; padding: 10px 20px; border-radius: 8px;" />
        </div>
        <h1>🚀 Proposal Submitted Successfully!</h1>
        <p>Your proposal "<strong>${proposalTitle}</strong>" is now live.</p>
      </div>

      <div class="content-box">
        <h2>Your Proposal (MDP-${proposalId})</h2>
        <p style="color: #666; margin-bottom: 16px;">
          Your proposal has been successfully submitted to MoonDAO and is now available for community review and discussion.
        </p>
        <div style="text-align: center;">
          <a href="${proposalUrl}" class="proposal-link">View Your Proposal</a>
        </div>
      </div>

      <div class="content-box">
        <h2>📋 Next Steps</h2>
        
        <div class="step">
          <div class="step-number">1</div>
          <div class="step-content">
            <h3>Attend the Next Town Hall</h3>
            <p>Present your proposal to the community and answer questions during our weekly town hall meetings. This is crucial for building support.</p>
            <p style="margin-top: 8px;"><a href="${townHallCalendar}">View Town Hall Schedule →</a></p>
          </div>
        </div>

        <div class="step">
          <div class="step-number">2</div>
          <div class="step-content">
            <h3>Engage in Discord</h3>
            <p>Share your proposal in the #ideation channel to gather feedback and build consensus before the voting period.</p>
            <p style="margin-top: 8px;"><a href="${ideationChannel}">Join the Discussion →</a></p>
          </div>
        </div>

        <div class="step">
          <div class="step-number">3</div>
          <div class="step-content">
            <h3>Prepare for Voting</h3>
            <p>Once your proposal moves to the voting phase, ensure you have support from the community to pass the governance vote.</p>
          </div>
        </div>
      </div>

      <div class="tips-box">
        <h3>💡 Pro Tips for Success</h3>
        <ul>
          <li>Be prepared to present your proposal concisely (3-5 minutes) during town hall</li>
          <li>Engage with community feedback and be open to iterations</li>
          <li>Build support by networking with other community members</li>
          <li>Address questions and concerns promptly in Discord</li>
        </ul>
      </div>

      <div class="footer">
        <p>
          This email was sent because you submitted a proposal on MoonDAO.<br />
          <a href="https://moondao.com">moondao.com</a> · <a href="https://discord.gg/moondao">Discord</a> · <a href="https://twitter.com/OfficialMoonDAO">Twitter</a>
        </p>
      </div>
    </div>
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
