/**
 * GitHub API Library for MoonDAO XP System
 *
 * This library provides functions to fetch GitHub data (PRs, issues) from MoonDAO repositories
 * using the GitHub Search API.
 *
 * Required Environment Variables:
 * - GITHUB_TOKEN: GitHub Personal Access Token with repo access
 */
import { Address } from 'thirdweb'

export interface GitHubAccount {
  type: string
  subject: string // GitHub username
  username?: string
}

export interface GitHubSearchResult {
  total_count: number
  items: any[]
}

/**
 * Fetch GitHub PRs from MoonDAO repositories for a specific user
 */
export async function fetchGitHubPRs(
  user: Address,
  githubAccount: GitHubAccount
): Promise<bigint> {
  try {
    // Check if we have a GitHub token
    const githubToken = process.env.GITHUB_TOKEN
    if (!githubToken) {
      console.error('GitHub token not configured')
      return BigInt(0)
    }

    // Get the GitHub username from the linked account
    const githubUsername = githubAccount.username || githubAccount.subject

    if (!githubUsername) {
      console.error('No GitHub username found in linked account')
      return BigInt(0)
    }

    // Search for MERGED PRs by the user in MoonDAO repositories
    // This searches across all MoonDAO repositories and only counts merged PRs
    const query = `author:${githubUsername} is:pr is:merged org:Official-MoonDao`

    const response = await fetch(
      `https://api.github.com/search/issues?q=${encodeURIComponent(
        query
      )}&per_page=100`,
      {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'MoonDAO-XP-System',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('GitHub API error:', response.status, errorText)

      // Handle rate limiting
      if (response.status === 403) {
        console.error('GitHub API rate limit exceeded')
        return BigInt(0)
      }

      throw new Error(`GitHub API error: ${response.status}`)
    }

    const data: GitHubSearchResult = await response.json()
    const prCount = data.total_count || 0

    return BigInt(prCount)
  } catch (err) {
    console.error('GitHub PR fetch failed:', err)
    return BigInt(0)
  }
}

/**
 * Fetch GitHub issues from MoonDAO repositories for a specific user
 */
export async function fetchGitHubIssues(
  user: Address,
  githubAccount: GitHubAccount
): Promise<bigint> {
  try {
    // Check if we have a GitHub token
    const githubToken = process.env.GITHUB_TOKEN
    if (!githubToken) {
      console.error('GitHub token not configured')
      return BigInt(0)
    }

    // Get the GitHub username from the linked account
    const githubUsername = githubAccount.username || githubAccount.subject

    if (!githubUsername) {
      console.error('No GitHub username found in linked account')
      return BigInt(0)
    }

    // Search for issues by the user in MoonDAO repositories
    // This searches across all MoonDAO repositories
    const query = `author:${githubUsername} is:issue org:Official-MoonDao`

    const response = await fetch(
      `https://api.github.com/search/issues?q=${encodeURIComponent(
        query
      )}&per_page=100`,
      {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'MoonDAO-XP-System',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('GitHub API error:', response.status, errorText)

      // Handle rate limiting
      if (response.status === 403) {
        console.error('GitHub API rate limit exceeded')
        return BigInt(0)
      }

      throw new Error(`GitHub API error: ${response.status}`)
    }

    const data: GitHubSearchResult = await response.json()
    const issueCount = data.total_count || 0

    return BigInt(issueCount)
  } catch (err) {
    console.error('GitHub issues fetch failed:', err)
    return BigInt(0)
  }
}

/**
 * Generic function to fetch GitHub data (PRs or issues) from MoonDAO repositories
 */
export async function fetchGitHubData(
  user: Address,
  githubAccount: GitHubAccount,
  type: 'pr' | 'issue'
): Promise<bigint> {
  if (type === 'pr') {
    return fetchGitHubPRs(user, githubAccount)
  } else {
    return fetchGitHubIssues(user, githubAccount)
  }
}
