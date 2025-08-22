/**
 * GitHub Issue Proof API Route
 *
 * This route verifies if a user has submitted issues to MoonDAO repositories
 * and allows them to claim XP based on their contribution level.
 *
 * Required Environment Variables:
 * - GITHUB_TOKEN: GitHub Personal Access Token with repo access
 *
 * The user must have a GitHub account linked to their Privy account.
 * This route will:
 * 1. Check if the user has a linked GitHub account
 * 2. Fetch issue count from MoonDAO repositories using GitHub API
 * 3. Verify eligibility based on issue count thresholds
 * 4. Sign and submit XP claims for eligible users
 */
import { utils as ethersUtils } from 'ethers'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { Address } from 'thirdweb'
import { fetchGitHubIssues, type GitHubAccount } from '@/lib/github'
import { addressBelongsToPrivyUser, getPrivyUserData } from '@/lib/privy'
import {
  getUserAndAccessToken,
  signHasSubmittedIssueProofSingle,
  submitHasSubmittedIssueClaimForSingle,
} from '@/lib/xp'

const ISSUE_THRESHOLD = BigInt(1) // Minimum issues required to be eligible

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST')
      return res.status(405).json({ error: 'Method not allowed' })

    const { user, accessToken } = getUserAndAccessToken(req)

    if (!user || !ethersUtils.isAddress(user))
      return res.status(400).json({ error: 'Invalid user address' })

    const privyUserData = await getPrivyUserData(accessToken as string)
    if (!privyUserData) {
      return res.status(400).json({ error: 'Failed to fetch user data' })
    }

    if (privyUserData.walletAddresses.length === 0) {
      return res.status(200).json({
        eligible: false,
        issueCount: '0',
        error: 'No wallet addresses found for this account',
      })
    }

    if (!privyUserData.walletAddresses.includes(user)) {
      return res.status(200).json({
        eligible: false,
        issueCount: '0',
        error: 'User not found',
      })
    }

    // Check if user has a GitHub account linked
    const githubAccount = privyUserData.userData?.linked_accounts?.find(
      (account: any) => account.type === 'github_oauth'
    )

    if (!githubAccount) {
      return res.status(200).json({
        eligible: false,
        issueCount: '0',
        error: 'No GitHub account linked to your Privy account',
      })
    }

    // Fetch user's GitHub issue count from MoonDAO repositories
    const issueCount = await fetchGitHubIssues(user as Address, githubAccount)

    if (issueCount < ISSUE_THRESHOLD)
      return res.status(200).json({
        eligible: false,
        issueCount: issueCount.toString(),
        error: `You need at least ${ISSUE_THRESHOLD.toString()} issue(s) to be eligible. You currently have ${issueCount.toString()} issue(s).`,
      })

    // For GET requests, just return eligibility
    if (req.method === 'GET') {
      return res.status(200).json({
        eligible: true,
        issueCount: issueCount.toString(),
        issueThreshold: ISSUE_THRESHOLD.toString(),
        githubUsername: githubAccount.username || githubAccount.subject,
      })
    }

    // For POST requests, proceed with claiming
    // Sign/encode via shared oracle helper for regular claiming
    const { validAfter, validBefore, signature, context } =
      await signHasSubmittedIssueProofSingle({
        user: user as Address,
      })

    // Relay the XP claim on behalf of the user so they don't need to send a tx
    const { txHash } = await submitHasSubmittedIssueClaimForSingle({
      user: user as Address,
      context,
    })

    return res.status(200).json({
      eligible: true,
      issueCount: issueCount.toString(),
      validAfter: Number(validAfter),
      validBefore: Number(validBefore),
      signature,
      context,
      txHash,
      githubUsername: githubAccount.username || githubAccount.subject,
    })
  } catch (err: any) {
    console.log(err)
    return res.status(500).json({ error: err?.message || 'Internal error' })
  }
}

export default withMiddleware(handler, authMiddleware)
