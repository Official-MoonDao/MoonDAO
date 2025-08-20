/**
 * GitHub PR Proof API Route
 *
 * This route verifies if a user has submitted MERGED PRs to MoonDAO repositories
 * and allows them to claim XP based on their contribution level.
 *
 * Required Environment Variables:
 * - GITHUB_TOKEN: GitHub Personal Access Token with repo access
 *
 * The user must have a GitHub account linked to their Privy account.
 * This route will:
 * 1. Check if the user has a linked GitHub account
 * 2. Fetch MERGED PR count from MoonDAO repositories using GitHub API
 * 3. Verify eligibility based on merged PR count thresholds
 * 4. Sign and submit XP claims for eligible users
 */
import { utils as ethersUtils } from 'ethers'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { Address } from 'thirdweb'
import { fetchGitHubPRs, type GitHubAccount } from '@/lib/github'
import { addressBelongsToPrivyUser, getPrivyUserData } from '@/lib/privy'
import {
  getUserAndAccessToken,
  signHasSubmittedPRProof,
  submitHasSubmittedPRBulkClaimFor,
} from '@/lib/xp'

const PR_THRESHOLD = BigInt(1) // Minimum PRs required to be eligible

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST')
      return res.status(405).json({ error: 'Method not allowed' })

    const { user, accessToken } = getUserAndAccessToken(req)

    if (!user || !ethersUtils.isAddress(user))
      return res.status(400).json({ error: 'Invalid user address' })

    if (!addressBelongsToPrivyUser(accessToken as string, user))
      return res.status(400).json({ error: 'User not found' })

    // Get Privy user data to check for linked GitHub account
    const privyUserData = await getPrivyUserData(accessToken as string)
    if (!privyUserData) {
      return res.status(400).json({ error: 'Failed to fetch user data' })
    }

    // Check if user has a GitHub account linked
    const githubAccount = privyUserData.userData?.linked_accounts?.find(
      (account: any) => account.type === 'github_oauth'
    )

    if (!githubAccount) {
      return res.status(200).json({
        eligible: false,
        prCount: '0',
        error:
          'No GitHub account linked to your Privy account. Please link your GitHub account first.',
      })
    }

    // Fetch user's GitHub PR count from MoonDAO repositories
    const prCount = await fetchGitHubPRs(user as Address, githubAccount)
    console.log('User PR count:', prCount)

    if (prCount < PR_THRESHOLD)
      return res.status(200).json({
        eligible: false,
        prCount: prCount.toString(),
        error: `You need at least ${PR_THRESHOLD.toString()} merged PR(s) to be eligible. You currently have ${prCount.toString()} merged PR(s).`,
      })

    // For GET requests, just return eligibility
    if (req.method === 'GET') {
      return res.status(200).json({
        eligible: true,
        prCount: prCount.toString(),
        prThreshold: PR_THRESHOLD.toString(),
        githubUsername: githubAccount.username || githubAccount.subject,
      })
    }

    // For POST requests, proceed with claiming
    // Sign/encode via shared oracle helper using actual PR count for bulk claiming
    const { validAfter, validBefore, signature, context } =
      await signHasSubmittedPRProof({
        user: user as Address,
        prCount: prCount, // Use actual PR count for staged bulk claiming
      })

    // Relay the bulk XP claim on behalf of the user so they don't need to send a tx
    const { txHash } = await submitHasSubmittedPRBulkClaimFor({
      user: user as Address,
      context,
    })

    return res.status(200).json({
      eligible: true,
      prCount: prCount.toString(),
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
